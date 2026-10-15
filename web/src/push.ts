import { useEffect, useState } from 'react'
import { runTask } from './store'

export type Kinds = { releases: boolean; variances: boolean; backup: boolean }
export const NOTIF_KINDS = [
  ['releases', 'New releases', 'When a title on your timeline comes out'],
  ['variances', 'Variance report', 'When the TVA finds changes for you to approve'],
  ['backup', 'Backup reminder', "A nudge on the 1st if you haven't backed up for a month"],
] as const

const KINDS = 'st-notif-kinds'
const readKinds = (): Kinds => {
  try { return { releases: true, variances: true, backup: false, ...JSON.parse(localStorage.getItem(KINDS) ?? '{}') } } catch { return { releases: true, variances: true, backup: false } }
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
  useEffect(() => {
    if (pushSupported()) subscription().then(s => setOn(!!s)).catch(() => {})
  }, [])

  const send = (sub: PushSubscription, k: Kinds) => runTask('push/subscribe', { sub: sub.toJSON(), kinds: k })

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
