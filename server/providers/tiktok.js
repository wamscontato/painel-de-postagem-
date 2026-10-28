/** TikTok Login Kit + Display API provider; public video counters are current lifetime totals. */
export const id = 'tiktok';
export const name = 'TikTok';
export const scopes = ['user.info.basic', 'user.info.stats', 'video.list'];

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const REVOKE_URL = 'https://open.tiktokapis.com/v2/oauth/revoke/';
const USER_URL = 'https://open.tiktokapis.com/v2/user/info/';
const VIDEOS_URL = 'https://open.tiktokapis.com/v2/video/list/';
const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIMEOUT_MS = 12_000;
const PAGE_SIZE = 20;
const MAX_VIDEOS = 1_000;

function credentials(env = {}) {
  return {
    clientKey: env.TIKTOK_CLIENT_KEY,
    clientSecret: env.TIKTOK_CLIENT_SECRET,
  };
}

/** Indicates whether both TikTok app credentials are configured. */
export function isConfigured(env = {}) {
  const { clientKey, clientSecret } = credentials(env);
  return Boolean(clientKey && clientSecret);
}

/** Builds the Login Kit authorization URL for a registered HTTPS callback. */
export function authorizationUrl({ state, redirectUri, env = {} }) {
  const { clientKey } = credentials(env);
  if (!clientKey) throw new Error('TikTok is not configured');
  if (!state || !redirectUri) throw new Error('TikTok authorization parameters are required');
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: scopes.join(','),
    redirect_uri: redirectUri,
    state,
  }).toString();
  return url.toString();
}

function timeoutSignal() {
  return AbortSignal.timeout(TIMEOUT_MS);
}

async function readJson(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('TikTok returned an invalid response');
  }
  if (!response.ok || payload?.error?.code && payload.error.code !== 'ok') {
    // Do not expose provider response bodies, which may contain sensitive data.
    throw new Error('TikTok request failed');
  }
  return payload;
}

async function tokenRequest(body, env, fetchImpl) {
  const { clientKey, clientSecret } = credentials(env);
  if (!clientKey || !clientSecret) throw new Error('TikTok is not configured');
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, ...body }),
    signal: timeoutSignal(),
  });
  const payload = await readJson(response);
  if (!payload.data?.access_token) throw new Error('TikTok token response is incomplete');
  return payload.data;
}

/** Exchanges an authorization code server-side; callers must persist rotated refresh tokens. */
export async function exchangeCode({ code, redirectUri, env = {}, fetchImpl = fetch }) {
  if (!code || !redirectUri) throw new Error('TikTok authorization parameters are required');
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }, env, fetchImpl);
}

/** Refreshes access credentials and returns any newly rotated refresh token. */
export async function refreshTokens({ refreshToken, env = {}, fetchImpl = fetch }) {
  if (!refreshToken) throw new Error('TikTok refresh token is required');
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken }, env, fetchImpl);
}

async function apiGet(url, accessToken, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: timeoutSignal(),
  });
  return readJson(response);
}

function requireAccessToken(accessToken) {
  if (!accessToken) throw new Error('TikTok access token is required');
}

/** Retrieves only approved profile totals and the authorized user's public video data. */
export async function fetchAccount({ accessToken, env = {}, fetchImpl = fetch }) {
  void env;
  requireAccessToken(accessToken);
  const url = new URL(USER_URL);
  url.searchParams.set('fields', 'open_id,avatar_url,follower_count,following_count,likes_count,video_count');
  const payload = await apiGet(url, accessToken, fetchImpl);
  return payload.data?.user ?? {};
}

function dateFromUnix(seconds) {
  const date = new Date(Number(seconds) * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Returns lifetime video counters for posts published in the selected date window; never a daily series. */
export async function fetchMetrics({ accessToken, providerAccountId, startDate, endDate, env = {}, fetchImpl = fetch }) {
  void env;
  requireAccessToken(accessToken);
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    throw new Error('A valid TikTok date range is required');
  }
  const posts = [];
  let cursor;
  let hasMore = true;
  let reachedOlderPosts = false;
  let cappedByLimit = false;

  while (hasMore && posts.length < MAX_VIDEOS && !reachedOlderPosts) {
    const url = new URL(VIDEOS_URL);
    url.searchParams.set('fields', 'id,create_time,share_url,view_count,like_count,comment_count,share_count');
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_count: PAGE_SIZE, ...(cursor !== undefined ? { cursor } : {}) }),
      signal: timeoutSignal(),
    });
    const payload = await readJson(response);
    const data = payload.data ?? {};
    for (const video of data.videos ?? []) {
      const publishedAt = dateFromUnix(video.create_time);
      if (!publishedAt) continue;
      if (publishedAt < startDate) {
        reachedOlderPosts = true;
        break;
      }
      if (publishedAt > endDate) continue;
      if (!video.id) continue;
      const post = { id: String(video.id), publishedAt };
      if (Number.isFinite(video.view_count) && video.view_count >= 0) post.views = video.view_count;
      const counts = [video.like_count, video.comment_count, video.share_count].filter((value) => Number.isFinite(value) && value >= 0);
      if (counts.length) post.interactions = counts.reduce((sum, value) => sum + value, 0);
      if (typeof video.share_url === 'string' && video.share_url) post.permalink = video.share_url;
      posts.push(post);
      if (posts.length >= MAX_VIDEOS) { cappedByLimit = Boolean(data.has_more); break; }
    }
    hasMore = Boolean(data.has_more);
    cursor = data.cursor;
    if (hasMore && cursor === undefined) throw new Error('TikTok pagination response is incomplete');
  }

  const profile = await fetchAccount({ accessToken, env, fetchImpl });
  const summary = {};
  const viewCounts = posts.map((post) => post.views).filter(Number.isFinite);
  const interactionCounts = posts.map((post) => post.interactions).filter(Number.isFinite);
  if (viewCounts.length) summary.views = viewCounts.reduce((sum, count) => sum + count, 0);
  if (interactionCounts.length) summary.interactions = interactionCounts.reduce((sum, count) => sum + count, 0);
  if (Number.isFinite(profile.follower_count) && profile.follower_count >= 0) summary.followers = profile.follower_count;
  return {
    summary,
    daily: [],
    posts,
    limitations: [
      'As contagens por vídeo (visualizações, curtidas, comentários e compartilhamentos) são totais acumulados até o momento da leitura, não representam atividade somente no intervalo selecionado.',
      'As interações somam curtidas, comentários e compartilhamentos disponíveis dos vídeos publicados na janela de datas escolhida.',
      'Esses endpoints não fornecem série histórica diária nem alcance; contagens ausentes permanecem indisponíveis.',
      ...(cappedByLimit ? [`O limite de ${MAX_VIDEOS} vídeos foi atingido; vídeos públicos mais antigos podem não aparecer.`] : []),
    ],
    coverage: { start: startDate, end: endDate, ...(cappedByLimit ? { partial: true } : {}) },
  };
}

/** Revokes the supplied access token using the Login Kit token-management endpoint. */
export async function revoke({ accessToken, env = {}, fetchImpl = fetch }) {
  const { clientKey, clientSecret } = credentials(env);
  requireAccessToken(accessToken);
  if (!clientKey || !clientSecret) throw new Error('TikTok is not configured');
  const response = await fetchImpl(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, token: accessToken }),
    signal: timeoutSignal(),
  });
  await readJson(response);
  return { success: true };
}
