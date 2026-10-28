export type ProviderId = 'instagram' | 'tiktok' | 'youtube'
export type ProviderFilter = 'Todas' | ProviderId

export type ProviderStatus = {
  id: ProviderId
  name: string
  scopes: string[]
  configured: boolean
  ready: boolean
  callbackUri: string | null
  eligibility: string
}

export type IntegrationsStatus = {
  publicOrigin: string | null
  encryptionReady: boolean
  policyReady: boolean
  dataControllerContact: string | null
  providers: ProviderStatus[]
}

export type SocialConnection = {
  id: string
  provider: ProviderId
  displayName?: string | null
  handle?: string | null
  scope?: string | null
  expiresAt?: string | null
  refreshExpiresAt?: string | null
  status: string
  lastSyncedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type MetricPoint = { date: string; [metric: string]: string | number | undefined }
export type MetricPost = {
  id: string
  title?: string
  publishedAt?: string
  permalink?: string
  views?: number
  interactions?: number
}
export type MetricComparison = {
  status: 'ready' | 'unavailable' | 'not_applicable'
  range?: { startDate: string; endDate: string }
  summary?: Record<string, number>
  error?: string
}
export type AccountMetrics = {
  account: { id: string; provider: ProviderId; displayName?: string | null; handle?: string | null }
  summary: Record<string, number>
  daily: MetricPoint[]
  posts: MetricPost[]
  limitations: string[]
  coverage: { start: string; end: string; through?: string; partial?: boolean }
  fetchedAt?: string
  stale?: boolean
  status: 'ready' | 'error'
  error?: string
  comparison?: MetricComparison
}
export type MetricsSyncResponse = {
  status: 'empty' | 'ready' | 'partial' | 'error'
  range: { startDate: string; endDate: string }
  generatedAt: string
  platforms: AccountMetrics[]
  notice?: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Calls only the application's same-origin API and never stores returned credentials. */
export async function apiJson<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  if (!path.startsWith('/api/') || path.startsWith('//')) throw new Error('Rota de API inválida.')
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Requested-With', 'XMLHttpRequest')
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  let response: Response
  try {
    response = await fetch(path, { ...init, body, headers, credentials: 'same-origin', cache: 'no-store' })
  } catch {
    throw new ApiError('Não foi possível alcançar o serviço de métricas.', 0)
  }
  let payload: unknown
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error : 'Não foi possível concluir a solicitação.'
    throw new ApiError(message, response.status)
  }
  return payload as T
}

type AuthorizationResponse = { authorizationUrl: string }

/** Opens the popup synchronously, then navigates only to an HTTPS OAuth authorization URL. */
export async function beginOAuthPopup(endpoint: string): Promise<void> {
  const popup = window.open('about:blank', 'planejador-oauth', 'popup,width=560,height=720,resizable=yes,scrollbars=yes')
  if (!popup) throw new Error('Permita a abertura de pop-ups para conectar uma conta com segurança.')
  try {
    const result = await apiJson<AuthorizationResponse>(endpoint, { method: 'POST', json: {} })
    const destination = new URL(result.authorizationUrl)
    if (destination.protocol !== 'https:' || !destination.hostname) throw new Error('Destino de autenticação inválido.')
    popup.location.replace(destination.toString())
  } catch (error) {
    popup.close()
    throw error
  }
}

export type OAuthCompletionMessage = {
  type: 'planner-auth-complete' | 'planner-oauth-complete'
  success: boolean
  provider?: ProviderId
  message?: string
}

/** Accepts completion only from a different window on this exact origin. */
export function listenForOAuthCompletion(callback: (payload: OAuthCompletionMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source === window || !event.data || typeof event.data !== 'object') return
    const data = event.data as Partial<OAuthCompletionMessage>
    if ((data.type === 'planner-auth-complete' || data.type === 'planner-oauth-complete') && typeof data.success === 'boolean') {
      callback(data as OAuthCompletionMessage)
    }
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
