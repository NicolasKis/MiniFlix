import { ERAS, daysUntil, duration, episodes, sagaMap, shown, span, today, totalMins, totals, watchCount, type Progress } from './data'

export type Watch = { id: string; date: string; mins: number; rewatch: boolean }

// One entry per watch: every marathon tick (a film or an episode) and every logged rewatch. Hidden titles are left out.
export const watchLog = (p: Progress): Watch[] => {
  const list = shown(p)
  const mins = new Map<string, number>()
  for (const t of list) {
    if (t.kind === 'series') for (const e of episodes(t)) mins.set(e.key, e.min)
    else mins.set(t.id, t.runtime ?? 0)
  }
  const byId = new Map(list.map(t => [t.id, t]))
  return [
    ...Object.entries(p.watched).filter(([k]) => mins.has(k)).map(([k, date]) => ({ id: k.split(':')[0], date, mins: mins.get(k)!, rewatch: false })),
    ...p.log.filter(e => byId.has(e.id)).map(e => ({ id: e.id, date: e.date, mins: totalMins(byId.get(e.id)!), rewatch: true })),
  ]
}

// Day number relative to today: later dates are bigger.
const dayNo = (iso: string) => daysUntil(iso)

// Most days in a row with at least one watch.
export const longestStreak = (dates: string[]) => {
  const days = [...new Set(dates)].map(dayNo).sort((a, b) => a - b)
  let best = 0
  let run = 0
  days.forEach((d, i) => {
    run = i > 0 && d - days[i - 1] === 1 ? run + 1 : 1
    best = Math.max(best, run)
  })
  return best
}

// Hours watched in each of the last six months, this month last.
export const perMonth = (log: Watch[]) => {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = d.toLocaleDateString('sv-SE').slice(0, 7)
    const mins = log.filter(w => w.date.startsWith(key)).reduce((a, w) => a + w.mins, 0)
    return { label: d.toLocaleDateString('en-GB', { month: 'short' }), hours: Math.round(mins / 60) }
  })
}

export const statTiles = (p: Progress) => {
  const log = watchLog(p)
  const { watched } = totals(p)
  const daysIn = p.started ? Math.max(1, dayNo(today()) - dayNo(p.started) + 1) : 1
  const streak = longestStreak(log.map(w => w.date))
  return {
    tiles: [
      [duration(watched), 'Watched in this marathon'],
      [`${streak} ${streak === 1 ? 'day' : 'days'}`, 'Longest streak'],
      [duration(Math.round(watched / daysIn)), 'Average per day'],
      [String(log.filter(w => w.rewatch).length), 'Rewatches logged'],
    ],
    months: perMonth(log),
  }
}

// The four numbers on the Wrapped card, once the whole timeline is watched.
export const wrapped = (p: Progress) => {
  const { watched, counted } = totals(p)
  const marathon = watchLog(p).filter(w => !w.rewatch)
  const last = marathon.map(w => w.date).sort().pop() ?? today()
  const top = [...counted].sort((a, b) => watchCount(b, p) - watchCount(a, p))[0]
  const saga = sagaMap()
  const sagas = ERAS.flatMap((era, i) => {
    const dates = marathon.filter(w => saga.get(w.id) === i).map(w => w.date).sort()
    return dates.length ? [{ name: era.name, days: dayNo(dates[dates.length - 1]) - dayNo(dates[0]) + 1 }] : []
  }).sort((a, b) => a.days - b.days)
  return [
    [duration(watched).replace(/ \d+ min$/, ''), 'watched in total'],
    [p.started ? span(p.started, last) : '–', 'from first tick to last'],
    [top ? `${watchCount(top, p)}×` : '–', top ? `${top.title}, your most watched` : 'most watched'],
    [sagas[0]?.name.replace(/^The /, '') ?? '–', sagas[0] ? `your fastest saga, in ${sagas[0].days} ${sagas[0].days === 1 ? 'day' : 'days'}` : 'fastest saga'],
  ]
}
