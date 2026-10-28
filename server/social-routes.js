import express from 'express'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import * as instagram from './providers/instagram.js'
import * as tiktok from './providers/tiktok.js'
import * as youtube from './providers/youtube.js'
import { requireAuth, sameOrigin, readCurrentUser } from './auth.js'
import {
  insertOAuthState, consumeOAuthState, listConnections, getConnection, upsertConnection,
  updateConnection, deleteConnection, getMetricSnapshot, saveMetricSnapshot, cleanupExpired,
} from './db.js'
import { decryptToken, encryptToken, isEncryptionConfigured } from './crypto.js'

const PROVIDERS = { instagram, tiktok, youtube }
const PROVIDER_LABELS = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' }
const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000
const MAX_RANGE_DAYS = 366
const STATE_SECONDS = 10 * 60
const SYNC_COOLDOWN_MS = 60 * 1000
const activeSyncs = new Map()
const activeTokenRefreshes = new Map()
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function publicOrigin() {
  try {
    const url = new URL(process.env.APP_PUBLIC_ORIGIN || 'https://studio-9vopelhq.manus.space')
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    return url.origin
  } catch { return null }
}
function callbackUri(providerId) {
  const origin = publicOrigin()
  if (!origin) return null
  return new URL(`/api/oauth/${providerId}/callback`, `${origin}/`).toString()
}
function validProvider(value) {
  return typeof value === 'string' && Object.hasOwn(PROVIDERS, value) ? PROVIDERS[value] : null
}
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}
function dateString(date) { return date.toISOString().slice(0, 10) }
function defaultRange() {
  const end = dateString(new Date())
  const start = new Date(`${end}T00:00:00.000Z`)
  start.setUTCDate(start.getUTCDate() - 27)
  return { startDate: dateString(start), endDate: end }
}
function validRange(body = {}) {
  const start = parseDate(body.startDate)
  const end = parseDate(body.endDate)
  if (!start || !end || start > end || dateString(end) > dateString(new Date())) return null
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  return days > 0 && days <= MAX_RANGE_DAYS ? { startDate: body.startDate, endDate: body.endDate } : null
}
function normalizeTokens(raw, adapter, previousRefreshToken) {
  const accessToken = raw?.accessToken ?? raw?.access_token
  if (typeof accessToken !== 'string' || !accessToken) throw new Error('Provider token exchange failed')
  const expiresInRaw = raw?.expiresIn ?? raw?.expires_in
  const expiresIn = Number.isFinite(Number(expiresInRaw)) ? Number(expiresInRaw) : undefined
  const expiresAt = raw?.expiresAt ?? (expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined)
  const refreshToken = raw?.refreshToken ?? raw?.refresh_token ?? previousRefreshToken ?? undefined
  const refreshExpiresInRaw = raw?.refreshExpiresIn ?? raw?.refresh_expires_in
  const refreshExpiresIn = Number.isFinite(Number(refreshExpiresInRaw)) ? Number(refreshExpiresInRaw) : undefined
  const refreshExpiresAt = raw?.refreshExpiresAt ?? (refreshExpiresIn ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString() : undefined)
  const scopes = Array.isArray(raw?.scopes) ? raw.scopes.join(' ') : typeof raw?.scope === 'string' ? raw.scope : adapter.scopes.join(' ')
  return { accessToken, refreshToken, expiresAt: expiresAt || undefined, refreshExpiresAt: refreshExpiresAt || undefined, scope: scopes }
}
function sqlDate(value) { return value ? new Date(value) : null }
function keyIsReady() { return isEncryptionConfigured() }
function originIsPublic(req) { return Boolean(publicOrigin() && req.headers.origin === publicOrigin()) }
function setStateCookie(res, providerId, state) {
  res.cookie(`cp_social_state_${providerId}`, state, {
    httpOnly: true, secure: true, sameSite: 'none', path: `/api/oauth/${providerId}/callback`, maxAge: STATE_SECONDS * 1000,
  })
}
function clearStateCookie(res, providerId) {
  res.clearCookie(`cp_social_state_${providerId}`, {
    httpOnly: true, secure: true, sameSite: 'none', path: `/api/oauth/${providerId}/callback`,
  })
}
function popupResponse(res, providerId, success, message) {
  const origin = publicOrigin()
  if (!origin) return res.status(400).type('text').send('Não foi possível concluir a conexão.')
  const payload = JSON.stringify({ type: 'planner-oauth-complete', provider: providerId, success, message })
  const target = JSON.stringify(origin)
  const safePayload = payload.replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
  const safeTarget = target.replaceAll('<', '\\u003c')
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' })
  return res.status(200).type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Conexão social</title></head><body><p>${success ? 'Conexão concluída.' : 'Não foi possível concluir a conexão.'} Esta janela pode ser fechada.</p><script>try{if(window.opener)window.opener.postMessage(${safePayload},${safeTarget})}catch{}window.close()</script></body></html>`)
}
function parsePayload(payload) {
  if (typeof payload === 'string') { try { return JSON.parse(payload) } catch { return null } }
  return payload && typeof payload === 'object' ? payload : null
}
function shouldRefresh(account) {
  if (!account.expiresAt) return false
  const expiresAt = new Date(account.expiresAt).getTime()
  if (!Number.isFinite(expiresAt)) return false
  const remaining = expiresAt - Date.now()
  if (account.provider === 'instagram') return remaining <= 14 * 86400000
  return remaining <= 5 * 60 * 1000
}
async function freshTokens(account, adapter) {
  const accessToken = decryptToken(account.accessTokenCipher)
  let refreshToken = account.refreshTokenCipher ? decryptToken(account.refreshTokenCipher) : undefined
  if (!shouldRefresh(account)) return { accessToken, refreshToken }
  const key = `${account.ownerOpenId}:${account.id}`
  if (activeTokenRefreshes.has(key)) return activeTokenRefreshes.get(key)
  const task = (async () => {
    const refreshed = account.provider === 'instagram'
      ? await adapter.refreshTokens({ accessToken })
      : refreshToken ? await adapter.refreshTokens({ refreshToken }) : null
    if (!refreshed) throw new Error('Autorização vencida; reconecte a conta.')
    const normalized = normalizeTokens(refreshed, adapter, refreshToken)
    refreshToken = normalized.refreshToken
    await updateConnection(account.id, account.ownerOpenId, {
      accessTokenCipher: encryptToken(normalized.accessToken),
      ...(refreshToken ? { refreshTokenCipher: encryptToken(refreshToken) } : {}),
      expiresAt: sqlDate(normalized.expiresAt),
      refreshExpiresAt: sqlDate(normalized.refreshExpiresAt) ?? account.refreshExpiresAt ?? null,
      status: 'connected',
    })
    return { accessToken: normalized.accessToken, refreshToken }
  })()
  activeTokenRefreshes.set(key, task)
  try { return await task }
  finally { if (activeTokenRefreshes.get(key) === task) activeTokenRefreshes.delete(key) }
}

function previousRange(range) {
  const dayCount = Math.floor((parseDate(range.endDate).getTime() - parseDate(range.startDate).getTime()) / 86400000) + 1
  const end = new Date(`${range.startDate}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - dayCount + 1)
  return { startDate: dateString(start), endDate: dateString(end) }
}

async function syncAccount(account, range, { force = false } = {}) {
  const adapter = validProvider(account.provider)
  if (!adapter) throw new Error('Unsupported provider')
  if (account.status !== 'connected') throw new Error('Reautorização necessária.')
  const stored = await getMetricSnapshot(account.id, range.startDate, range.endDate)
  const cached = stored ? parsePayload(stored.payload) : null
  const cachedAt = stored ? new Date(stored.fetchedAt).getTime() : 0
  if (!force && cached && Number.isFinite(cachedAt) && Date.now() - cachedAt < SNAPSHOT_TTL_MS) {
    return { ...cached, fetchedAt: new Date(stored.fetchedAt).toISOString(), stale: false }
  }
  const lastSyncAt = account.lastSyncedAt ? new Date(account.lastSyncedAt).getTime() : 0
  if (force && Number.isFinite(lastSyncAt) && lastSyncAt > 0 && Date.now() - lastSyncAt < SYNC_COOLDOWN_MS) {
    if (cached) return { ...cached, fetchedAt: new Date(stored.fetchedAt).toISOString(), stale: true }
    throw new Error('Uma atualização foi solicitada há pouco. Aguarde um minuto antes de tentar novamente.')
  }
  const tokens = await freshTokens(account, adapter)
  const raw = await adapter.fetchMetrics({
    accessToken: tokens.accessToken,
    providerAccountId: account.providerUserId,
    startDate: range.startDate,
    endDate: range.endDate,
  })
  const fetchedAt = new Date().toISOString()
  const payload = {
    account: { id: String(account.id), provider: account.provider, displayName: account.displayName, handle: account.handle },
    summary: raw.summary || {},
    daily: Array.isArray(raw.daily) ? raw.daily : [],
    posts: Array.isArray(raw.posts) ? raw.posts : [],
    limitations: Array.isArray(raw.limitations) ? raw.limitations : [],
    coverage: raw.coverage || { start: range.startDate, end: range.endDate },
    fetchedAt,
  }
  await saveMetricSnapshot(account.id, range.startDate, range.endDate, payload)
  await updateConnection(account.id, account.ownerOpenId, { status: 'connected', lastSyncedAt: new Date() })
  return { ...payload, stale: false }
}
function publicError(error) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('Autorização vencida') || message.includes('Reautorização')) return 'A autorização expirou. Reconecte esta conta.'
  return 'Não foi possível sincronizar agora. Tente novamente ou reconecte a conta se o problema persistir.'
}
async function syncConnection(ownerOpenId, connection, range, options) {
  const force = options?.force === true
  const key = `${ownerOpenId}:${connection.id}:${range.startDate}:${range.endDate}:${force ? 'force' : 'cache'}`
  if (activeSyncs.has(key)) return activeSyncs.get(key)
  const task = (async () => {
    try {
      const account = await getConnection(connection.id, ownerOpenId)
      if (!account) return { account: { id: String(connection.id), provider: connection.provider }, status: 'error', error: 'Conexão não encontrada.', limitations: [], daily: [], posts: [], summary: {} }
      const data = await syncAccount(account, range, { force })
      let comparison
      if (account.provider === 'tiktok') {
        comparison = { status: 'not_applicable', error: 'As contagens do TikTok são cumulativas por vídeo e não representam uma série histórica do intervalo.' }
      } else {
        const priorRange = previousRange(range)
        try {
          const refreshedAccount = await getConnection(connection.id, ownerOpenId)
          const prior = await syncAccount(refreshedAccount, priorRange)
          const keys = ['views', 'reach', 'interactions', 'estimatedMinutesWatched', 'subscribersGained', 'subscribersLost']
          const summary = Object.fromEntries(keys.filter((metric) => Number.isFinite(data.summary?.[metric]) && Number.isFinite(prior.summary?.[metric])).map((metric) => [metric, prior.summary[metric]]))
          comparison = Object.keys(summary).length
            ? { status: 'ready', range: priorRange, summary }
            : { status: 'unavailable', range: priorRange, error: 'A fonte não retornou valores comparáveis para ambos os períodos.' }
        } catch {
          comparison = { status: 'unavailable', range: priorRange, error: 'A API não disponibilizou um período anterior comparável.' }
        }
      }
      return { ...data, status: 'ready', comparison }
    } catch (error) {
      return {
        account: { id: String(connection.id), provider: connection.provider, displayName: connection.displayName, handle: connection.handle },
        status: 'error', error: publicError(error), limitations: [], daily: [], posts: [], summary: {},
      }
    }
  })()
  activeSyncs.set(key, task)
  try { return await task }
  finally { if (activeSyncs.get(key) === task) activeSyncs.delete(key) }
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index])
    }
  }))
  return results
}

export function createSocialRouter() {
  const router = express.Router()

  router.get('/integrations/status', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    const encryptionReady = keyIsReady()
    const origin = publicOrigin()
    const dataControllerContact = typeof process.env.PUBLIC_DATA_CONTROLLER_CONTACT === 'string' && process.env.PUBLIC_DATA_CONTROLLER_CONTACT.trim()
      ? process.env.PUBLIC_DATA_CONTROLLER_CONTACT.trim().slice(0, 500) : null
    const policyReady = Boolean(dataControllerContact)
    const providers = Object.entries(PROVIDERS).map(([providerId, adapter]) => ({
      id: providerId,
      name: PROVIDER_LABELS[providerId],
      scopes: adapter.scopes,
      configured: adapter.isConfigured(process.env),
      ready: adapter.isConfigured(process.env) && encryptionReady && Boolean(origin) && policyReady,
      callbackUri: callbackUri(providerId),
      eligibility: providerId === 'instagram'
        ? 'Contas profissionais Business/Creator; contas de terceiros podem exigir Advanced Access e revisão do app.'
        : providerId === 'tiktok'
          ? 'Exige aprovação do app/Display API; vídeos e contagens públicas da própria conta autorizada.'
          : 'Exige aprovação OAuth/YouTube; somente o canal selecionado pela conta autorizada.',
    }))
    return res.status(200).json({ publicOrigin: origin, encryptionReady, policyReady, dataControllerContact, providers })
  })

  router.get('/connections', requireAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try { return res.status(200).json({ connections: await listConnections(req.user.openId) }) }
    catch { return res.status(500).json({ error: 'Não foi possível carregar as conexões.' }) }
  })

  router.post('/oauth/:provider/start', requireAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origem da solicitação inválida.' })
    const providerId = req.params.provider
    const adapter = validProvider(providerId)
    const redirectUri = callbackUri(providerId)
    if (!adapter || !redirectUri) return res.status(404).json({ error: 'Integração não encontrada.' })
    if (!originIsPublic(req)) return res.status(403).json({ error: 'Para proteger sua conta, conecte redes somente no endereço publicado do Planejador de conteúdo.' })
    if (!process.env.PUBLIC_DATA_CONTROLLER_CONTACT?.trim()) return res.status(503).json({ error: 'Antes de conectar redes, informe o controlador e um canal público de contato na página de privacidade.' })
    if (!adapter.isConfigured(process.env) || !keyIsReady()) return res.status(503).json({ error: 'A integração ainda aguarda credenciais e configuração segura.' })
    try {
      const state = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + STATE_SECONDS * 1000)
      await insertOAuthState({
        stateHash: sha256(state), nonceHash: sha256(state), kind: 'social_oauth', provider: providerId,
        ownerOpenId: req.user.openId, origin: publicOrigin(), redirectUri, expiresAt,
      })
      setStateCookie(res, providerId, state)
      const authorizationUrl = adapter.authorizationUrl({ state, redirectUri, env: process.env })
      return res.status(200).json({ authorizationUrl })
    } catch { return res.status(500).json({ error: 'Não foi possível iniciar a conexão.' }) }
  })

  router.get('/oauth/:provider/callback', async (req, res) => {
    const providerId = req.params.provider
    const adapter = validProvider(providerId)
    if (!adapter) return res.status(404).type('text').send('Integração não encontrada.')
    const state = req.query.state
    const code = req.query.code
    const stateCookie = req.cookies?.[`cp_social_state_${providerId}`] || (() => {
      const entry = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`cp_social_state_${providerId}=`))
      return entry ? decodeURIComponent(entry.slice(entry.indexOf('=') + 1)) : undefined
    })()
    clearStateCookie(res, providerId)
    if (typeof state !== 'string' || state.length > 4096 || !stateCookie) {
      return popupResponse(res, providerId, false, 'A autorização não pôde ser confirmada. Tente conectar novamente.')
    }
    let consumed
    try { consumed = await consumeOAuthState({ stateHash: sha256(state), kind: 'social_oauth', provider: providerId }) } catch { consumed = null }
    const a = Buffer.from(sha256(state), 'hex')
    const b = Buffer.from(sha256(stateCookie), 'hex')
    const stateMatches = a.length === b.length && timingSafeEqual(a, b)
    const currentUser = await readCurrentUser(req)
    if (!consumed || !stateMatches || consumed.nonceHash !== sha256(state) || !currentUser || currentUser.openId !== consumed.ownerOpenId || consumed.origin !== publicOrigin() || consumed.redirectUri !== callbackUri(providerId)) {
      return popupResponse(res, providerId, false, 'A sessão expirou ou a autorização não corresponde. Conecte novamente.')
    }
    if (typeof req.query.error === 'string') return popupResponse(res, providerId, false, 'A conexão foi cancelada ou recusada na rede social.')
    if (typeof code !== 'string' || code.length > 4096) return popupResponse(res, providerId, false, 'A autorização não pôde ser confirmada. Tente conectar novamente.')
    try {
      const rawTokens = await adapter.exchangeCode({ code, redirectUri: consumed.redirectUri, env: process.env })
      const tokenSet = normalizeTokens(rawTokens, adapter)
      const accountData = await adapter.fetchAccount({ accessToken: tokenSet.accessToken, env: process.env })
      const providerUserId = accountData.providerAccountId ?? accountData.id ?? accountData.open_id
      if (typeof providerUserId !== 'string' && typeof providerUserId !== 'number') throw new Error('Account identity unavailable')
      const providerAccountId = String(providerUserId)
      const displayName = accountData.displayName ?? accountData.display_name ?? accountData.name ?? undefined
      const handle = accountData.handle ?? accountData.username ?? accountData.login ?? undefined
      const connectionId = await upsertConnection({
        ownerOpenId: currentUser.openId, provider: providerId, providerUserId: providerAccountId,
        displayName: typeof displayName === 'string' ? displayName.slice(0, 255) : undefined,
        handle: typeof handle === 'string' ? handle.slice(0, 255) : undefined,
        accessTokenCipher: encryptToken(tokenSet.accessToken),
        refreshTokenCipher: tokenSet.refreshToken ? encryptToken(tokenSet.refreshToken) : null,
        scope: tokenSet.scope, expiresAt: sqlDate(tokenSet.expiresAt), refreshExpiresAt: sqlDate(tokenSet.refreshExpiresAt), status: 'connected',
      })
      const range = defaultRange()
      const connected = await getConnection(connectionId, currentUser.openId)
      if (connected) {
        const full = await getConnection(connected.id, currentUser.openId)
        try { await syncAccount(full, range, { force: true }) } catch { /* Keep the authorized connection and surface a sync retry action. */ }
      }
      try { await cleanupExpired() } catch { /* Expired-record cleanup must not turn a saved connection into an OAuth failure. */ }
      return popupResponse(res, providerId, true, 'Conta conectada. As métricas foram atualizadas quando a rede disponibilizou dados.')
    } catch {
      return popupResponse(res, providerId, false, 'A rede não concluiu a conexão. Verifique a aprovação do app e as permissões de leitura, então tente novamente.')
    }
  })

  router.post('/metrics/sync', requireAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origem da solicitação inválida.' })
    const range = validRange(req.body)
    if (!range) return res.status(400).json({ error: 'Escolha um período válido de até um ano, encerrado até hoje.' })
    const requested = req.body?.platform
    if (requested !== undefined && requested !== 'Todas' && !Object.hasOwn(PROVIDERS, requested)) return res.status(400).json({ error: 'Plataforma inválida.' })
    const requestedAccountId = req.body?.accountId
    if (requestedAccountId !== undefined && !/^\d{1,20}$/.test(String(requestedAccountId))) return res.status(400).json({ error: 'Conta inválida.' })
    try {
      const connections = await listConnections(req.user.openId)
      const matching = connections.filter((item) =>
        (!requested || requested === 'Todas' || item.provider === requested) &&
        (requestedAccountId === undefined || String(item.id) === String(requestedAccountId)))
      const results = await mapConcurrent(matching, 3, (connection) => syncConnection(req.user.openId, connection, range, { force: req.body?.force === true }))
      try { await cleanupExpired() } catch { /* Sync results remain usable when opportunistic cleanup fails. */ }
      const statuses = results.map((item) => item.status)
      const status = results.length === 0 ? 'empty' : statuses.every((item) => item === 'ready') ? 'ready' : statuses.some((item) => item === 'ready') ? 'partial' : 'error'
      return res.status(200).json({ status, range, generatedAt: new Date().toISOString(), platforms: results })
    } catch { return res.status(500).json({ error: 'Não foi possível sincronizar as métricas.' }) }
  })

  router.delete('/connections/:id', requireAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origem da solicitação inválida.' })
    const connectionId = String(req.params.id || '')
    if (!/^\d{1,20}$/.test(connectionId)) return res.status(404).json({ error: 'Conexão não encontrada.' })
    try {
      const account = await getConnection(connectionId, req.user.openId)
      if (!account) return res.status(404).json({ error: 'Conexão não encontrada.' })
      let revoked = false
      try {
        const adapter = validProvider(account.provider)
        const accessToken = decryptToken(account.accessTokenCipher)
        const result = await adapter.revoke({ accessToken, env: process.env })
        revoked = result !== false && result?.success !== false
      } catch { /* The local token and metric data are removed even when provider revocation is unavailable. */ }
      const deleted = await deleteConnection(account.id, req.user.openId)
      return res.status(200).json({ success: deleted, revoked })
    } catch { return res.status(500).json({ error: 'Não foi possível remover a conexão.' }) }
  })

  return router
}
