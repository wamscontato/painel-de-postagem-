import express from 'express'
import { fileURLToPath } from 'node:url'
import { cleanupExpired, runMigrations } from './db.js'
import { createAuthRouter } from './auth.js'
import { createSocialRouter } from './social-routes.js'

const app = express()
const root = fileURLToPath(new URL('../dist/', import.meta.url))
const indexFile = fileURLToPath(new URL('../dist/index.html', import.meta.url))

app.disable('x-powered-by')
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')
  next()
})
app.use(express.json({ limit: '32kb', strict: true }))

// Readiness is intentionally cheap and unauthenticated; database boot must not block the listener.
app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok' }))

const databaseReady = runMigrations()
  .then(() => true)
  .catch(() => {
    console.error('Managed database initialization failed.')
    return false
  })

async function maintainExpiredRecords() {
  try { await cleanupExpired() }
  catch { console.error('Managed data-retention cleanup failed.') }
}
void databaseReady.then((ready) => { if (ready) void maintainExpiredRecords() })
const retentionTimer = setInterval(() => {
  void databaseReady.then((ready) => { if (ready) return maintainExpiredRecords() })
}, 24 * 60 * 60 * 1000)
retentionTimer.unref()

app.use('/api', async (req, res, next) => {
  if (req.path === '/health' || req.path === '/integrations/status' || req.path === '/auth/me') return next()
  try {
    if (await databaseReady) return next()
    return res.status(503).json({ error: 'O serviço de dados ainda não está disponível.' })
  } catch {
    return res.status(503).json({ error: 'O serviço de dados ainda não está disponível.' })
  }
})
app.use('/api/auth', createAuthRouter())
app.use('/api', createSocialRouter())
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota de API não encontrada.' }))

app.use(express.static(root, {
  index: 'index.html',
  setHeaders(res, path) {
    if (path.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    else res.setHeader('Cache-Control', 'no-cache')
  },
}))

app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.accepts('html')) return next()
  res.setHeader('Cache-Control', 'no-cache')
  return res.sendFile(indexFile, (error) => { if (error) next(error) })
})

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Rota de API não encontrada.' })
  return res.status(404).type('text').send('Página não encontrada.')
})

app.use((error, req, res, _next) => {
  if (res.headersSent) return
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Não foi possível concluir a solicitação.' })
  return res.status(500).type('text').send('Não foi possível abrir esta página.')
})

const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const server = app.listen(port, host, () => console.log(`Application server listening on ${host}:${port}`))
server.requestTimeout = 30_000
server.headersTimeout = 35_000
