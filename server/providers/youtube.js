/** YouTube Analytics provider for the authenticated channel; reports are delayed, non-monetary read-only data. */
export const id = 'youtube';
export const name = 'YouTube';
export const scopes = ['https://www.googleapis.com/auth/youtube.readonly'];

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const ANALYTICS_URL = 'https://youtubeanalytics.googleapis.com/v2/reports';
const CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const TIMEOUT_MS = 12_000;
const REPORT_PAGE_SIZE = 200;
const MAX_DAILY_ROWS = 1000;
const MAX_VIDEO_ROWS = 200;
const CHANNEL_METRICS = ['views', 'estimatedMinutesWatched', 'likes', 'comments', 'shares', 'subscribersGained', 'subscribersLost'];
const VIDEO_METRICS = ['views', 'likes', 'comments', 'shares'];
const INTERACTION_METRICS = ['likes', 'comments', 'shares'];

function credentials(env = {}) {
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}
/** True when both server-side Google OAuth client credentials are present. */
export function isConfigured(env = {}) {
  const { clientId, clientSecret } = credentials(env);
  return Boolean(clientId && clientSecret);
}
function requireCredentials(env) {
  const values = credentials(env);
  if (!values.clientId || !values.clientSecret) throw new Error('YouTube is not configured');
  return values;
}
function timeoutSignal() {
  return AbortSignal.timeout(TIMEOUT_MS);
}
async function readJson(response, service = 'YouTube') {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${service} returned an invalid response`);
  }
  if (!response.ok || payload?.error) throw new Error(`${service} request failed`);
  return payload;
}
/** Builds Google's server-side OAuth URL and requests offline access for refresh tokens. */
export function authorizationUrl({ state, redirectUri, env = {} }) {
  const { clientId } = requireCredentials(env);
  if (!state || !redirectUri) throw new Error('YouTube authorization parameters are required');
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString();
  return url.toString();
}
async function tokenRequest(body, env, fetchImpl) {
  const { clientId, clientSecret } = requireCredentials(env);
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
    signal: timeoutSignal(),
  });
  const payload = await readJson(response);
  if (!payload.access_token) throw new Error('YouTube token response is incomplete');
  return payload;
}
/** Exchanges an authorization code server-side; callers should securely persist returned tokens. */
export async function exchangeCode({ code, redirectUri, env = {}, fetchImpl = fetch }) {
  if (!code || !redirectUri) throw new Error('YouTube authorization parameters are required');
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }, env, fetchImpl);
}
/** Refreshes access credentials, preserving the existing refresh token if Google omits rotation. */
export async function refreshTokens({ refreshToken, env = {}, fetchImpl = fetch }) {
  if (!refreshToken) throw new Error('YouTube refresh token is required');
  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken }, env, fetchImpl);
  return { ...tokens, refresh_token: tokens.refresh_token || refreshToken };
}
function requireAccessToken(accessToken) {
  if (!accessToken) throw new Error('YouTube access token is required');
}
async function apiGet(url, accessToken, fetchImpl, service = 'YouTube') {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: timeoutSignal(),
  });
  return readJson(response, service);
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function analyticsUrl({ startDate, endDate, metrics, dimensions, startIndex, maxResults }) {
  const url = new URL(ANALYTICS_URL);
  url.search = new URLSearchParams({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: metrics.join(','),
    dimensions,
    sort: dimensions,
    startIndex: String(startIndex),
    maxResults: String(maxResults),
  }).toString();
  return url;
}
async function report({ accessToken, startDate, endDate, metrics, dimensions, fetchImpl, maxRows = MAX_DAILY_ROWS }) {
  const combined = { columnHeaders: [], rows: [], rowCount: undefined, truncated: false };
  let startIndex = 1;
  while (combined.rows.length < maxRows) {
    const maxResults = Math.min(REPORT_PAGE_SIZE, maxRows - combined.rows.length);
    const page = await apiGet(analyticsUrl({ startDate, endDate, metrics, dimensions, startIndex, maxResults }), accessToken, fetchImpl, 'YouTube Analytics');
    if (startIndex === 1) combined.columnHeaders = Array.isArray(page.columnHeaders) ? page.columnHeaders : [];
    const rows = Array.isArray(page.rows) ? page.rows : [];
    if (Number.isSafeInteger(page.rowCount) && page.rowCount >= 0) combined.rowCount = page.rowCount;
    combined.rows.push(...rows);
    const reachedExpectedRows = combined.rowCount !== undefined && combined.rows.length >= combined.rowCount;
    const endOfUnknownRows = combined.rowCount === undefined && rows.length < maxResults;
    if (!rows.length || reachedExpectedRows || endOfUnknownRows) break;
    startIndex += rows.length;
  }
  combined.truncated = combined.rowCount !== undefined && combined.rowCount > combined.rows.length;
  return combined;
}
function rowObjects(payload) {
  const headers = (payload.columnHeaders ?? []).map((column) => column.name);
  return (payload.rows ?? []).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}
function addMetric(target, source, metric) {
  if (typeof source?.[metric] === 'number' && Number.isFinite(source[metric]) && source[metric] >= 0) {
    target[metric] = (target[metric] ?? 0) + source[metric];
  }
}
function interactionsFrom(source) {
  const values = INTERACTION_METRICS.filter((metric) => typeof source?.[metric] === 'number' && Number.isFinite(source[metric])).map((metric) => source[metric]);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
}
function mapDaily(payload) {
  return rowObjects(payload).flatMap((row) => {
    const date = row.day ?? row.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const item = { date };
    if (typeof row.views === 'number' && Number.isFinite(row.views)) item.views = row.views;
    for (const metric of ['estimatedMinutesWatched', 'subscribersGained', 'subscribersLost']) {
      if (typeof row[metric] === 'number' && Number.isFinite(row[metric]) && row[metric] >= 0) item[metric] = row[metric];
    }
    const interactions = interactionsFrom(row);
    if (interactions !== undefined) item.interactions = interactions;
    return [item];
  });
}
function mapPosts(payload) {
  return rowObjects(payload).flatMap((row) => {
    if (!row.video) return [];
    const item = { id: String(row.video) };
    const interactions = interactionsFrom(row);
    if (typeof row.views === 'number' && Number.isFinite(row.views)) item.views = row.views;
    if (interactions !== undefined) item.interactions = interactions;
    item.permalink = `https://www.youtube.com/watch?v=${encodeURIComponent(String(row.video))}`;
    return [item];
  });
}
async function addPublishedDates(posts, accessToken, fetchImpl) {
  for (let offset = 0; offset < posts.length; offset += 50) {
    const batch = posts.slice(offset, offset + 50);
    const url = new URL(VIDEOS_URL);
    url.search = new URLSearchParams({
      part: 'snippet',
      id: batch.map((post) => post.id).join(','),
      fields: 'items(id,snippet(publishedAt))',
    }).toString();
    const payload = await apiGet(url, accessToken, fetchImpl, 'YouTube Data API');
    const dates = new Map((payload.items ?? []).map((video) => [video.id, video.snippet?.publishedAt]));
    for (const post of batch) {
      const publishedAt = dates.get(post.id);
      if (typeof publishedAt === 'string') post.publishedAt = publishedAt;
    }
  }
}
function sumDaily(daily, metric) {
  let total;
  for (const day of daily) {
    if (typeof day[metric] === 'number' && Number.isFinite(day[metric])) total = (total ?? 0) + day[metric];
  }
  return total;
}
/** Retrieves the authenticated channel's read-only identity and statistics snapshot. */
export async function fetchAccount({ accessToken, env = {}, fetchImpl = fetch }) {
  void env;
  requireAccessToken(accessToken);
  const url = new URL(CHANNELS_URL);
  url.search = new URLSearchParams({ part: 'id,snippet,statistics', mine: 'true' }).toString();
  const payload = await apiGet(url, accessToken, fetchImpl, 'YouTube Data API');
  const channel = payload.items?.[0];
  if (!channel) return {};
  const account = { id: channel.id };
  if (typeof channel.snippet?.title === 'string') account.name = channel.snippet.title;
  if (!channel.statistics?.hiddenSubscriberCount && channel.statistics?.subscriberCount !== undefined) {
    const followers = Number(channel.statistics.subscriberCount);
    if (Number.isFinite(followers)) account.followers = followers;
  }
  return account;
}
/** Returns channel daily reports and compatible per-video totals without titles or reach. */
export async function fetchMetrics({ accessToken, providerAccountId, startDate, endDate, env = {}, fetchImpl = fetch }) {
  void providerAccountId;
  void env;
  requireAccessToken(accessToken);
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    throw new Error('A valid YouTube date range is required');
  }
  const limitations = ['O YouTube Analytics pode atrasar 48–72 horas; a última data retornada pode ser anterior à solicitada.', 'O relatório não fornece alcance; métricas e datas ausentes permanecem indisponíveis, não zero.'];
  const dailyPayload = await report({ accessToken, startDate, endDate, metrics: CHANNEL_METRICS, dimensions: 'day', fetchImpl });
  const daily = mapDaily(dailyPayload);
  let partialCoverage = dailyPayload.truncated;
  if (dailyPayload.truncated) limitations.push('A resposta diária ultrapassou o limite seguro de paginação; a cobertura é parcial.');
  const posts = [];
  try {
    const postPayload = await report({ accessToken, startDate, endDate, metrics: VIDEO_METRICS, dimensions: 'video', fetchImpl, maxRows: MAX_VIDEO_ROWS });
    posts.push(...mapPosts(postPayload));
    if (postPayload.truncated) {
      partialCoverage = true;
      limitations.push('A consulta de vídeos foi limitada a 200 registros para proteger a API; outros vídeos podem não aparecer nesta tabela.');
    }
    await addPublishedDates(posts, accessToken, fetchImpl);
  } catch {
    limitations.push('O relatório por vídeo não está disponível para esta conta ou combinação de métricas; os dados diários do canal foram mantidos.');
  }
  let account = {};
  try {
    account = await fetchAccount({ accessToken, env, fetchImpl });
  } catch {
    limitations.push('A contagem atual de inscritos não está disponível.');
  }
  const summary = {};
  for (const metric of ['views', 'estimatedMinutesWatched', 'interactions', 'subscribersGained', 'subscribersLost']) {
    const total = sumDaily(daily, metric);
    if (total !== undefined) summary[metric] = total;
  }
  if (typeof account.followers === 'number') summary.followers = account.followers;
  const through = daily.reduce((latest, item) => item.date > latest ? item.date : latest, '');
  const from = daily.reduce((earliest, item) => !earliest || item.date < earliest ? item.date : earliest, '');
  return {
    summary,
    daily,
    posts,
    limitations,
    coverage: { start: from || startDate, end: endDate, ...(through ? { through } : {}), ...(partialCoverage ? { partial: true } : {}) },
  };
}
/** Revokes the supplied access token using Google's OAuth revocation endpoint. */
export async function revoke({ accessToken, env = {}, fetchImpl = fetch }) {
  requireCredentials(env);
  requireAccessToken(accessToken);
  const response = await fetchImpl(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: accessToken }),
    signal: timeoutSignal(),
  });
  if (!response.ok) throw new Error('YouTube token revocation failed');
  return { success: true };
}
