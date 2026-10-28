import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Server-only persistence for OAuth state, sessions, social connections, and metric snapshots.
 * Dates are written/read as UTC JavaScript Date values; configure DATABASE_URL in the server
 * environment. The pool is created on first database operation and is not created at import.
 */
let poolPromise;

function connectionOptions(dsn) {
  let url;
  try { url = new URL(dsn); } catch { throw new Error('DATABASE_URL is invalid'); }
  if (url.protocol !== 'mysql:' || !url.hostname || !url.pathname.slice(1)) throw new Error('DATABASE_URL is invalid');
  let user, password, database;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch { throw new Error('DATABASE_URL is invalid'); }
  const sslValue = url.searchParams.get('ssl');
  const ssl = sslValue === 'false' || sslValue === '0' ? undefined : { minVersion: 'TLSv1.2' };
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    timezone: 'Z',
    charset: 'utf8mb4',
    ...(ssl ? { ssl } : {}),
  };
}

function pool() {
  if (!poolPromise) {
    const dsn = process.env.DATABASE_URL;
    if (!dsn) throw new Error('DATABASE_URL is required');
    poolPromise = Promise.resolve().then(() => mysql.createPool(connectionOptions(dsn)));
  }
  return poolPromise;
}

const safeError = (message) => new Error(message);
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Run unapplied numbered SQL migrations and record completion only after success. */
export async function runMigrations() {
  const db = await pool();
  await db.query(`CREATE TABLE IF NOT EXISTS cp_schema_migrations (
    version VARCHAR(64) NOT NULL PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB`);
  const [rows] = await db.execute('SELECT version FROM cp_schema_migrations WHERE version = ?', ['001_social_metrics']);
  if (rows.length) return;
  const migrationPath = fileURLToPath(new URL('./migrations/001_social_metrics.sql', import.meta.url));
  try {
    const contents = await readFile(migrationPath, 'utf8');
    const statements = contents.replace(/^\s*--.*$/gm, '').split(';').map((sql) => sql.trim()).filter(Boolean);
    for (const statement of statements) await db.query(statement);
    await db.execute('INSERT INTO cp_schema_migrations (version) VALUES (?)', ['001_social_metrics']);
  } catch {
    throw safeError('Database migration failed');
  }
}

/** Insert OAuth state, storing only supplied hashes; resolves after the row is persisted. */
export async function insertOAuthState({ stateHash, nonceHash, kind, provider, ownerOpenId, origin, redirectUri, expiresAt }) {
  try {
    const db = await pool();
    await db.execute(`INSERT INTO cp_oauth_states
      (state_hash, nonce_hash, kind, provider, owner_open_id, origin, redirect_uri, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [stateHash, nonceHash, kind, provider, ownerOpenId, origin, redirectUri, expiresAt]);
  } catch { throw safeError('Could not store OAuth state'); }
}

/** Atomically consume a matching unexpired OAuth state once; returns safe fields or null. */
export async function consumeOAuthState({ stateHash, kind, provider }) {
  const db = await pool();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(`SELECT nonce_hash, kind, provider, owner_open_id, origin, redirect_uri, expires_at
      FROM cp_oauth_states WHERE state_hash = ? AND kind = ? AND provider = ? AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE`,
    [stateHash, kind, provider]);
    if (!rows.length) { await conn.rollback(); return null; }
    await conn.execute('DELETE FROM cp_oauth_states WHERE state_hash = ?', [stateHash]);
    await conn.commit();
    const r = rows[0];
    return { nonceHash: r.nonce_hash, kind: r.kind, provider: r.provider, ownerOpenId: r.owner_open_id,
      origin: r.origin, redirectUri: r.redirect_uri, expiresAt: r.expires_at };
  } catch { await conn.rollback(); throw safeError('Could not consume OAuth state'); }
  finally { conn.release(); }
}

/** Create or replace a session keyed by token hash. */
export async function createSession({ tokenHash, openId, expiresAt }) {
  try { const db = await pool(); await db.execute(`INSERT INTO cp_sessions (token_hash, open_id, expires_at)
    VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE open_id = VALUES(open_id), expires_at = VALUES(expires_at)`, [tokenHash, openId, expiresAt]); }
  catch { throw safeError('Could not create session'); }
}
/** Return {openId, expiresAt} for a live session, otherwise null. */
export async function getSession(tokenHash) {
  try { const db = await pool(); const [rows] = await db.execute('SELECT open_id, expires_at FROM cp_sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP(3)', [tokenHash]);
    return rows.length ? { openId: rows[0].open_id, expiresAt: rows[0].expires_at } : null; }
  catch { throw safeError('Could not read session'); }
}
/** Delete a session by token hash. */
export async function deleteSession(tokenHash) {
  try { const db = await pool(); await db.execute('DELETE FROM cp_sessions WHERE token_hash = ?', [tokenHash]); }
  catch { throw safeError('Could not delete session'); }
}
const SAFE_CONNECTION_COLUMNS = `id, provider, display_name AS displayName,
  handle, scope, expires_at AS expiresAt, refresh_expires_at AS refreshExpiresAt, status,
  last_synced_at AS lastSyncedAt, created_at AS createdAt, updated_at AS updatedAt`;
/** List an owner's connections with safe metadata only; token ciphertext is never returned. */
export async function listConnections(ownerOpenId) {
  try { const db = await pool(); const [rows] = await db.execute(`SELECT ${SAFE_CONNECTION_COLUMNS} FROM cp_connections WHERE owner_open_id = ? ORDER BY id`, [ownerOpenId]); return rows; }
  catch { throw safeError('Could not list connections'); }
}
/** Fetch one connection owned by ownerOpenId; server-only result may include token ciphertext. */
export async function getConnection(id, ownerOpenId) {
  try { const db = await pool(); const [rows] = await db.execute(`SELECT id, owner_open_id AS ownerOpenId, provider,
    provider_user_id AS providerUserId, display_name AS displayName, handle, access_token_cipher AS accessTokenCipher,
    refresh_token_cipher AS refreshTokenCipher, scope, expires_at AS expiresAt, refresh_expires_at AS refreshExpiresAt,
    status, last_synced_at AS lastSyncedAt, created_at AS createdAt, updated_at AS updatedAt
    FROM cp_connections WHERE id = ? AND owner_open_id = ?`, [id, ownerOpenId]); return rows[0] || null; }
  catch { throw safeError('Could not read connection'); }
}
/** Upsert an owner's provider identity transactionally; returns its numeric connection id. */
export async function upsertConnection({ ownerOpenId, provider, providerUserId, displayName, handle, accessTokenCipher, refreshTokenCipher, scope, expiresAt, refreshExpiresAt, status }) {
  const db = await pool(); const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`INSERT INTO cp_connections
      (owner_open_id, provider, provider_user_id, display_name, handle, access_token_cipher, refresh_token_cipher, scope, expires_at, refresh_expires_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), handle = VALUES(handle), access_token_cipher = VALUES(access_token_cipher),
      refresh_token_cipher = COALESCE(VALUES(refresh_token_cipher), refresh_token_cipher), scope = VALUES(scope), expires_at = VALUES(expires_at),
      refresh_expires_at = VALUES(refresh_expires_at), status = VALUES(status)`,
    [ownerOpenId, provider, providerUserId, displayName ?? null, handle ?? null, accessTokenCipher, refreshTokenCipher ?? null, scope ?? null, expiresAt ?? null, refreshExpiresAt ?? null, status ?? 'connected']);
    const [rows] = await conn.execute('SELECT id FROM cp_connections WHERE owner_open_id = ? AND provider = ? AND provider_user_id = ? FOR UPDATE', [ownerOpenId, provider, providerUserId]);
    await conn.commit(); return rows[0].id;
  } catch { await conn.rollback(); throw safeError('Could not save connection'); }
  finally { conn.release(); }
}
const PATCH_COLUMNS = { accessTokenCipher: 'access_token_cipher', refreshTokenCipher: 'refresh_token_cipher', status: 'status', lastSyncedAt: 'last_synced_at', expiresAt: 'expires_at', refreshExpiresAt: 'refresh_expires_at' };
/** Update only token, status, expiry, and sync-time fields of a connection owned by ownerOpenId. Returns whether a row matched. */
export async function updateConnection(id, ownerOpenId, patch) {
  const entries = Object.entries(patch || {}).filter(([key]) => own(PATCH_COLUMNS, key));
  if (!entries.length) return false;
  try { const db = await pool(); const [result] = await db.execute(`UPDATE cp_connections SET ${entries.map(([key]) => `${PATCH_COLUMNS[key]} = ?`).join(', ')} WHERE id = ? AND owner_open_id = ?`, [...entries.map(([, value]) => value), id, ownerOpenId]); return result.affectedRows > 0; }
  catch { throw safeError('Could not update connection'); }
}
/** Delete an owned connection; metric snapshots cascade. Returns true only if deleted. */
export async function deleteConnection(id, ownerOpenId) {
  try { const db = await pool(); const [result] = await db.execute('DELETE FROM cp_connections WHERE id = ? AND owner_open_id = ?', [id, ownerOpenId]); return result.affectedRows > 0; }
  catch { throw safeError('Could not delete connection'); }
}
/** Return {payload, fetchedAt} for an exact account/date-range snapshot, or null. */
export async function getMetricSnapshot(accountId, startDate, endDate) {
  try { const db = await pool(); const [rows] = await db.execute('SELECT payload, fetched_at AS fetchedAt FROM cp_metric_snapshots WHERE account_id = ? AND start_date = ? AND end_date = ?', [accountId, startDate, endDate]); return rows.length ? { payload: rows[0].payload, fetchedAt: rows[0].fetchedAt } : null; }
  catch { throw safeError('Could not read metric snapshot'); }
}
/** Insert or replace a metric snapshot for an exact account/date range. */
export async function saveMetricSnapshot(accountId, startDate, endDate, payload) {
  try { const db = await pool(); await db.execute(`INSERT INTO cp_metric_snapshots (account_id, start_date, end_date, payload, fetched_at)
    VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE payload = VALUES(payload), fetched_at = UTC_TIMESTAMP(3)`, [accountId, startDate, endDate, JSON.stringify(payload)]); }
  catch { throw safeError('Could not save metric snapshot'); }
}
/** Remove expired states/sessions and snapshots older than the one-year report window. */
export async function cleanupExpired() {
  try {
    const db = await pool();
    const [oauth] = await db.execute('DELETE FROM cp_oauth_states WHERE expires_at <= UTC_TIMESTAMP(3)');
    const [sessions] = await db.execute('DELETE FROM cp_sessions WHERE expires_at <= UTC_TIMESTAMP(3)');
    const [snapshots] = await db.execute('DELETE FROM cp_metric_snapshots WHERE fetched_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 400 DAY)');
    return { oauthStates: oauth.affectedRows, sessions: sessions.affectedRows, snapshots: snapshots.affectedRows };
  }
  catch { throw safeError('Could not clean up expired records'); }
}
