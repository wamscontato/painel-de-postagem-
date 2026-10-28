import test from 'node:test'
import assert from 'node:assert/strict'
import { decryptToken, encryptToken, isEncryptionConfigured } from '../crypto.js'
import * as instagram from '../providers/instagram.js'
import * as tiktok from '../providers/tiktok.js'
import * as youtube from '../providers/youtube.js'

const ok = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload })
const unix = (value) => Math.floor(Date.parse(`${value}T12:00:00Z`) / 1000)

function readOnlyScopes() {
  const env = {
    INSTAGRAM_CLIENT_ID: 'demo-instagram-id',
    INSTAGRAM_CLIENT_SECRET: 'demo-instagram-secret',
    TIKTOK_CLIENT_KEY: 'demo-tiktok-key',
    TIKTOK_CLIENT_SECRET: 'demo-tiktok-secret',
    GOOGLE_CLIENT_ID: 'demo-google-id',
    GOOGLE_CLIENT_SECRET: 'demo-google-secret',
  }
  const redirectUri = 'https://planner.example.test/api/oauth/provider/callback'
  const urls = [
    new URL(instagram.authorizationUrl({ state: 'state', redirectUri, env })),
    new URL(tiktok.authorizationUrl({ state: 'state', redirectUri, env })),
    new URL(youtube.authorizationUrl({ state: 'state', redirectUri, env })),
  ]
  return urls
}

test('provider authorization requests only the documented read scopes', () => {
  const [ig, tt, yt] = readOnlyScopes()
  assert.deepEqual(ig.searchParams.get('scope').split(','), ['instagram_business_basic', 'instagram_business_manage_insights'])
  assert.deepEqual(tt.searchParams.get('scope').split(','), ['user.info.basic', 'user.info.stats', 'video.list'])
  assert.equal(yt.searchParams.get('scope'), 'https://www.googleapis.com/auth/youtube.readonly')
  assert.equal(yt.searchParams.get('access_type'), 'offline')
  assert.equal(yt.searchParams.get('prompt'), 'consent')
  for (const url of [ig, tt, yt]) assert.doesNotMatch(url.search, /publish|manage_posts|upload|write/i)
})

test('social access tokens are AES-GCM encrypted and tampering is rejected', () => {
  const key = Buffer.alloc(32, 7).toString('base64')
  const env = { SOCIAL_TOKEN_ENCRYPTION_KEY: key }
  assert.equal(isEncryptionConfigured(env), true)
  assert.equal(isEncryptionConfigured({ SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(31, 7).toString('base64') }), false)
  const ciphertext = encryptToken('provider-token-test-value', env)
  assert.equal(ciphertext.includes('provider-token-test-value'), false)
  assert.equal(decryptToken(ciphertext, env), 'provider-token-test-value')
  const [version, iv, tag, data] = ciphertext.split('.')
  const changedTag = `${tag[0] === 'A' ? 'B' : 'A'}${tag.slice(1)}`
  assert.throws(() => decryptToken([version, iv, changedTag, data].join('.'), env))
})

test('Instagram omits metrics the API does not return and does not fill missing days', async () => {
  const calls = []
  const fetchImpl = async (input) => {
    const url = new URL(input)
    calls.push(url)
    if (url.pathname.endsWith('/media')) return ok({ data: [{ id: 'post-1', timestamp: '2026-02-02T12:00:00+0000', permalink: 'https://www.instagram.com/p/example/', media_type: 'VIDEO' }] })
    if (url.pathname.endsWith('/post-1/insights')) return ok({ data: [{ name: 'views', total_value: { value: 6 } }, { name: 'total_interactions', total_value: { value: 4 } }] })
    if (url.pathname.endsWith('/me') && url.searchParams.get('fields') === 'follower_count') return ok({ follower_count: 140 })
    if (url.pathname.endsWith('/insights')) {
      const metric = url.searchParams.get('metric')
      if (metric === 'views') return ok({ data: [] })
      if (metric === 'reach' && url.searchParams.get('metric_type') === 'time_series') return ok({ data: [{ name: 'reach', values: [{ end_time: '2026-02-02T23:59:59+0000', value: 9 }] }] })
      if (metric === 'reach') return ok({ data: [{ name: 'reach', total_value: { value: 9 } }] })
      if (metric === 'total_interactions') return ok({ data: [{ name: 'total_interactions', total_value: { value: 4 } }] })
    }
    throw new Error('Unexpected mocked Instagram request')
  }
  const result = await instagram.fetchMetrics({
    accessToken: 'not-a-real-token', providerAccountId: 'account-1', startDate: '2026-02-01', endDate: '2026-02-03',
    env: { INSTAGRAM_CLIENT_ID: 'id', INSTAGRAM_CLIENT_SECRET: 'secret' }, fetchImpl,
  })
  assert.equal(Object.hasOwn(result.summary, 'views'), false)
  assert.equal(result.summary.reach, 9)
  assert.equal(result.summary.followers, 140)
  assert.deepEqual(result.daily, [{ date: '2026-02-02', reach: 9 }])
  assert.equal(result.coverage.start, '2026-02-02')
  assert.equal(result.posts[0].views, 6)
  assert.equal(result.posts[0].interactions, 4)
  assert.ok(calls.every((url) => url.searchParams.get('access_token') === 'not-a-real-token'))
})

test('TikTok returns publication-window lifetime totals without manufacturing a daily series', async () => {
  let videoPage = 0
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/video/list/')) {
      videoPage += 1
      if (videoPage === 1) return ok({ data: { videos: [
        { id: 'v1', create_time: unix('2026-02-10'), view_count: 100, like_count: 5, comment_count: 2, share_count: 1, share_url: 'https://www.tiktok.com/@user/video/v1' },
        { id: 'v2', create_time: unix('2026-02-05'), view_count: 50, like_count: 2, comment_count: 1, share_count: 0 },
      ], has_more: true, cursor: 'next' } })
      return ok({ data: { videos: [{ id: 'older', create_time: unix('2026-01-20'), view_count: 999 }], has_more: true, cursor: 'older' } })
    }
    if (url.pathname.endsWith('/user/info/')) return ok({ data: { user: { open_id: 'provider-user', follower_count: 30 } } })
    throw new Error(`Unexpected mocked TikTok request: ${options.method || 'GET'}`)
  }
  const result = await tiktok.fetchMetrics({
    accessToken: 'not-a-real-token', providerAccountId: 'provider-user', startDate: '2026-02-01', endDate: '2026-02-28', fetchImpl,
  })
  assert.equal(result.summary.views, 150)
  assert.equal(result.summary.interactions, 11)
  assert.equal(result.summary.followers, 30)
  assert.deepEqual(result.daily, [])
  assert.equal(result.posts.length, 2)
  assert.equal(result.coverage.through, undefined)
  assert.match(result.limitations[0], /totais acumulados/)
})

test('TikTok marks coverage partial when the bounded video list still has another page', async () => {
  let page = 0
  const fetchImpl = async (input) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/video/list/')) {
      page += 1
      const videos = Array.from({ length: 20 }, (_, index) => ({ id: `v-${page}-${index}`, create_time: unix('2026-02-10'), view_count: 1, like_count: 1, comment_count: 0, share_count: 0 }))
      return ok({ data: { videos, has_more: true, cursor: String(page) } })
    }
    if (url.pathname.endsWith('/user/info/')) return ok({ data: { user: { follower_count: 1 } } })
    throw new Error('Unexpected mocked TikTok request')
  }
  const result = await tiktok.fetchMetrics({ accessToken: 'not-a-real-token', startDate: '2026-02-01', endDate: '2026-02-28', fetchImpl })
  assert.equal(result.posts.length, 1000)
  assert.equal(result.coverage.partial, true)
  assert.ok(result.limitations.some((note) => note.includes('limite de 1000 vídeos foi atingido')))
})

test('YouTube paginates short Analytics pages and reports only observed daily dates', async () => {
  const requests = []
  const columns = ['day', 'views', 'estimatedMinutesWatched', 'likes', 'comments', 'shares', 'subscribersGained', 'subscribersLost']
  const fetchImpl = async (input) => {
    const url = new URL(input)
    requests.push(url)
    if (url.hostname === 'youtubeanalytics.googleapis.com') {
      if (url.searchParams.get('dimensions') === 'day') {
        if (url.searchParams.get('startIndex') === '1') return ok({ columnHeaders: columns.map((name) => ({ name })), rows: [['2026-02-01', 10, 1.5, 2, 1, 1, 1, 0]], rowCount: 2 })
        return ok({ columnHeaders: columns.map((name) => ({ name })), rows: [['2026-02-02', 20, 2.5, 3, 0, 1, 2, 1]], rowCount: 2 })
      }
      return ok({ columnHeaders: ['video', 'views', 'likes', 'comments', 'shares'].map((name) => ({ name })), rows: [['video-1', 10, 2, 1, 1]], rowCount: 1 })
    }
    if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/videos')) return ok({ items: [{ id: 'video-1', snippet: { publishedAt: '2026-02-01T12:00:00Z' } }] })
    if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/channels')) return ok({ items: [{ id: 'channel-1', snippet: { title: 'Canal de teste' }, statistics: { hiddenSubscriberCount: false, subscriberCount: '24' } }] })
    throw new Error(`Unexpected mocked YouTube request: ${url.toString()}`)
  }
  const result = await youtube.fetchMetrics({ accessToken: 'not-a-real-token', startDate: '2026-01-30', endDate: '2026-02-28', fetchImpl })
  assert.equal(requests.filter((url) => url.hostname === 'youtubeanalytics.googleapis.com' && url.searchParams.get('dimensions') === 'day').length, 2)
  assert.equal(result.summary.views, 30)
  assert.equal(result.summary.interactions, 8)
  assert.equal(result.summary.followers, 24)
  assert.deepEqual(result.daily.map((point) => point.date), ['2026-02-01', '2026-02-02'])
  assert.equal(result.coverage.start, '2026-02-01')
  assert.equal(result.coverage.through, '2026-02-02')
  assert.equal(result.posts[0].publishedAt, '2026-02-01T12:00:00Z')
  assert.ok(requests.every((url) => url.hostname !== 'youtubeanalytics.googleapis.com' || url.searchParams.get('ids') === 'channel==MINE'))
})

test('YouTube leaves absent metrics and empty series absent instead of substituting zeroes', async () => {
  const fetchImpl = async (input) => {
    const url = new URL(input)
    if (url.hostname === 'youtubeanalytics.googleapis.com') {
      if (url.searchParams.get('dimensions') === 'day') return ok({ columnHeaders: [{ name: 'day' }, { name: 'views' }], rows: [], rowCount: 0 })
      return ok({ columnHeaders: [{ name: 'video' }, { name: 'views' }], rows: [], rowCount: 0 })
    }
    if (url.pathname.endsWith('/channels')) return ok({ items: [{ id: 'channel-1', snippet: { title: 'Canal de teste' }, statistics: { hiddenSubscriberCount: true } }] })
    throw new Error('Unexpected mock request')
  }
  const result = await youtube.fetchMetrics({ accessToken: 'not-a-real-token', startDate: '2026-02-01', endDate: '2026-02-28', fetchImpl })
  assert.deepEqual(result.daily, [])
  assert.deepEqual(result.posts, [])
  assert.equal(Object.hasOwn(result.summary, 'views'), false)
  assert.equal(Object.hasOwn(result.summary, 'followers'), false)
  assert.equal(result.coverage.through, undefined)
})
