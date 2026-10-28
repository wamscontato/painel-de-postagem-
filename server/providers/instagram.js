const API = 'https://graph.instagram.com/v26.0';
const AUTHORIZE = 'https://www.instagram.com/oauth/authorize';
const SHORT_TOKEN = 'https://api.instagram.com/oauth/access_token';
const SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'];
const TIMEOUT_MS = 12_000;
const MAX_MEDIA_PAGES = 5;
const MAX_POSTS = 20;
const POST_CONCURRENCY = 4;

export const id = 'instagram';
export const name = 'Instagram';
export const scopes = [...SCOPES];

/** True when the Instagram Login app ID and secret are available. */
export function isConfigured(env = process.env) {
  return Boolean(env.INSTAGRAM_CLIENT_ID && env.INSTAGRAM_CLIENT_SECRET);
}

function credentials(env) {
  const clientId = env?.INSTAGRAM_CLIENT_ID;
  const clientSecret = env?.INSTAGRAM_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Instagram provider is not configured');
  return { clientId, clientSecret };
}

function timedFetch(fetchImpl, url, options = {}) {
  return Promise.resolve()
    .then(() => fetchImpl(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) }))
    .catch(() => { throw new Error('Instagram request failed'); });
}

async function jsonResponse(response) {
  if (!response.ok) throw new Error(`Instagram request failed (${response.status})`);
  try {
    const body = await response.json();
    if (body?.error || body?.error_type) throw new Error('provider');
    return body;
  } catch {
    throw new Error('Instagram returned an invalid response');
  }
}

async function getGraph(path, params, accessToken, fetchImpl) {
  const url = new URL(`${API}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  url.searchParams.set('access_token', accessToken);
  return jsonResponse(await timedFetch(fetchImpl, url));
}

function tokenMetadata(body, fallbackUserId) {
  const expiresIn = Number.isFinite(Number(body.expires_in)) ? Number(body.expires_in) : undefined;
  return {
    accessToken: body.access_token,
    tokenType: body.token_type,
    expiresIn,
    expiresAt: expiresIn === undefined ? undefined : new Date(Date.now() + expiresIn * 1000).toISOString(),
    userId: body.user_id ?? fallbackUserId,
    scopes: typeof body.permissions === 'string'
      ? body.permissions.split(',').map((scope) => scope.trim()).filter(Boolean)
      : undefined,
  };
}

/** Build a Business Login authorization URL for professional accounts. */
export function authorizationUrl({ state, redirectUri, env = process.env }) {
  const { clientId } = credentials(env);
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(','),
    enable_fb_login: 'false',
    ...(state ? { state } : {}),
  });
  return url.toString();
}

/** Exchange the one-time code server-side and upgrade to a long-lived token. */
export async function exchangeCode({ code, redirectUri, env = process.env, fetchImpl = fetch }) {
  const { clientId, clientSecret } = credentials(env);
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  const short = await jsonResponse(await timedFetch(fetchImpl, SHORT_TOKEN, {
    method: 'POST', body: form,
  }));
  const shortToken = short.access_token ?? short.data?.[0]?.access_token;
  const userId = short.user_id ?? short.data?.[0]?.user_id;
  if (!shortToken) throw new Error('Instagram token exchange failed');

  const url = new URL(`${API}/access_token`);
  url.search = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: shortToken,
  });
  const long = await jsonResponse(await timedFetch(fetchImpl, url));
  if (!long.access_token) throw new Error('Instagram long-lived token exchange failed');
  return tokenMetadata(long, userId);
}

/** Refresh an eligible, unexpired long-lived Instagram token. */
export async function refreshTokens({ accessToken, env = process.env, fetchImpl = fetch }) {
  credentials(env);
  const url = new URL(`${API}/refresh_access_token`);
  url.search = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: accessToken });
  return tokenMetadata(await jsonResponse(await timedFetch(fetchImpl, url)));
}

/** Read only identity fields from the authorized professional account. */
export async function fetchAccount({ accessToken, env = process.env, fetchImpl = fetch }) {
  credentials(env);
  const body = await getGraph('me', { fields: 'id,username,name' }, accessToken, fetchImpl);
  return {
    providerAccountId: body.id,
    displayName: body.name,
    handle: body.username,
  };
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function firstValue(metric) {
  return numeric(metric?.total_value?.value ?? metric?.values?.[0]?.value);
}
function seriesValues(metric) {
  const out = new Map();
  for (const point of metric?.values ?? []) {
    const date = point.end_time?.slice(0, 10) ?? point.date;
    const value = numeric(point.value);
    if (date && value !== undefined) out.set(date, value);
  }
  return out;
}

async function listMedia(accountId, accessToken, fetchImpl) {
  const media = [];
  let after;
  let lastPage;
  let pages = 0;
  while (pages < MAX_MEDIA_PAGES) {
    lastPage = await getGraph(`${accountId}/media`, {
      fields: 'id,timestamp,permalink,media_type', limit: 100, ...(after ? { after } : {}),
    }, accessToken, fetchImpl);
    pages += 1;
    media.push(...(lastPage.data ?? []));
    const next = lastPage.paging?.cursors?.after;
    if (!lastPage.paging?.next || !next) break;
    after = next;
  }
  return { media, capped: pages === MAX_MEDIA_PAGES && Boolean(lastPage?.paging?.next) };
}

async function mapLimited(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }));
  return results;
}

/** Return account insights and bounded post counters without fetching captions or media. */
export async function fetchMetrics({ accessToken, providerAccountId, startDate, endDate, env = process.env, fetchImpl = fetch }) {
  credentials(env);
  const accountId = encodeURIComponent(providerAccountId);
  const common = { period: 'day', since: Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000), until: Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000) };
  const [viewsResponse, reachResponse, reachTotalResponse, interactionsResponse, followersResponse, mediaPage] = await Promise.all([
    getGraph(`${accountId}/insights`, { ...common, metric: 'views', metric_type: 'total_value' }, accessToken, fetchImpl),
    getGraph(`${accountId}/insights`, { ...common, metric: 'reach', metric_type: 'time_series' }, accessToken, fetchImpl),
    getGraph(`${accountId}/insights`, { ...common, metric: 'reach', metric_type: 'total_value' }, accessToken, fetchImpl),
    getGraph(`${accountId}/insights`, { ...common, metric: 'total_interactions', metric_type: 'total_value' }, accessToken, fetchImpl),
    getGraph('me', { fields: 'follower_count' }, accessToken, fetchImpl),
    listMedia(accountId, accessToken, fetchImpl),
  ]);

  const viewsMetric = viewsResponse.data?.find((item) => item.name === 'views');
  const reachMetric = reachResponse.data?.find((item) => item.name === 'reach');
  const reachTotalMetric = reachTotalResponse.data?.find((item) => item.name === 'reach');
  const interactionMetric = interactionsResponse.data?.find((item) => item.name === 'total_interactions');
  const reachByDate = seriesValues(reachMetric);
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const daily = [];
  for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    if (reachByDate.has(key)) daily.push({ date: key, reach: reachByDate.get(key) });
  }

  const eligible = mediaPage.media.filter((media) => {
    if (!media.id || !media.timestamp || !media.permalink) return false;
    const day = media.timestamp.slice(0, 10);
    return day >= startDate && day <= endDate && ['IMAGE', 'VIDEO', 'REELS'].includes(media.media_type);
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const selected = eligible.slice(0, MAX_POSTS);
  let failedPostReads = 0;
  const posts = await mapLimited(selected, POST_CONCURRENCY, async (media) => {
    const post = { id: String(media.id), publishedAt: media.timestamp, permalink: media.permalink };
    try {
      const metricNames = media.media_type === 'IMAGE' ? 'reach,total_interactions' : 'views,reach,total_interactions';
      const result = await getGraph(`${encodeURIComponent(media.id)}/insights`, { metric: metricNames }, accessToken, fetchImpl);
      const byName = new Map((result.data ?? []).map((item) => [item.name, item]));
      const views = firstValue(byName.get('views'));
      const interactions = firstValue(byName.get('total_interactions'));
      if (views !== undefined) post.views = views;
      if (interactions !== undefined) post.interactions = interactions;
    } catch { failedPostReads += 1; }
    return post;
  });

  const throughDates = [...reachByDate.keys()].sort();
  const summary = {};
  const values = {
    views: firstValue(viewsMetric), reach: firstValue(reachTotalMetric),
    interactions: firstValue(interactionMetric), followers: numeric(followersResponse.follower_count),
  };
  for (const [key, value] of Object.entries(values)) if (value !== undefined) summary[key] = value;
  const limitations = [
    'Instagram insights may be delayed by up to 48 hours.',
    'Follower count and some insights are unavailable below 100 followers.',
    'Stories and carousel-album media insights are not included; story insights have a 24-hour availability window.',
    'Account views and interactions are period totals; this adapter only receives daily reach points.',
    ...(eligible.length > MAX_POSTS ? [`Only the ${MAX_POSTS} most recent eligible items are included in the per-content table.`] : []),
    ...(mediaPage.capped ? [`Media listing stopped after ${MAX_MEDIA_PAGES} pages; older items may not be represented.`] : []),
    ...(failedPostReads ? [`Per-content insights were unavailable for ${failedPostReads} item(s); their metrics remain blank.`] : []),
  ];
  return {
    summary, daily, posts, limitations,
    coverage: { start: throughDates[0] || startDate, end: endDate, ...(throughDates.length ? { through: throughDates.at(-1) } : {}) },
  };
}

/** Revoke permissions for the currently authorized Instagram user. */
export async function revoke({ accessToken, env = process.env, fetchImpl = fetch }) {
  credentials(env);
  const url = new URL(`${API}/me/permissions`);
  url.searchParams.set('access_token', accessToken);
  const response = await timedFetch(fetchImpl, url, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Instagram request failed (${response.status})`);
  return true;
}
