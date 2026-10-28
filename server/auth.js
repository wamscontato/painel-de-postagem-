import express from 'express'
import { createHash, randomBytes, timingSafeEqual, createHmac } from 'node:crypto'
import { insertOAuthState, consumeOAuthState, createSession, getSession, deleteSession } from './db.js'

const SESSION_COOKIE = 'webdev_app_session'
const STATE_COOKIE = 'webdev_oauth_state'
const SESSION_SECONDS = 30 * 24 * 60 * 60
const STATE_SECONDS = 10 * 60
const isProduction = process.env.NODE_ENV === 'production'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
const projectId = () => process.env.MANUS_PROJECT_ID

function cookieOptions(maxAge, secure) {
  return { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/', maxAge }
}
function setCookie(res, name, value, maxAge, secure) {
  res.cookie(name, value, cookieOptions(maxAge, secure))
}
function clearCookie(res, name, secure) {
  res.clearCookie(name, cookieOptions(0, secure))
}
function parseCookies(req) {
  const result = {}
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=')
    if (index < 1) continue
    const key = part.slice(0, index).trim()
    try { result[key] = decodeURIComponent(part.slice(index + 1).trim()) } catch { /* ignore malformed cookie */ }
  }
  return result
}
function safeOrigin(value) {
  try {
    const url = new URL(value)
    if (url.origin !== value || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    return url.origin
  } catch { return null }
}
function requestHost(req) {
  const forwarded = req.headers['x-forwarded-host']
  const host = Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.headers.host
  return typeof host === 'string' ? host.toLowerCase() : ''
}
function allowedRedirectOrigin(value, req) {
  const origin = safeOrigin(value)
  if (!origin) return null
  const configured = process.env.APP_PUBLIC_ORIGIN
  if (configured) {
    try { if (new URL(configured).origin === origin) return origin } catch { return null }
  }
  if (isProduction) return null
  const url = new URL(origin)
  if (requestHost(req) !== url.host.toLowerCase()) return null
  if (url.protocol === 'https:' && url.hostname.endsWith('.manus.computer')) return origin
  if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return origin
  return null
}
function callbackUrl(origin) {
  return new URL('/api/auth/callback', `${origin}/`).toString()
}

function parsePreviewJwt(token) {
  if (typeof token !== 'string' || token.length > 16384) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  let header, claims, signature
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    signature = Buffer.from(parts[2], 'base64url')
  } catch { return null }
  const secret = process.env.MANUS_JWT_SECRET
  if (!secret || header?.alg !== 'HS256') return null
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest()
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null
  if (!Number.isFinite(claims?.exp) || claims.exp <= Date.now() / 1000 || claims.appId !== projectId()) return null
  const openId = claims.openId ?? claims.open_id ?? claims.sub
  return typeof openId === 'string' && openId.trim() ? { openId: openId.trim() } : null
}

/** Resolves either a verified platform Preview JWT or a hashed application session. */
export async function readCurrentUser(req) {
  const cookies = parseCookies(req)
  const token = cookies[SESSION_COOKIE]
  const previewUser = parsePreviewJwt(token)
  if (previewUser) return previewUser
  if (!token || token.length > 512) return null
  try {
    const session = await getSession(sha256(token))
    return session && typeof session.openId === 'string' && session.openId ? { openId: session.openId } : null
  } catch { return null }
}

/** Validates the browser Origin; Preview origins must match the exact proxied host. */
export function sameOrigin(req) {
  const originHeader = req.headers.origin
  if (typeof originHeader !== 'string') return false
  const origin = safeOrigin(originHeader)
  if (!origin) return false
  const configured = process.env.APP_PUBLIC_ORIGIN
  if (configured) {
    try { if (origin === new URL(configured).origin) return true } catch { return false }
  }
  return allowedRedirectOrigin(origin, req) === origin
}

/** Express middleware requiring a validated application or Preview session. */
export async function requireAuth(req, res, next) {
  const user = await readCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'Entre na sua conta Manus para continuar.' })
  req.user = user
  return next()
}

async function postOAuth(path, body) {
  const base = process.env.MANUS_OAUTH_API_URL
  if (!base) throw new Error('OAuth unavailable')
  const response = await fetch(new URL(path, `${base.replace(/\/$/, '')}/`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error('OAuth unavailable')
  const data = await response.json()
  if (!data || data.error) throw new Error('OAuth unavailable')
  return data
}

function popupHtml(origin, success) {
  const jsonOrigin = JSON.stringify(origin).replaceAll('<', '\\u003c')
  const jsonResult = JSON.stringify({ type: 'planner-auth-complete', success })
  const label = success ? 'Acesso conectado. Você pode fechar esta janela.' : 'Não foi possível concluir o acesso. Feche esta janela e tente novamente.'
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="referrer" content="no-referrer"><title>Autenticação</title></head><body><p>${label}</p><script>try{if(window.opener)window.opener.postMessage(${jsonResult},${jsonOrigin})}catch{}window.close()</script></body></html>`
}
function sendPopup(res, origin, success) {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' })
  return res.status(200).type('html').send(popupHtml(origin, success))
}

/** Mount at /api/auth. Normal sign-in initiation is same-origin POST and returns a URL for a popup. */
export function createAuthRouter() {
  const router = express.Router()

  router.get('/me', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const user = await readCurrentUser(req)
    return res.status(200).json({ authenticated: Boolean(user) })
  })

  router.post('/start', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origem da solicitação inválida.' })
    const origin = allowedRedirectOrigin(req.headers.origin, req)
    const portal = process.env.MANUS_OAUTH_PORTAL_URL
    if (!origin || !portal || !projectId()) return res.status(503).json({ error: 'Login Manus indisponível neste endereço.' })
    try {
      const redirectUri = `${callbackUrl(origin)}?popup=1`
      const nonce = randomToken()
      const state = Buffer.from(JSON.stringify({ redirectUri, nonce })).toString('base64')
      await insertOAuthState({
        stateHash: sha256(state), nonceHash: sha256(nonce), kind: 'manus_oauth', provider: 'manus',
        ownerOpenId: null, origin, redirectUri, expiresAt: new Date(Date.now() + STATE_SECONDS * 1000),
      })
      setCookie(res, STATE_COOKIE, nonce, STATE_SECONDS * 1000, origin.startsWith('https://'))
      const authorize = new URL('/app-auth', `${portal.replace(/\/$/, '')}/`)
      authorize.search = new URLSearchParams({ appId: projectId(), redirectUri, state, responseType: 'code' }).toString()
      return res.status(200).json({ authorizationUrl: authorize.toString() })
    } catch { return res.status(500).json({ error: 'Não foi possível iniciar o login Manus.' }) }
  })

  router.get('/callback', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const stateValue = req.query.state
    const code = req.query.code
    let state = null
    let origin = null
    let redirectUri = null
    try {
      if (typeof stateValue === 'string') state = JSON.parse(Buffer.from(stateValue, 'base64').toString('utf8'))
      redirectUri = typeof state?.redirectUri === 'string' ? new URL(state.redirectUri) : null
      origin = redirectUri?.origin ?? null
    } catch { state = null; origin = null; redirectUri = null }
    const validOrigin = origin && allowedRedirectOrigin(origin, req) === origin
    const expectedUri = validOrigin ? `${callbackUrl(origin)}?popup=1` : null
    const stateCookie = parseCookies(req)[STATE_COOKIE]
    if (!validOrigin || !state || redirectUri.pathname !== '/api/auth/callback' || redirectUri.search !== '?popup=1' || redirectUri.hash || typeof state.nonce !== 'string' || !stateCookie || typeof code !== 'string' || code.length > 4096) {
      clearCookie(res, STATE_COOKIE, Boolean(origin?.startsWith('https://')))
      return validOrigin ? sendPopup(res, origin, false) : res.status(400).type('text').send('Não foi possível concluir o login.')
    }
    let consumed = null
    try { consumed = await consumeOAuthState({ stateHash: sha256(stateValue), kind: 'manus_oauth', provider: 'manus' }) } catch { consumed = null }
    clearCookie(res, STATE_COOKIE, origin.startsWith('https://'))
    const nonceHash = sha256(state.nonce)
    const cookieHash = sha256(stateCookie)
    const nonceMatches = timingSafeEqual(Buffer.from(nonceHash, 'hex'), Buffer.from(cookieHash, 'hex'))
    if (!consumed || !nonceMatches || consumed.nonceHash !== nonceHash || consumed.origin !== origin || consumed.redirectUri !== redirectUri.toString() || consumed.redirectUri !== expectedUri) {
      return sendPopup(res, origin, false)
    }
    try {
      const tokens = await postOAuth('webdev.v1.WebDevAuthPublicService/ExchangeToken', {
        clientId: projectId(), grantType: 'authorization_code', code, redirectUri: consumed.redirectUri,
      })
      if (typeof tokens.accessToken !== 'string' || !tokens.accessToken) throw new Error('OAuth unavailable')
      const identity = await postOAuth('webdev.v1.WebDevAuthPublicService/GetUserInfo', { accessToken: tokens.accessToken })
      if (typeof identity.openId !== 'string' || !identity.openId.trim()) throw new Error('OAuth unavailable')
      const sessionToken = randomToken(48)
      await createSession({ tokenHash: sha256(sessionToken), openId: identity.openId.trim(), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) })
      setCookie(res, SESSION_COOKIE, sessionToken, SESSION_SECONDS * 1000, origin.startsWith('https://'))
      return sendPopup(res, origin, true)
    } catch { return sendPopup(res, origin, false) }
  })

  router.post('/logout', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Origem da solicitação inválida.' })
    const origin = req.headers.origin
    clearCookie(res, SESSION_COOKIE, typeof origin === 'string' && origin.startsWith('https://'))
    const token = parseCookies(req)[SESSION_COOKIE]
    if (token && token.length <= 512 && !parsePreviewJwt(token)) {
      try { await deleteSession(sha256(token)) } catch { /* clear the cookie even if storage is unavailable */ }
    }
    return res.status(200).json({ success: true })
  })

  return router
}
