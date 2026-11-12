import { useEffect, useState } from 'react'
import { runTask } from './store'

export type Kinds = { releases: boolean; countdown: boolean; episodes: boolean; leaving: boolean; variances: boolean; backup: boolean }
export const NOTIF_KINDS = [
  ['releases', 'New releases', 'When a title on your timeline comes out'],
  ['countdown', 'Countdown', 'A week before a release, with how much you have left to catch up'],
  ['episodes', 'New episode', "When a show you're partway through gets a new episode"],
  ['leaving', 'Leaving a service', 'When a title on your timeline leaves your streaming services'],
  ['variances', 'Variance report', 'When the TVA finds changes for you to approve'],
  ['backup', 'Backup reminder', "A nudge on the 1st if you haven't backed up for a month"],
] as const

const KINDS = 'st-notif-kinds'
const DEFAULTS: Kinds = { releases: true, countdown: true, episodes: true, leaving: true, variances: true, backup: false }
const readKinds = (): Kinds => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KINDS) ?? '{}') } } catch { return DEFAULTS }
}

// Web push needs a service worker and, on iPhone, the app opened from the Home Screen.
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const subscription = async () => (await navigator.serviceWorker.ready).pushManager.getSubscription()

const toKey = (base64: string) => {
  const raw = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// Notifications are switched on per device; the server keeps each device's subscription and kinds.
export function usePush() {
  const [on, setOn] = useState(false)
  const [kinds, setKinds] = useState<Kinds>(readKinds)
  const send = (sub: PushSubscription, k: Kinds) => runTask('push/subscribe', { sub: sub.toJSON(), kinds: k })
  useEffect(() => {
    if (!pushSupported()) return
    subscription().then(s => {
      setOn(!!s)
      // Keeps the server's copy of this device's switches current (new kinds start on).
      if (s) runTask('push/subscribe', { sub: s.toJSON(), kinds: readKinds() })
    }).catch(() => {})
  }, [])

  const enable = async (): Promise<string | null> => {
    if (await Notification.requestPermission() !== 'granted') return 'Notifications are blocked. Allow them in your phone or browser settings.'
    const res = await fetch('/api/st/push/key').then(r => r.json()).catch(() => null)
    if (!res?.key) return "Couldn't reach the server."
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(res.key) })
    const error = await send(sub, kinds)
    if (!error) setOn(true)
    return error
  }
  const disable = async () => {
    const sub = await subscription()
    if (sub) {
      await runTask('push/unsubscribe', { endpoint: sub.endpoint })
      await sub.unsubscribe()
    }
    setOn(false)
    return null
  }
  const setKind = async (k: keyof Kinds, value: boolean) => {
    const next = { ...kinds, [k]: value }
    setKinds(next)
    try { localStorage.setItem(KINDS, JSON.stringify(next)) } catch { /* private mode */ }
    const sub = await subscription()
    return sub ? send(sub, next) : null
  }
  const test = async () => {
    const sub = await subscription()
    return sub ? runTask('push/test', { endpoint: sub.endpoint }) : 'Turn notifications on first.'
  }
  return { on, kinds, enable, disable, setKind, test }
}
