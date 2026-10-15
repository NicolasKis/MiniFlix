import { useState } from 'react'
import {
  ERAS, counts, daysUntil, duration, episodes, fmtDate, isDone, isExtra, poster, released, span, titles, today,
  totalMins, watchedMins, yearOf, type Progress, type Title,
} from './data'
import { Check, Chevron, Logo, Service } from './icons'
import { useProgress } from './store'

const KIND = { movie: 'Film', series: 'Series', special: 'Special' } as const
const EXTRA_LABEL = { debated: 'Debated canon', side: 'Side story', main: '' } as const
const eraAt = new Map(ERAS.map(e => [e.start, e]))

export default function App() {
  const { p, save, offline } = useProgress()
  const [open, setOpen] = useState<Record<string, boolean>>({})

  if (!p) {
    return (
      <main className="min-h-dvh grid place-items-center p-6 text-center text-muted">
        {offline ? "Can't reach the Sacred Timeline server. Check that Tailscale is on, then reload." : 'Loading…'}
      </main>
    )
  }

  // Every change goes through here; the first tick of the watch-through stamps the start date.
  const commit = (patch: Partial<Progress>) => {
    const next = { ...p, ...patch }
    next.started = Object.keys(next.watched).length ? (p.started ?? today()) : null
    save(next)
  }
  const setWatched = (keys: string[], on: boolean) => {
    const w = { ...p.watched }
    for (const k of keys) {
      if (on) w[k] ??= today()
      else delete w[k]
    }
    commit({ watched: w })
  }
  const toggleTitle = (t: Title) =>
    t.kind === 'series'
      ? setWatched(episodes(t).filter(e => e.aired).map(e => e.key), !isDone(t, p))
      : setWatched([t.id], !p.watched[t.id])
  const flip = (field: 'included' | 'minimised', id: string) => commit({ [field]: { ...p[field], [id]: !p[field][id] } })

  const counted = titles.filter(t => counts(t, p))
  const total = counted.reduce((a, t) => a + totalMins(t), 0)
  const watched = counted.reduce((a, t) => a + watchedMins(t, p), 0)
  const pct = total ? Math.floor((watched / total) * 1000) / 10 : 0
  const finished = total > 0 && watched >= total
  const next = counted.find(t => !isDone(t, p))
  const nextEp = next?.kind === 'series' ? episodes(next).find(e => e.aired && !p.watched[e.key]) : undefined

  // Years show once per run; a branch's rail stays red while the main story before it is done.
  const rail = new Map<string, { showYear: boolean; red: boolean }>()
  {
    let prevYear = ''
    let mainDone = false
    for (const t of titles) {
      const out = released(t)
      const done = out && isDone(t, p)
      const branch = isExtra(t) && !p.included[t.id]
      rail.set(t.id, { showYear: yearOf(t) !== prevYear, red: branch ? mainDone : done })
      prevYear = yearOf(t)
      if (!branch && out) mainDone = done
    }
  }

  return (
    <div className="min-h-dvh">
      {offline && (
        <div role="status" className="bg-btn px-5 py-3 text-center text-[15px] font-semibold text-white">
          Can't reach the server. Your last change may not be saved.
        </div>
      )}
      <div className="mx-auto flex max-w-[1120px] flex-col gap-10 px-5 pb-20 pt-5 [padding-top:max(20px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <h1 className="m-0 font-display text-[28px] font-extrabold uppercase leading-[0.9] tracking-[-0.01em]">
              Sacred<br />Timeline
            </h1>
          </div>
          <span className="text-[15px] text-muted">{titles.length} titles in story order</span>
        </header>

        <section aria-label="Progress" className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <span className="font-display text-[clamp(104px,16vw,200px)] font-extrabold leading-[0.8] tracking-[-0.03em]">{pct}%</span>
            <div className="flex flex-col gap-1 pb-1.5">
              <span className="text-[19px]">{duration(watched)} watched out of {duration(total)}.</span>
              <span className="text-muted">
                {!p.started ? 'Your clock starts with the first tick.'
                  : finished ? `Finished in ${span(p.started, today())}.`
                  : p.started === today() ? 'Started today.'
                  : `Started ${fmtDate(p.started)}, ${span(p.started, today())} in.`}
              </span>
            </div>
          </div>
          <div className="h-2.5 bg-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Watch-through progress">
            <div className="h-full bg-red" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[15px] text-muted">Unreleased titles and extras you have not added are not counted.</span>
        </section>

        <section aria-label="Up next" className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 rounded bg-surface px-6 py-7">
          {next ? (
            <>
              <div className="flex min-w-0 items-center gap-5">
                {next.poster && <img src={poster(next, 'w342')} alt="" width={88} height={132} className="h-[132px] w-[88px] shrink-0 rounded object-cover bg-track" />}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h2 className="m-0 font-display text-[clamp(36px,5vw,56px)] font-bold leading-[0.95]">
                    <span className="text-gold">{next.title}</span> is next
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-muted">
                      {nextEp ? `Season ${nextEp.season} · Episode ${nextEp.number} · ${duration(nextEp.min)}` : `${KIND[next.kind]} · ${duration(totalMins(next))}`}
                    </span>
                    <Services t={next} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => (nextEp ? setWatched([nextEp.key], true) : toggleTitle(next))}
                className="h-[52px] rounded-full bg-btn px-7 text-[18px] font-bold text-white active:scale-[0.98]"
              >
                {nextEp ? 'Mark episode watched' : 'Mark watched'}
              </button>
            </>
          ) : (
            <h2 className="m-0 font-display text-[clamp(36px,5vw,56px)] font-bold leading-[0.95]">You're all caught up.</h2>
          )}
        </section>

        <section aria-label="Timeline" className="flex flex-col">
          {titles.map(t => {
            const era = eraAt.get(t.id)
            const out = released(t)
            const done = out && isDone(t, p)
            const extra = isExtra(t)
            const included = extra && !!p.included[t.id]
            const branch = extra && !included
            const mini = branch && !!p.minimised[t.id]
            const year = yearOf(t)
            const { showYear, red: railRed } = rail.get(t.id)!
            const eps = episodes(t)
            const aired = eps.filter(e => e.aired)
            const seasons = t.seasons ?? []
            const meta = out
              ? [KIND[t.kind], seasons.length > 1 ? `${seasons.length} seasons` : null, t.kind === 'series' ? `${aired.length} episodes` : null, duration(totalMins(t)), extra ? EXTRA_LABEL[t.category] : null]
              : [KIND[t.kind], t.release ? `Out ${fmtDate(t.release)}` : 'Date to be announced']

            return (
              <div key={t.id}>
                {era && (
                  <div className="grid grid-cols-[38px_30px_minmax(0,1fr)] gap-x-2 sm:grid-cols-[52px_34px_minmax(0,1fr)] sm:gap-x-3">
                    <span />
                    <div className="relative"><div className={`absolute inset-y-0 left-2.5 w-1 ${railRed ? 'bg-red' : 'bg-track'}`} /></div>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3.5 pt-11">
                      <h2 className="m-0 font-display text-[clamp(34px,4.4vw,48px)] font-extrabold uppercase leading-[0.95]">{era.name}</h2>
                      <span className="text-[15px] text-muted">{era.years}</span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-[38px_30px_minmax(0,1fr)] gap-x-2 sm:grid-cols-[52px_34px_minmax(0,1fr)] sm:gap-x-3">
                  <span className="pt-4 text-right font-display text-base font-semibold tabular-nums text-muted sm:text-xl">{showYear ? year : ''}</span>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-2.5 w-1 ${railRed ? 'bg-red' : 'bg-track'}`} />
                    {branch && (
                      <svg width="34" height="44" viewBox="0 0 34 44" fill="none" aria-hidden="true" className="absolute left-0 top-0">
                        <path d="M12 2 C12 18 26 14 26 29" stroke="#5A5D66" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    )}
                    <div
                      className="absolute box-border rounded-full"
                      style={branch
                        ? { top: 27, left: 19, width: 14, height: 14, border: `3px solid ${done ? '#8A8D96' : '#5A5D66'}`, background: done ? '#8A8D96' : '#0E0F12' }
                        : { top: 20, left: 3, width: 18, height: 18, border: `4px solid ${!out ? '#F5A524' : done ? '#E23636' : '#4A4D55'}`, background: !out ? '#F5A524' : done ? '#E23636' : '#0E0F12' }}
                    />
                  </div>

                  <div className={mini ? 'pb-2.5 pt-3.5' : 'pb-5 pt-3'} style={{ opacity: branch ? 0.55 : 1 }}>
                    <div className="flex items-center gap-3.5">
                      {!mini && t.poster && (
                        <img src={poster(t, 'w154')} alt="" width={48} height={72} loading="lazy" className="h-[72px] w-12 shrink-0 rounded-[3px] object-cover bg-track" />
                      )}
                      <div className="flex min-w-0 flex-auto flex-col gap-0.5">
                        <span className={mini ? 'text-base font-semibold text-muted' : 'text-[19px] font-semibold leading-tight'}>{t.title}</span>
                        {!mini && (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[15px] text-muted">{meta.filter(Boolean).join(' · ')}</span>
                              {out && <Services t={t} />}
                            </div>
                            {t.note && <span className="text-[15px] text-muted">{t.note}</span>}
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col-reverse items-center gap-2 sm:flex-row">
                      {branch && (
                        <button
                          type="button"
                          onClick={() => flip('minimised', t.id)}
                          aria-expanded={!mini}
                          aria-label={`${mini ? 'Expand' : 'Minimise'} ${t.title}`}
                          className="grid size-9 shrink-0 place-items-center rounded-full border-0 bg-surface text-muted"
                        >
                          <Chevron down={mini} />
                        </button>
                      )}
                      {out && !mini && (
                        <button
                          type="button"
                          onClick={() => toggleTitle(t)}
                          aria-pressed={done}
                          aria-label={`${done ? 'Unmark' : 'Mark watched:'} ${t.title}`}
                          className={`grid size-11 shrink-0 place-items-center rounded-full border-2 p-0 active:scale-95 ${done ? 'border-btn bg-btn text-white' : 'border-line bg-transparent text-branch'}`}
                        >
                          <Check />
                        </button>
                      )}
                      {!out && t.release && (
                        <span className="shrink-0 text-right font-display text-2xl font-bold tabular-nums text-gold">In {daysUntil(t.release)} days</span>
                      )}
                      </div>
                    </div>

                    {extra && !mini && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={included}
                        onClick={() => flip('included', t.id)}
                        className="mt-3 flex h-11 items-center gap-3 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink"
                      >
                        <span className={`relative inline-block h-[26px] w-[46px] shrink-0 rounded-full ${included ? 'bg-btn' : 'bg-line'}`}>
                          <span className="absolute top-[3px] size-5 rounded-full bg-ink transition-[left]" style={{ left: included ? 23 : 3 }} />
                        </span>
                        {included ? 'Part of my timeline' : 'Add to my timeline'}
                      </button>
                    )}

                    {out && !mini && t.kind === 'series' && (
                      <div className="flex flex-col gap-2.5 pt-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setOpen({ ...open, [t.id]: !open[t.id] })}
                            aria-expanded={!!open[t.id]}
                            className="h-9 rounded-full border-0 bg-track px-4 text-[15px] font-semibold text-ink"
                          >
                            {open[t.id] ? 'Hide episodes' : 'Episodes'}
                          </button>
                          <span className="text-[15px] text-muted">{aired.filter(e => p.watched[e.key]).length} of {aired.length} watched</span>
                        </div>
                        {open[t.id] && seasons.map(s => {
                          const list = eps.filter(e => e.season === s.season)
                          const keys = list.filter(e => e.aired).map(e => e.key)
                          const all = keys.length > 0 && keys.every(k => p.watched[k])
                          return (
                            <div key={s.season} className="flex flex-col gap-2">
                              <span className="text-[15px] font-bold">Season {s.season}</span>
                              <div className="flex flex-wrap items-center gap-2">
                                {list.map(e => {
                                  const on = !!p.watched[e.key]
                                  return (
                                    <button
                                      key={e.key}
                                      type="button"
                                      disabled={!e.aired}
                                      title={e.aired ? undefined : `Airs ${e.airs ? fmtDate(e.airs) : 'soon'}`}
                                      onClick={() => setWatched([e.key], !on)}
                                      aria-pressed={on}
                                      aria-label={`Season ${s.season} episode ${e.number}${on ? ', watched' : ''}${e.aired ? '' : ', not out yet'}`}
                                      className={`size-10 rounded-lg border-0 text-[15px] font-bold tabular-nums ${on ? 'bg-btn text-white' : 'bg-track text-ink'} disabled:cursor-default disabled:opacity-35`}
                                    >
                                      {e.number}
                                    </button>
                                  )
                                })}
                                {keys.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setWatched(keys, !all)}
                                    className="h-10 rounded-full border-0 bg-ink px-4 text-[15px] font-bold text-bg"
                                  >
                                    {all ? 'Unmark season' : 'Whole season'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        <footer className="text-sm text-muted">
          Posters and episode data from TMDB. This app uses the TMDB API but is not endorsed or certified by TMDB.
        </footer>
      </div>
    </div>
  )
}

function Services({ t }: { t: Title }) {
  const list = t.where.length ? t.where : ['rent']
  return (
    <span className="inline-flex items-center gap-1.5">
      {list.map(w => <Service key={w} name={w} />)}
    </span>
  )
}
