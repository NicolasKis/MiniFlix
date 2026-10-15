import PocketBase, { type RecordModel } from 'pocketbase'
import { useEffect, useRef, useState } from 'react'
import { setTitles, type Progress, type Title } from './data'

const pb = new PocketBase('/')
const progress = pb.collection('progress')
const ID = 'progressstate01'
const CACHE = 'st-cache'

const parse = (data: unknown): Progress => ({ watched: {}, included: {}, minimised: {}, started: null, log: [], ...(data as Partial<Progress>) })

// A copy of everything on this device, so the app opens and ticks work without a connection.
type Cache = { progress?: Progress; pending?: number; tva?: Tva; titles?: Title[] }
const readCache = (): Cache => { try { return JSON.parse(localStorage.getItem(CACHE) ?? '{}') } catch { return {} } }
const writeCache = (patch: Cache) => { try { localStorage.setItem(CACHE, JSON.stringify({ ...readCache(), ...patch })) } catch { /* storage full or private mode */ } }
{
  const cached = readCache().titles
  if (cached?.length) setTitles(cached)
}

export type Net = { offline: boolean; pending: number; sync: 'syncing' | 'synced' | null }

// Loads the shared progress record and keeps it live: a tick on one device shows up on the others.
// Offline, changes stay on the device (counted in `pending`) and are sent once the server answers again.
export function useProgress() {
  const [p, setP] = useState<Progress | null>(() => readCache().progress ?? null)
  const [net, setNet] = useState<Net>(() => ({ offline: false, pending: readCache().pending ?? 0, sync: null }))
  const netRef = useRef(net)
  useEffect(() => { netRef.current = net })

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let retry: ReturnType<typeof setInterval> | undefined
    let syncedTimer: ReturnType<typeof setTimeout> | undefined

    const goOffline = () => setNet(n => (n.offline ? n : { ...n, offline: true, sync: null }))
    // shortcut: offline changes overwrite the server's copy on reconnect (last write wins); fine for one person
    const flush = () => {
      const { progress: local, pending = 0 } = readCache()
      if (!pending || !local) return progress.getOne(ID).then(r => { setP(parse(r.data)); writeCache({ progress: parse(r.data) }) })
      setNet(n => ({ ...n, offline: false, sync: 'syncing' }))
      return progress.update(ID, { data: local }).then(() => {
        writeCache({ pending: 0 })
        setNet({ offline: false, pending: 0, sync: 'synced' })
        clearTimeout(syncedTimer)
        syncedTimer = setTimeout(() => setNet(n => ({ ...n, sync: null })), 3000)
      })
    }
    const connect = () =>
      flush()
        .then(() => {
          clearInterval(retry)
          retry = undefined
          setNet(n => ({ ...n, offline: false }))
        })
        .catch(() => {
          goOffline()
          retry ??= setInterval(connect, 15000)
        })

    connect()
    progress.subscribe(ID, e => {
      if (netRef.current.pending) return // our offline changes win until they're sent
      setP(parse(e.record.data))
      writeCache({ progress: parse(e.record.data) })
    }).then(u => { unsubscribe = u }).catch(goOffline)
    const onOnline = () => connect()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      unsubscribe?.()
      clearInterval(retry)
      clearTimeout(syncedTimer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const save = (next: Progress) => {
    setP(next)
    writeCache({ progress: next })
    const queue = () => {
      const pending = (readCache().pending ?? 0) + 1
      writeCache({ pending })
      setNet(n => ({ ...n, offline: true, pending, sync: null }))
    }
    if (netRef.current.offline || netRef.current.pending) return queue()
    progress.update(ID, { data: next }).catch(queue)
  }

  return { p, save, net }
}

export type JellyfinItem = { name: string; year: number | null; type: 'movie' | 'tv'; tmdb: string | null; quality: string | null }
export type Variance = { key: string; kind: 'episodes' | 'date' | 'streaming' | 'title'; title: string; detail: string }
export type Tva = {
  jellyfin: { checkedAt: string; items: JellyfinItem[] } | null
  lastBackup: string
  variances: Variance[]
  varChecked: string
  hasCatalog: boolean
}

const readTva = (r: RecordModel): Tva => {
  const catalog = r.catalog as { titles?: Title[] } | null
  if (catalog?.titles?.length) setTitles(catalog.titles)
  return {
    jellyfin: (r.jellyfin as Tva['jellyfin']) ?? null,
    lastBackup: (r.lastBackup as string) ?? '',
    variances: (r.variances as Variance[]) ?? [],
    varChecked: (r.varChecked as string) ?? '',
    hasCatalog: !!catalog?.titles?.length,
  }
}

// The TVA record: timeline list, Jellyfin check, variances and last backup, written only by the server.
export function useTva() {
  const [tva, setTva] = useState<Tva>(() => {
    const cached = readCache().tva
    return cached ?? { jellyfin: null, lastBackup: '', variances: [], varChecked: '', hasCatalog: false }
  })
  useEffect(() => {
    const tvaRecords = pb.collection('tva')
    const take = (r: RecordModel) => {
      const next = readTva(r)
      setTva(next)
      const catalog = r.catalog as { titles?: Title[] } | null
      writeCache({ tva: next, ...(catalog?.titles?.length ? { titles: catalog.titles } : {}) })
    }
    let unsubscribe: (() => void) | undefined
    tvaRecords.getOne('tvastate0000001').then(take).catch(() => {})
    tvaRecords.subscribe('tvastate0000001', e => take(e.record)).then(u => { unsubscribe = u }).catch(() => {})
    return () => unsubscribe?.()
  }, [])
  return tva
}

// Runs a TVA task on the server; resolves with an error message, or null when it worked.
export const runTask = (task: 'jellyfin' | 'backup' | 'variance' | 'variance/resolve', body?: object) =>
  pb.send(`/api/st/${task}`, { method: 'POST', body })
    .then(() => null)
    .catch((err: { response?: { error?: string } }) => err.response?.error ?? "Couldn't reach the server.")
