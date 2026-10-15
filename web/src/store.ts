import PocketBase, { type RecordModel } from 'pocketbase'
import { useEffect, useState } from 'react'
import type { Progress } from './data'

const pb = new PocketBase('/')
const progress = pb.collection('progress')
const ID = 'progressstate01'

const parse = (data: unknown): Progress => ({ watched: {}, included: {}, minimised: {}, started: null, log: [], ...(data as Partial<Progress>) })

// Loads the shared progress record and keeps it live: a tick on one device shows up on the others.
export function useProgress() {
  const [p, setP] = useState<Progress | null>(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    progress.getOne(ID)
      .then(r => { setP(parse(r.data)); setOffline(false) })
      .catch(() => setOffline(true))
    progress.subscribe(ID, e => setP(parse(e.record.data)))
      .then(u => { unsubscribe = u })
      .catch(() => setOffline(true))
    return () => unsubscribe?.()
  }, [])

  // shortcut: the whole record is rewritten on each change (last write wins); fine for one person
  const save = (next: Progress) => {
    setP(next)
    progress.update(ID, { data: next })
      .then(() => setOffline(false))
      .catch(() => setOffline(true))
  }

  return { p, save, offline }
}

export type JellyfinItem = { name: string; year: number | null; type: 'movie' | 'tv'; tmdb: string | null; quality: string | null }
export type Tva = { jellyfin: { checkedAt: string; items: JellyfinItem[] } | null; lastBackup: string }

// The TVA record: last Jellyfin check and last backup, written only by the server.
export function useTva() {
  const [tva, setTva] = useState<Tva>({ jellyfin: null, lastBackup: '' })
  useEffect(() => {
    const tvaRecords = pb.collection('tva')
    const read = (r: RecordModel) => setTva({ jellyfin: (r.jellyfin as Tva['jellyfin']) ?? null, lastBackup: (r.lastBackup as string) ?? '' })
    let unsubscribe: (() => void) | undefined
    tvaRecords.getOne('tvastate0000001').then(read).catch(() => {})
    tvaRecords.subscribe('tvastate0000001', e => read(e.record)).then(u => { unsubscribe = u }).catch(() => {})
    return () => unsubscribe?.()
  }, [])
  return tva
}

// Runs a TVA task on the server; resolves with an error message, or null when it worked.
export const runTask = (task: 'jellyfin' | 'backup') =>
  pb.send(`/api/st/${task}`, { method: 'POST' })
    .then(() => null)
    .catch((err: { response?: { error?: string } }) => err.response?.error ?? "Couldn't reach the server.")
