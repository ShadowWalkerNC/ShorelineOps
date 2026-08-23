/**
 * Kitchen Offline Storage & Mutation Queue
 * 
 * Provides robust offline storage via IndexedDB for Kitchen Tablet Mode.
 * Queues tray card dispatches, cooking temperature logs, and par count updates
 * while offline, and automatically replays when connectivity resumes.
 */

export interface OfflineAction {
  id: string
  type: 'DISPATCH_TRAY' | 'LOG_TEMP' | 'UPDATE_PAR'
  payload: any
  timestamp: string
  retryCount: number
}

const DB_NAME = 'shoreline_kitchen_db'
const DB_VERSION = 1
const STORE_MUTATIONS = 'offline_mutations'
const STORE_CACHE = 'kitchen_cache'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in current environment'))
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
        db.createObjectStore(STORE_MUTATIONS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function queueOfflineAction(type: OfflineAction['type'], payload: any): Promise<OfflineAction> {
  const db = await openDatabase()
  const action: OfflineAction = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTATIONS, 'readwrite')
    const store = tx.objectStore(STORE_MUTATIONS)
    const request = store.add(action)

    request.onsuccess = () => resolve(action)
    request.onerror = () => reject(request.error)
  })
}

export async function getPendingOfflineActions(): Promise<OfflineAction[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTATIONS, 'readonly')
    const store = tx.objectStore(STORE_MUTATIONS)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function removeOfflineAction(id: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTATIONS, 'readwrite')
    const store = tx.objectStore(STORE_MUTATIONS)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function cacheKitchenData(key: string, data: any): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite')
    const store = tx.objectStore(STORE_CACHE)
    const request = store.put({ key, data, updatedAt: new Date().toISOString() })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getCachedKitchenData<T = any>(key: string): Promise<T | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readonly')
    const store = tx.objectStore(STORE_CACHE)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result ? request.result.data : null)
    request.onerror = () => reject(request.error)
  })
}
