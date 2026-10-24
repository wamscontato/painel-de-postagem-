export type LocalRecord = {
  id: string
  kind: 'draft' | 'schedule' | 'media'
  payload: unknown
  updatedAt: string
}

const DB_NAME = 'social-studio'
const STORE_NAME = 'records'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
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

export async function saveLocalRecord(record: LocalRecord) {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    localStorage.setItem(`social-studio:${record.id}`, JSON.stringify(record))
  }
}

export async function readLocalRecord<T>(id: string): Promise<T | null> {
  try {
    const db = await openDb()
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve((request.result?.payload as T | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    const fallback = localStorage.getItem(`social-studio:${id}`)
    return fallback ? (JSON.parse(fallback).payload as T) : null
  }
}
