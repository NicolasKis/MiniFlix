import { useState } from 'react'
import { countLabel, fmtDate, poster, released, titles, watchCount, watchedOn, type Progress, type Title } from './data'

type Props = { p: Progress; onOpen: (t: Title) => void; onRewatch: (t: Title) => void }

const byId = new Map(titles.map(t => [t.id, t]))

// Every watch, newest first: marathon ticks and rewatches together.
export default function History({ p, onOpen, onRewatch }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const watches = [
    ...titles.flatMap(t => {
      const date = watchedOn(t, p)
      return date ? [{ t, date, rewatch: false }] : []
    }),
    ...p.log.flatMap(e => {
      const t = byId.get(e.id)
      return t ? [{ t, date: e.date, rewatch: true }] : []
    }),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const seen = titles.filter(t => watchCount(t, p) > 0)
  const top = [...seen].sort((a, b) => watchCount(b, p) - watchCount(a, p)).slice(0, 3)
  const results = q ? titles.filter(t => t.title.toLowerCase().includes(q)) : []

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
        <h1 className="m-0 font-display text-[clamp(64px,9vw,112px)] font-extrabold uppercase leading-[0.85]">History</h1>
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
                {top.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpen(t)}
                    className="flex min-w-[150px] flex-[0_1_220px] items-center gap-3.5 rounded-xl border-0 bg-surface p-3 text-left text-ink"
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

          <section aria-labelledby="st-recent" className="flex flex-col gap-1">
            <h2 id="st-recent" className="m-0 mb-3 font-display text-4xl font-extrabold uppercase leading-none">Recent watches</h2>
            {watches.length === 0 && <span className="text-muted">Nothing yet. Tick a title on the timeline or log a rewatch above.</span>}
            {watches.slice(0, 30).map((w, i) => (
              <div key={`${w.t.id}-${w.date}-${i}`} className="grid grid-cols-[88px_40px_minmax(0,1fr)_auto] items-center gap-x-3.5 py-2">
                <span className="text-[15px] tabular-nums text-muted">{fmtDate(w.date)}</span>
                <img src={poster(w.t, 'w154')} alt="" width={40} height={60} className="h-[60px] w-10 rounded-[3px] bg-track object-cover" />
                <button type="button" onClick={() => onOpen(w.t)} className="min-w-0 border-0 bg-transparent p-0 text-left text-[17px] font-semibold leading-tight text-ink">
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

function PosterButton({ t, onOpen }: { t: Title; onOpen: (t: Title) => void }) {
  return (
    <button type="button" onClick={() => onOpen(t)} aria-label={`Details for ${t.title}`} className="shrink-0 border-0 bg-transparent p-0">
      <img src={poster(t, 'w154')} alt="" width={48} height={72} className="block h-[72px] w-12 rounded-[3px] bg-track object-cover" />
    </button>
  )
}
