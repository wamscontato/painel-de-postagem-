export type LocalRecord = {
  id: string
  kind: 'draft' | 'schedule' | 'media' | 'calendar'
  payload: unknown
  updatedAt: string
}

const DB_NAME = 'social-studio'
const STORE_NAME = 'records'
const LOCAL_KINDS = new Set<LocalRecord['kind']>(['draft', 'schedule', 'media', 'calendar'])

function isLocalRecord(value: unknown, id: string): value is LocalRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LocalRecord>
  return candidate.id === id
    && typeof candidate.kind === 'string' && LOCAL_KINDS.has(candidate.kind as LocalRecord['kind'])
    && 'payload' in candidate
    && typeof candidate.updatedAt === 'string'
    && Number.isFinite(Date.parse(candidate.updatedAt))
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB indisponível'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o armazenamento local'))
  })
}

function readFallbackRecord(id: string): LocalRecord | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(`social-studio:${id}`)
    if (!raw) return null
    const candidate: unknown = JSON.parse(raw)
    return isLocalRecord(candidate, id) ? candidate : null
  } catch {
    return null
  }
}

export async function saveLocalRecord(record: LocalRecord) {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Falha na transação local'))
    })
  } catch {
    localStorage.setItem(`social-studio:${record.id}`, JSON.stringify(record))
  }
}

export async function readLocalRecord<T>(id: string): Promise<T | null> {
  const fallback = readFallbackRecord(id)
  let stored: LocalRecord | null = null
  try {
    const db = await openDb()
    stored = await new Promise<LocalRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(id)
      let result: LocalRecord | null = null
      request.onsuccess = () => { result = isLocalRecord(request.result, id) ? request.result : null }
      request.onerror = () => reject(request.error ?? new Error('Falha ao ler o armazenamento local'))
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error ?? new Error('Falha na transação local'))
      tx.onabort = () => reject(tx.error ?? new Error('Falha na transação local'))
    })
  } catch {
    stored = null
  }

  // localStorage can contain a newer record when a previous IndexedDB write failed.
  const latest = fallback && (!stored || Date.parse(fallback.updatedAt) >= Date.parse(stored.updatedAt)) ? fallback : stored
  return latest ? latest.payload as T : null
}
