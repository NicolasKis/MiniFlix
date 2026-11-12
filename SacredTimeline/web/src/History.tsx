import { useState, type CSSProperties, type MouseEvent } from 'react'
import { countLabel, fmtDate, poster, released, shown, watchCount, watchedOn, type Progress, type Title } from './data'
import { statTiles } from './stats'

type Props = { p: Progress; onOpen: (t: Title, e?: MouseEvent<HTMLElement>) => void; onRewatch: (t: Title) => void; entering: boolean; finished: boolean; onWrapped: () => void }

const EASE = 'cubic-bezier(.2,.8,.2,1)'


// Every watch, newest first: marathon ticks and rewatches together.
export default function History({ p, onOpen, onRewatch, entering, finished, onWrapped }: Props) {
  // Entrance: a quick rewind from the side, with the top three stamped in.
  const fromRight = (delay: number): CSSProperties | undefined => (entering ? { animation: `st-from-right 380ms ${EASE} ${delay}ms both` } : undefined)
  const stamp = (delay: number): CSSProperties | undefined => (entering ? { animation: `st-stamp 440ms ${EASE} ${delay}ms both` } : undefined)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  // Hidden titles stay out of History too.
  const list = shown(p)
  const byId = new Map(list.map(t => [t.id, t]))
  const stats = statTiles(p)
  const maxH = Math.max(1, ...stats.months.map(m => m.hours))

  const watches = [
    ...list.flatMap(t => {
      const date = watchedOn(t, p)
      return date ? [{ t, date, rewatch: false }] : []
    }),
    ...p.log.flatMap(e => {
      const t = byId.get(e.id)
      return t ? [{ t, date: e.date, rewatch: true }] : []
    }),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const seen = list.filter(t => watchCount(t, p) > 0)
  const top = [...seen].sort((a, b) => watchCount(b, p) - watchCount(a, p)).slice(0, 3)
  const results = q ? list.filter(t => t.title.toLowerCase().includes(q)) : []

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
        <h1 className="m-0 font-display text-[clamp(64px,9vw,112px)] font-extrabold uppercase leading-[0.85]" style={fromRight(0)}>History</h1>
        <span className="pb-1.5 text-muted">
          {watches.length} {watches.length === 1 ? 'watch' : 'watches'} of {seen.length} {seen.length === 1 ? 'title' : 'titles'}
        </span>
      </div>

      <div className="flex max-w-[560px] flex-col gap-2">
        <label htmlFor="st-search" className="text-[15px] text-muted">Find a title to log a rewatch</label>
        <input
          id="st-search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Iron Man"
          autoComplete="off"
          className="h-[52px] rounded-full border-2 border-line bg-surface px-5 text-[17px] text-ink outline-none placeholder:text-muted focus:border-gold"
        />
      </div>

      {q ? (
        <div className="flex flex-col">
          {results.map(t => {
            const n = watchCount(t, p)
            return (
              <div key={t.id} className="flex items-center gap-3.5 py-3">
                <PosterButton t={t} onOpen={onOpen} />
                <div className="flex min-w-0 flex-auto flex-col gap-0.5">
                  <span className="text-[19px] font-semibold leading-tight">{t.title}</span>
                  <span className={`text-[15px] ${n > 1 ? 'font-bold text-gold' : 'text-muted'}`}>{released(t) ? countLabel(n) : 'Not out yet'}</span>
                </div>
                {released(t) && (
                  <button
                    type="button"
                    onClick={() => onRewatch(t)}
                    aria-label={`Add a rewatch of ${t.title}`}
                    className="h-11 shrink-0 rounded-full border-2 border-gold bg-transparent px-[18px] text-base font-bold text-gold"
                  >
                    + Rewatch
                  </button>
                )}
              </div>
            )
          })}
          {!results.length && <span className="text-muted">No titles match "{query.trim()}".</span>}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {top.length > 0 && (
            <section aria-labelledby="st-top" className="flex flex-col gap-4">
              <h2 id="st-top" className="m-0 font-display text-4xl font-extrabold uppercase leading-none">Most watched</h2>
              <div className="flex flex-wrap gap-4">
                {top.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={e => onOpen(t, e)}
                    className="flex min-w-[150px] flex-[0_1_220px] items-center gap-3.5 rounded-xl border-0 bg-surface p-3 text-left text-ink"
                    style={stamp(100 + i * 80)}
                  >
                    <img src={poster(t, 'w154')} alt="" width={56} height={84} className="h-[84px] w-14 shrink-0 rounded-[3px] bg-track object-cover" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-display text-[40px] font-extrabold leading-[0.9] text-gold">{watchCount(t, p)}×</span>
                      <span className="text-base font-semibold leading-tight">{t.title}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="st-stats" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="st-stats" className="m-0 font-display text-4xl font-extrabold uppercase leading-none">Your stats</h2>
              {finished && (
                <button type="button" onClick={onWrapped} className="h-11 rounded-full border-2 border-red bg-transparent px-[18px] text-[15px] font-bold text-[#F07B7B]">
                  See your Wrapped
                </button>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
              {stats.tiles.map(([value, label], i) => (
                <div key={label} className="flex flex-col gap-1.5 rounded-xl bg-surface px-[18px] py-4" style={stamp(80 + i * 60)}>
                  <span className="font-display text-[34px] font-extrabold leading-[0.95] sm:text-[44px]">{value}</span>
                  <span className="text-[15px] text-muted">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 rounded-xl bg-surface px-[18px] py-4">
              <span className="text-[15px] font-bold text-muted">Hours watched per month</span>
              <div role="img" aria-label={`Hours watched per month: ${stats.months.map(m => `${m.label} ${m.hours}`).join(', ')}`} className="flex h-[120px] items-end gap-2.5">
                {stats.months.map((m, i) => (
                  <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[13px] font-bold">{m.hours} h</span>
                    <div
                      className={`w-full max-w-11 rounded-t ${i === stats.months.length - 1 ? 'bg-gold' : 'bg-red'}`}
                      style={{ height: Math.max(4, Math.round((m.hours / maxH) * 80)), ...(entering ? { transformOrigin: 'bottom', animation: `st-draw-down 420ms ${EASE} ${150 + i * 60}ms both` } : {}) }}
                    />
                    <span className="text-[13px] text-muted">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="st-recent" className="flex flex-col gap-1">
            <h2 id="st-recent" className="m-0 mb-3 font-display text-4xl font-extrabold uppercase leading-none">Recent watches</h2>
            {watches.length === 0 && <span className="text-muted">Nothing yet. Tick a title on the timeline or log a rewatch above.</span>}
            {watches.slice(0, 30).map((w, i) => (
              <div key={`${w.t.id}-${w.date}-${i}`} className="grid grid-cols-[88px_40px_minmax(0,1fr)_auto] items-center gap-x-3.5 py-2" style={i < 12 ? fromRight(220 + i * 45) : undefined}>
                <span className="text-[15px] tabular-nums text-muted">{fmtDate(w.date)}</span>
                <img src={poster(w.t, 'w154')} alt="" width={40} height={60} className="h-[60px] w-10 rounded-[3px] bg-track object-cover" />
                <button type="button" onClick={e => onOpen(w.t, e)} className="min-w-0 border-0 bg-transparent p-0 text-left text-[17px] font-semibold leading-tight text-ink">
                  {w.t.title}
                </button>
                <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold ${w.rewatch ? 'bg-[#2A2312] text-gold' : 'bg-[#2A1415] text-[#F07B7B]'}`}>
                  {w.rewatch ? 'Rewatch' : 'Marathon'}
                </span>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}

function PosterButton({ t, onOpen }: { t: Title; onOpen: Props['onOpen'] }) {
  return (
    <button type="button" onClick={e => onOpen(t, e)} aria-label={`Details for ${t.title}`} className="shrink-0 border-0 bg-transparent p-0">
      <img src={poster(t, 'w154')} alt="" width={48} height={72} className="block h-[72px] w-12 rounded-[3px] bg-track object-cover" />
    </button>
  )
}
