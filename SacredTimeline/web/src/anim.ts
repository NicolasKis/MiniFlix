import { useState } from 'react'

// Every animation has its own switch, grouped as on the TVA screen. Switches are per device.
export const ANIM_GROUPS = [
  { name: 'Screens', items: [
    ['loading', 'Loading screen', 'The logo builds itself when the app opens'],
    ['timeline', 'Timeline', 'Line draws in, titles slide up, percentage counts up'],
    ['history', 'History', 'Rewind slide-in and stamped top three'],
    ['tva', 'TVA', 'Time door, hourglass flip and stamped sections'],
  ] },
  { name: 'Moving around', items: [
    ['jump', 'Saga jump bar', 'Time traveller dot and arrival flash'],
    ['detail', 'Details card', 'Grows out of the poster you tapped'],
  ] },
  { name: 'Ticking things off', items: [
    ['tick', 'Tick and line fill', 'Button pops, the red line grows or drains'],
    ['counter', 'Percentage counter', 'Rolls to the new number'],
    ['upnext', 'Up next swap', 'Next title slides in'],
    ['season', 'Whole-season ripple', 'Episodes fill one after another'],
    ['branch', 'Extras branch', 'Branch swings in and out of the main line'],
  ] },
  { name: 'Celebrations', items: [['celebrate', 'Saga complete', 'Stamp and gold sparks along the line']] },
  { name: 'TVA tasks', items: [['tasks', 'Library check and backup', 'Flowing sand, glowing new titles, drawn tick']] },
] as const

export type AnimKey = (typeof ANIM_GROUPS)[number]['items'][number][0]
export type AnimPrefs = Record<AnimKey | 'all', boolean>

const KEY = 'st-animations'

export function useAnim() {
  const [prefs, setPrefs] = useState<Partial<AnimPrefs>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
  })
  // Everything is on unless switched off; the device's reduce-motion setting is ignored on purpose.
  const on = (k: AnimKey) => prefs.all !== false && prefs[k] !== false
  const set = (k: AnimKey | 'all', value: boolean) => {
    const next = { ...prefs, [k]: value }
    setPrefs(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: keep it for this visit */ }
  }
  return { prefs, on, set }
}
