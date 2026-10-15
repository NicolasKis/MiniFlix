import raw from '../../data/titles.json'

export type Episode = number | { min: number; airs: string | null }
export type Title = {
  id: string
  title: string
  kind: 'movie' | 'series' | 'special'
  category: 'main' | 'debated' | 'side'
  setIn: string
  release: string | null
  where: string[]
  runtime?: number | null
  seasons?: { season: number; episodes: Episode[] }[]
  note?: string
  poster?: string | null
  overview?: string
  tmdb?: string // "movie/1726" or "tv/84958"
}
export type Progress = {
  watched: Record<string, string>
  included: Record<string, boolean>
  minimised: Record<string, boolean>
  started: string | null
  // Rewatches outside the marathon; they never change the percentage.
  log: { id: string; date: string }[]
}
export type Ep = { key: string; season: number; number: number; min: number; airs: string | null; aired: boolean }

// The built-in locked list, replaced by the server's copy (with approved variances) once it loads.
export let titles = raw.titles as Title[]
export const setTitles = (list: Title[]) => { titles = list }

// Eras start at these titles; order comes from the locked list.
export const ERAS: { start: string; name: string; years: string }[] = [
  { start: 'first-avenger', name: 'Origins', years: '1943 to 1995' },
  { start: 'iron-man', name: 'The Infinity Saga', years: '2008 to 2023' },
  { start: 'loki-1', name: 'The Multiverse Saga', years: '2023 onward' },
  { start: 'doomsday', name: 'Doomsday and beyond', years: 'Counted once they are out' },
]

export const today = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD in local time

export const released = (t: Title) => !!t.release && t.release <= today()

export const episodes = (t: Title): Ep[] =>
  (t.seasons ?? []).flatMap(s =>
    s.episodes.map((e, i) => {
      const min = typeof e === 'number' ? e : e.min
      const airs = typeof e === 'number' ? null : e.airs
      return { key: `${t.id}:${s.season}:${i + 1}`, season: s.season, number: i + 1, min, airs, aired: !airs || airs <= today() }
    }),
  )

export const totalMins = (t: Title) =>
  t.kind === 'series' ? episodes(t).filter(e => e.aired).reduce((a, e) => a + e.min, 0) : (t.runtime ?? 0)

export const watchedMins = (t: Title, p: Progress) =>
  t.kind === 'series'
    ? episodes(t).filter(e => e.aired && p.watched[e.key]).reduce((a, e) => a + e.min, 0)
    : p.watched[t.id] ? (t.runtime ?? 0) : 0

export const isDone = (t: Title, p: Progress) => {
  if (t.kind !== 'series') return !!p.watched[t.id]
  const aired = episodes(t).filter(e => e.aired)
  return aired.length > 0 && aired.every(e => p.watched[e.key])
}

// When the marathon tick happened: a film's own date, or a finished series' last episode.
export const watchedOn = (t: Title, p: Progress): string | null => {
  if (t.kind !== 'series') return p.watched[t.id] ?? null
  if (!isDone(t, p)) return null
  return episodes(t).filter(e => e.aired).map(e => p.watched[e.key]).sort().pop() ?? null
}

// The marathon tick counts as one watch, every logged rewatch as another.
export const watchCount = (t: Title, p: Progress) =>
  (released(t) && isDone(t, p) ? 1 : 0) + p.log.filter(e => e.id === t.id).length

export const countLabel = (n: number) => (n === 0 ? 'Not watched yet' : n === 1 ? 'Watched once' : `Watched ${n}×`)

export const isExtra = (t: Title) => t.category !== 'main'
export const counts = (t: Title, p: Progress) => released(t) && (!isExtra(t) || !!p.included[t.id])

// Everything that counts toward 100%: main titles plus extras you added, released only.
export const totals = (p: Progress) => {
  const counted = titles.filter(t => counts(t, p))
  const total = counted.reduce((a, t) => a + totalMins(t), 0)
  const watched = counted.reduce((a, t) => a + watchedMins(t, p), 0)
  return { counted, total, watched, pct: total ? Math.floor((watched / total) * 1000) / 10 : 0 }
}

export const poster =(t: Title, size: 'w154' | 'w342') => (t.poster ? `https://image.tmdb.org/t/p/${size}${t.poster}` : '')

export const duration = (m: number) => {
  const h = Math.floor(m / 60)
  return [h ? `${h} h` : '', m % 60 ? `${m % 60} min` : ''].filter(Boolean).join(' ') || '0 min'
}

export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const daysUntil = (iso: string) =>
  Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86400000)

// "4 months and 12 days" between two YYYY-MM-DD dates.
export const span = (from: string, to: string) => {
  const a = new Date(`${from}T00:00:00`), b = new Date(`${to}T00:00:00`)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()
  if (b.getDate() < a.getDate()) months--
  const anchor = new Date(a.getFullYear(), a.getMonth() + months, a.getDate())
  const days = Math.round((b.getTime() - anchor.getTime()) / 86400000)
  const parts = []
  if (months) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
  if (days || !months) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  return parts.join(' and ')
}

// The year shown in the left column, taken from "1943–1945", "Christmas 2024", "Outside time"...
export const yearOf = (t: Title) => t.setIn.match(/\d{4}/)?.[0] ?? (t.setIn === 'Outside time' ? 'TVA' : '')

// Better copies stand out more: grey for 480p up to filled gold for 4K.
export const QUALITY_STYLE: Record<string, string> = {
  '480p': 'bg-[#2A2B30] text-[#8A8D96]',
  '720p': 'bg-track text-[#D9D5CD]',
  '1080p': 'bg-[#2A2340] text-[#C9B8FF]',
  '1440p': 'bg-[#12303A] text-[#7FD6F2]',
  '4K': 'bg-gold text-bg',
}

