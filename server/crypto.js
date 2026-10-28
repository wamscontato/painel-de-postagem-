import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 'v1'

function readKey(env = process.env) {
  const raw = env.SOCIAL_TOKEN_ENCRYPTION_KEY
  if (typeof raw !== 'string' || !raw) throw new Error('Token encryption is not configured')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new Error('Token encryption is not configured')
  let key
  try { key = Buffer.from(raw, 'base64') } catch { throw new Error('Token encryption is not configured') }
  if (key.length !== 32 || key.toString('base64') !== raw) throw new Error('Token encryption is not configured')
  return key
}

/** Returns false unless the protected value decodes to exactly 32 bytes. */
export function isEncryptionConfigured(env = process.env) {
  try { readKey(env); return true } catch { return false }
}

/** Encrypts a provider token with an independent random IV and authenticated GCM tag. */
export function encryptToken(value, env = process.env) {
  if (typeof value !== 'string' || !value) throw new Error('Token is empty')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', readKey(env), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}

/** Decrypts a versioned provider token; callers must never return it to a browser. */
export function decryptToken(value, env = process.env) {
  if (typeof value !== 'string') throw new Error('Stored token is unavailable')
  const [version, ivPart, tagPart, dataPart, extra] = value.split('.')
  if (version !== VERSION || !ivPart || !tagPart || !dataPart || extra !== undefined) throw new Error('Stored token is unavailable')
  try {
    const decipher = createDecipheriv('aes-256-gcm', readKey(env), Buffer.from(ivPart, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8')
  } catch { throw new Error('Stored token is unavailable') }
}
