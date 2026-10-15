import PocketBase from 'pocketbase'
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
