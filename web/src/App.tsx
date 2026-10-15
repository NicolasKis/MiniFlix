import { Fragment, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { useAnim } from './anim'
import {
  ERAS, counts, creditsText, daysUntil, duration, episodes, fmtDate, isDone, isExtra, poster, released, sagaMap, shown, span, titles, today,
  QUALITY_STYLE, totalMins, totals, watchCount, yearOf, type Progress, type Title,
} from './data'
import Details from './Details'
import History from './History'
import { Check, Chevron, CreditsIcon, Logo, Service } from './icons'
import Loading from './Loading'
import { useProgress, useTva, type JellyfinItem, type Net } from './store'
import Tva from './Tva'
import Wrapped from './Wrapped'

const KIND = { movie: 'Film', series: 'Series', special: 'Special' } as const
const EXTRA_LABEL = { debated: 'Debated canon', side: 'Side story', main: '' } as const
const STOP_LABEL = ['Origins', 'Infinity', 'Multiverse', 'Doomsday']
const EASE = 'cubic-bezier(.2,.8,.2,1)'


type Screen = 'timeline' | 'history' | 'tva'
type Toast = { id: number; label: string; before: Progress }
// The last thing you did, so its animation can play once (n restarts it).
type Fx = { id: string; kind: 'tick' | 'untick' | 'season' | 'branch-out'; season?: number; n: number }

export default function App() {
  const { p, save, net } = useProgress()
  const tva = useTva()
  const anim = useAnim()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<Toast | null>(null)
  const [screen, setScreen] = useState<Screen>('timeline')
  const [entering, setEntering] = useState<{ screen: Screen; n: number } | null>(null)
  const [detail, setDetail] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const [fx, setFx] = useState<Fx | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [celebrate, setCelebrate] = useState<{ era: number; n: number } | null>(null)
  const [travel, setTravel] = useState<{ pos: number } | null>(null)
  const [arrived, setArrived] = useState<{ era: number; n: number } | null>(null)
  // Hide watched, Spoiler-free and folded sagas are per-device preferences, so they live in this browser only.
  const [hideWatched, toggleHide] = useLocalFlag('st-hide-watched')
  const [spoiler, toggleSpoiler] = useLocalFlag('st-spoiler')
  const [folded, setFolded] = useState<Record<number, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('st-collapsed') ?? '{}') } catch { return {} }
  })
  const toggleFold = (i: number) => {
    const next = { ...folded, [i]: !folded[i] }
    setFolded(next)
    try { localStorage.setItem('st-collapsed', JSON.stringify(next)) } catch { /* private mode: keep it for this visit */ }
  }
  const [menuOpen, setMenuOpen] = useState(false)
  const [plan, setPlan] = useState<number | null>(null)
  const [recapClosed, setRecapClosed] = useState(false)
  const [showWrapped, setShowWrapped] = useState(false)
  // The logo builds itself while the app opens (it has its own animation switch).
  const [loading, setLoading] = useState(() => anim.on('loading'))

  // The Undo bar disappears 5 seconds after the last tick.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])
  // Entrance animations run once, right after you switch screens.
  useEffect(() => {
    if (!entering) return
    const timer = setTimeout(() => setEntering(null), 1300)
    return () => clearTimeout(timer)
  }, [entering])
  useEffect(() => {
    if (!celebrate) return
    const timer = setTimeout(() => setCelebrate(null), 1800)
    return () => clearTimeout(timer)
  }, [celebrate])

  const pctNow = p ? totals(p).pct : 0
  const shownPct = useRolling(pctNow, anim.on('counter'), entering?.screen === 'timeline' && anim.on('timeline') ? entering.n : 0)

  const splash = loading && <Loading ready={!!p || net.offline} onDone={() => setLoading(false)} />
  if (!p) {
    return splash || (
      <main className="min-h-dvh grid place-items-center p-6 text-center text-muted">
        {net.offline ? "Can't reach the Sacred Timeline server. Check that Tailscale is on, then reload." : 'Loading…'}
      </main>
    )
  }

  const go = (s: Screen) => {
    setMenuOpen(false)
    if (s === screen) return
    setScreen(s)
    setEntering({ screen: s, n: (entering?.n ?? 0) + 1 })
    window.scrollTo(0, 0)
  }
  const play = (next: Omit<Fx, 'n'>) => setFx({ ...next, n: (fx?.n ?? 0) + 1 })

  // Every change goes through here; the first tick of the watch-through stamps the start date.
  const commit = (patch: Partial<Progress>) => {
    const next = { ...p, ...patch }
    next.started = Object.keys(next.watched).length ? (p.started ?? today()) : null
    save(next)
  }
  // Every tick also offers Undo, holding the progress from just before it.
  const setWatched = (keys: string[], on: boolean, label: string) => {
    const w = { ...p.watched }
    for (const k of keys) {
      if (on) w[k] ??= today()
      else delete w[k]
    }
    commit({ watched: w })
    setToast({ id: (toast?.id ?? 0) + 1, label, before: p })
    // Ticking the very last title opens the Wrapped card.
    const done = (x: Progress) => { const r = totals(x); return r.total > 0 && r.watched >= r.total }
    if (!done(p) && done({ ...p, watched: w })) setShowWrapped(true)
  }
  const setHidden = (t: Title, on: boolean) => {
    const h = { ...p.hidden }
    if (on) h[t.id] = true
    else delete h[t.id]
    commit({ hidden: h })
    setToast({ id: (toast?.id ?? 0) + 1, label: on ? `${t.title} hidden from the timeline` : `${t.title} is back on the timeline`, before: p })
  }
  const rewatch = (t: Title) => {
    commit({ log: [...p.log, { id: t.id, date: today() }] })
    setToast({ id: (toast?.id ?? 0) + 1, label: `Added a rewatch of ${t.title}`, before: p })
  }
  const undo = () => {
    if (!toast) return
    save(toast.before)
    setToast(null)
  }

  const eraOf = sagaMap()
  const list = shown(p)
  const { counted, total, watched } = totals(p)
  const finished = total > 0 && watched >= total
  const next = counted.find(t => !isDone(t, p))
  const nextEp = next?.kind === 'series' ? episodes(next).find(e => e.aired && !p.watched[e.key]) : undefined

  // A saga is complete when every released title that counts (main plus extras you added) is watched.
  const sagaTitles = (i: number) => list.filter(t => eraOf.get(t.id) === i && counts(t, p))
  const complete = ERAS.map((_, i) => sagaTitles(i).length > 0 && sagaTitles(i).every(t => isDone(t, p)))

  const toggleTitle = (t: Title) => {
    const on = !isDone(t, p)
    let label = on ? `Marked ${t.title} as watched` : `Unmarked ${t.title}`
    const era = eraOf.get(t.id) ?? -1
    if (on && era >= 0 && sagaTitles(era).every(x => x === t || isDone(x, p))) {
      label = `${ERAS[era].name} complete!`
      if (anim.on('celebrate')) setCelebrate({ era, n: (celebrate?.n ?? 0) + 1 })
    }
    if (on && t === next && anim.on('upnext')) {
      setSwapping(true)
      setTimeout(() => setSwapping(false), 600)
    }
    play({ id: t.id, kind: on ? 'tick' : 'untick' })
    if (t.kind === 'series') setWatched(episodes(t).filter(e => e.aired).map(e => e.key), on, label)
    else setWatched([t.id], on, label)
  }
  const flip = (field: 'included' | 'minimised', id: string) => commit({ [field]: { ...p[field], [id]: !p[field][id] } })
  const toggleIncluded = (t: Title) => {
    if (p.included[t.id]) play({ id: t.id, kind: 'branch-out' })
    flip('included', t.id)
  }

  // Finish date from your own pace so far: minutes watched per day since the start.
  const daysIn = p.started ? Math.max(1, daysUntil(today()) - daysUntil(p.started)) : 0
  let leftText = ''
  if (p.started && !finished) {
    const left = total - watched
    if (daysIn < 3 || !watched) leftText = `${duration(left)} left. Your finish date appears after a few days.`
    else {
      const eta = new Date(new Date(`${today()}T00:00:00`).getTime() + Math.ceil(left / (watched / daysIn)) * 86400000)
      leftText = `${duration(left)} left. At your pace, done around ${eta.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.`
    }
  }

  // Saga jump bar: a small timeline, red up to the saga you're in.
  const currentEra = next ? (eraOf.get(next.id) ?? 0) : ERAS.length - 1
  const stops = ERAS.map((era, i) => {
    const inEra = list.filter(t => eraOf.get(t.id) === i)
    const soon = inEra.every(t => !released(t))
    return { era, i, state: soon ? 'soon' : i < currentEra ? 'done' : i === currentEra ? 'here' : 'ahead' }
  })
  const centre = (i: number) => ((i + 0.5) * 100) / ERAS.length
  const jumpTo = (i: number) => {
    document.getElementById(`era-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (!anim.on('jump')) return
    // A gold "time traveller" runs along the bar to the stop, then the saga heading flashes.
    setTravel({ pos: centre(currentEra) })
    setTimeout(() => setTravel({ pos: centre(i) }), 30)
    setTimeout(() => {
      setTravel(null)
      setArrived(a => ({ era: i, n: (a?.n ?? 0) + 1 }))
    }, 560)
  }

  // Jellyfin copies, matched by TMDB id (each Loki season shares the show's id).
  const jellyfin = new Map<string, JellyfinItem>((tva.jellyfin?.items ?? []).filter(i => i.tmdb).map(i => [`${i.type}/${i.tmdb}`, i]))
  const onJellyfin = (t: Title) => (t.tmdb ? jellyfin.get(t.tmdb) : undefined)

  const tucked = (t: Title) => hideWatched && released(t) && isDone(t, p)
  const tuckedInEra = ERAS.map((_, i) => list.filter(t => eraOf.get(t.id) === i && tucked(t)).length)
  // Each saga heading sits above its first title still on the timeline.
  const heads = new Map<string, number>()
  for (const t of list) if (![...heads.values()].includes(eraOf.get(t.id)!)) heads.set(t.id, eraOf.get(t.id)!)
  const isFolded = (i: number) => complete[i] && !!folded[i]

  // "Previously on": after a week or more away, Up next recaps the last thing you watched.
  const lastTick = Object.entries(p.watched).sort((a, b) => b[1].localeCompare(a[1]))[0]
  const lastTitle = lastTick ? list.find(t => t.id === lastTick[0].split(':')[0]) : undefined
  const away = lastTick ? -daysUntil(lastTick[1]) : 0
  const lastEp = lastTick?.[0].split(':')
  const recap = next && lastTitle && away >= 7 && !recapClosed
    ? {
        t: lastTitle,
        heading: `Previously on Sacred Timeline · ${lastTitle.title}${lastEp && lastEp.length === 3 ? ` S${lastEp[1]} E${lastEp[2]}` : ''}, ${away} days ago`,
        text: lastTitle.overview?.split(/(?<=\.)\s/)[0] ?? '',
      }
    : null

  // Tonight planner: what fits, in timeline order, into the time you have.
  const minsLeft = (t: Title) => (t.kind === 'series' ? episodes(t).filter(e => e.aired && !p.watched[e.key]).reduce((a, e) => a + e.min, 0) : totalMins(t))
  let planText = ''
  if (plan && next) {
    let used = 0
    const picks: string[] = []
    for (const t of counted.filter(x => !isDone(x, p))) {
      if (used + minsLeft(t) > plan) break
      used += minsLeft(t)
      picks.push(t.title)
    }
    const names = picks.length < 2 ? picks.join('') : `${picks.slice(0, -1).join(', ')} and ${picks[picks.length - 1]}`
    planText = !picks.length
      ? `Nothing fits fully tonight: ${next.title} needs ${duration(minsLeft(next))}.`
      : `That fits ${names} (${duration(used)})${plan - used >= 5 ? `, with ${duration(plan - used)} to spare.` : '.'}`
  }
  const detailTitle = detail ? titles.find(t => t.id === detail.id) : undefined
  // The details card grows out of whatever you tapped, so remember where that was.
  const openDetail = (t: Title, e?: MouseEvent<HTMLElement>) => {
    const r = e?.currentTarget.getBoundingClientRect()
    setDetail({ id: t.id, dx: r ? Math.round(r.left + r.width / 2 - innerWidth / 2) : 0, dy: r ? Math.round(r.top + r.height / 2 - innerHeight / 2) : 0 })
  }

  // Years show once per run; a branch's rail stays red while the main story before it is done.
  const rail = new Map<string, { showYear: boolean; red: boolean }>()
  {
    let prevYear = ''
    let mainDone = false
    for (const t of list) {
      const out = released(t)
      const done = out && isDone(t, p)
      const branch = isExtra(t) && !p.included[t.id]
      rail.set(t.id, { showYear: yearOf(t) !== prevYear, red: branch ? mainDone : done })
      prevYear = yearOf(t)
      if (!branch && out) mainDone = done
    }
  }

  const entT = entering?.screen === 'timeline' && anim.on('timeline')
  const up = (delay: number): CSSProperties | undefined => (entT ? { animation: `st-up 420ms ${EASE} ${delay}ms both` } : undefined)
  // Timeline entrance: the line draws down and rows rise in, one after another (first dozen only).
  let rowIdx = 0
  const rowDelay = (i: number) => 140 + Math.min(i, 12) * 45
  const enterRow = (i: number) => (entT && i <= 14 ? up(rowDelay(i)) : undefined)
  const enterRail = (i: number): CSSProperties | undefined =>
    entT && i <= 14 ? { transformOrigin: 'top', animation: `st-draw-down 260ms ease-out ${rowDelay(i)}ms both` } : undefined
  const tickFx = anim.on('tick') ? fx : null

  return (
    <div className="min-h-dvh">
      {/* The safe-area insets keep content clear of the iPhone camera cutout and home bar. */}
      <div
        className="mx-auto flex max-w-[1120px] flex-col gap-10 px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
      >
        <header className="relative z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3">
            <Logo />
            <h1 className="m-0 font-display text-[28px] font-extrabold uppercase leading-[0.9] tracking-[-0.01em]">
              Sacred<br />Timeline
            </h1>
          </div>
          <SyncPill net={net} />
          <div className="flex items-center gap-2">
            <nav aria-label="Screens" className="hidden gap-1 rounded-full bg-surface p-1 sm:flex">
              {(['timeline', 'history'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => go(s)}
                  aria-current={screen === s ? 'page' : undefined}
                  className={`h-10 rounded-full border-0 px-4 text-base font-bold capitalize sm:px-[18px] ${screen === s ? 'bg-ink text-bg' : 'bg-transparent text-ink'}`}
                >
                  {s}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => go('tva')}
              aria-current={screen === 'tva' ? 'page' : undefined}
              className={`hidden h-12 items-center gap-2 rounded-full border-0 pl-3 pr-4 text-base font-extrabold tracking-[0.04em] sm:flex ${screen === 'tva' ? 'bg-gold text-bg' : 'bg-surface text-gold'}`}
            >
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                style={{ transform: `rotate(${screen === 'tva' ? 180 : 0}deg)`, transition: anim.on('tva') ? `transform 420ms ${EASE}` : undefined }}
              >
                <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
                <path d="M9.5 18.5h5l-2.5-2.2z" fill="currentColor" stroke="none" />
                {entering?.screen === 'tva' && anim.on('tva') && (
                  <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" className="[animation:st-sand_450ms_linear_120ms_2_both]" />
                )}
              </svg>
              TVA
              {tva.variances.length > 0 && (
                <span aria-label={`${tva.variances.length} changes to review`} className="-mr-1 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-red px-1.5 text-[13px] font-extrabold tracking-normal text-white">
                  {tva.variances.length}
                </span>
              )}
            </button>
            {/* Phones get one menu button instead of the tabs, with the TVA count on it. */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={tva.variances.length ? `Menu, ${tva.variances.length} TVA changes to review` : 'Menu'}
              className="relative grid size-12 place-items-center rounded-full border-0 bg-surface p-0 text-ink sm:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
              {tva.variances.length > 0 && (
                <span aria-hidden="true" className="absolute right-0.5 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-bg bg-red px-[5px] text-[11px] font-extrabold text-white">
                  {tva.variances.length}
                </span>
              )}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 sm:hidden" onClick={() => setMenuOpen(false)} />
                <nav aria-label="Screens" className="absolute right-0 top-[60px] flex w-[230px] origin-top-right flex-col gap-1 rounded-2xl bg-surface p-2 shadow-[0_16px_40px_rgba(0,0,0,0.6)] [animation:st-menu_200ms_cubic-bezier(.2,.8,.2,1)_both] sm:hidden">
                  {([['timeline', 'Timeline'], ['history', 'History'], ['tva', 'TVA']] as const).map(([s, label]) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => go(s)}
                      aria-current={screen === s ? 'page' : undefined}
                      className={`flex h-12 items-center justify-between rounded-xl border-0 px-4 text-left text-[17px] font-bold ${screen === s ? 'bg-ink text-bg' : 'bg-transparent text-ink'}`}
                    >
                      {label}
                      {s === 'tva' && tva.variances.length > 0 && (
                        <span className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-red px-1.5 text-[13px] font-extrabold text-white">{tva.variances.length}</span>
                      )}
                    </button>
                  ))}
                </nav>
              </>
            )}
          </div>
        </header>

        {screen === 'tva' ? (
          <Tva
            tva={tva}
            anim={anim}
            entering={entering?.screen === 'tva'}
            hidden={titles.filter(t => p.hidden[t.id])}
            onShow={t => setHidden(t, false)}
            onReset={() => save({ watched: {}, included: {}, minimised: {}, started: null, log: [], hidden: p.hidden })}
          />
        ) : screen === 'history' ? (
          <History p={p} onOpen={openDetail} onRewatch={rewatch} entering={entering?.screen === 'history' && anim.on('history')} finished={finished} onWrapped={() => setShowWrapped(true)} />
        ) : (
        <>
        {tva.variances.length > 0 && (
          <div role="status" className="hidden items-center justify-between gap-4 rounded-xl border-2 border-gold bg-[#2A2312] px-5 py-3 sm:flex">
            <span className="font-semibold">The TVA found {tva.variances.length} {tva.variances.length === 1 ? 'change' : 'changes'} to your timeline.</span>
            <button type="button" onClick={() => go('tva')} className="h-10 shrink-0 rounded-full border-0 bg-gold px-5 text-base font-extrabold text-bg">Review</button>
          </div>
        )}
        <section aria-label="Progress" className="flex flex-col gap-3.5" style={up(0)}>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <span className="font-display text-[clamp(104px,16vw,200px)] font-extrabold leading-[0.8] tracking-[-0.03em]">{shownPct}%</span>
            <div className="flex flex-col gap-1 pb-1.5">
              <span className="text-[19px]">{duration(watched)} watched out of {duration(total)}.</span>
              <span className="text-muted">
                {!p.started ? 'Your clock starts with the first tick.'
                  : finished ? `Finished in ${span(p.started, today())}.`
                  : p.started === today() ? 'Started today.'
                  : `Started ${fmtDate(p.started)}, ${span(p.started, today())} in.`}
              </span>
              {leftText && <span>{leftText}</span>}
            </div>
          </div>
          <div className="h-2.5 bg-track" role="progressbar" aria-valuenow={pctNow} aria-valuemin={0} aria-valuemax={100} aria-label="Watch-through progress">
            <div className="h-full bg-red" style={{ width: `${shownPct}%` }} />
          </div>
          <span className="text-[15px] text-muted">Unreleased titles and extras you have not added are not counted.</span>
        </section>

        <section aria-label="Up next" className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 rounded bg-surface px-6 py-7" style={up(80)}>
          {next ? (
            <>
              <div
                key={next.id}
                className="flex min-w-0 items-center gap-5"
                style={swapping ? { animation: `st-swap 440ms ${EASE} both` } : undefined}
              >
                {next.poster && (
                  <button type="button" onClick={e => openDetail(next, e)} aria-label={`Details for ${next.title}`} className="shrink-0 border-0 bg-transparent p-0">
                    <img src={poster(next, 'w342')} alt="" width={88} height={132} className="block h-[132px] w-[88px] rounded bg-track object-cover" />
                  </button>
                )}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h2 className="m-0 font-display text-[clamp(36px,5vw,56px)] font-bold leading-[0.95]">
                    <span className="text-gold">{next.title}</span> is next
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-muted">
                      {nextEp ? `Season ${nextEp.season} · Episode ${nextEp.number} · ${duration(nextEp.min)}` : `${KIND[next.kind]} · ${duration(totalMins(next))}`}
                    </span>
                    <Services t={next} jf={onJellyfin(next)} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => (nextEp ? setWatched([nextEp.key], true, `Marked ${next.title} S${nextEp.season} E${nextEp.number}`) : toggleTitle(next))}
                className="h-[52px] rounded-full bg-btn px-7 text-[18px] font-bold text-white active:scale-[0.98]"
              >
                {nextEp ? 'Mark episode watched' : 'Mark watched'}
              </button>
              {recap && (
                <div className="order-3 flex basis-full items-start gap-3.5 rounded-[10px] bg-track px-4 py-3.5">
                  {recap.t.poster && <img src={poster(recap.t, 'w154')} alt="" width={40} height={60} className="h-[60px] w-10 shrink-0 rounded-[3px] object-cover" />}
                  <div className="flex min-w-0 flex-auto flex-col gap-1">
                    <span className="text-sm font-bold text-gold">{recap.heading}</span>
                    {recap.text && <span className="text-base leading-snug">{recap.text}</span>}
                  </div>
                  <button type="button" onClick={() => setRecapClosed(true)} aria-label="Hide the recap" className="grid size-9 shrink-0 place-items-center rounded-full border-0 bg-transparent text-muted">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
              )}
              <div className="order-4 flex basis-full flex-col gap-2.5">
                <span className="font-semibold text-muted">Tonight I have</span>
                <div role="group" aria-label="Tonight I have" className="grid max-w-[360px] grid-cols-4 gap-2">
                  {[60, 120, 180, 240].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPlan(plan === m ? null : m)}
                      aria-pressed={plan === m}
                      className={`h-10 rounded-full border-2 px-2 text-[15px] font-bold ${plan === m ? 'border-gold bg-gold text-bg' : 'border-line bg-transparent text-ink'}`}
                    >
                      {m / 60} h
                    </button>
                  ))}
                </div>
                {planText && <span role="status" className="leading-snug">{planText}</span>}
              </div>
            </>
          ) : (
            <h2 className="m-0 font-display text-[clamp(36px,5vw,56px)] font-bold leading-[0.95]">You're all caught up.</h2>
          )}
        </section>

        <nav
          aria-label="Jump to a saga"
          className="sticky top-0 z-10 -mx-5 -my-6 bg-bg px-5 pb-2.5"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}
        >
          <div className="relative flex">
            <div className="absolute inset-x-0 top-[13px] h-1 bg-track" />
            <div className="absolute top-[13px] h-1 bg-red" style={{ left: `${centre(0)}%`, width: `${(currentEra * 100) / ERAS.length}%` }} />
            {travel && (
              <span
                aria-hidden="true"
                className="absolute top-[9px] z-[2] size-3 rounded-full bg-gold shadow-[0_0_14px_4px_rgba(245,165,36,0.75)]"
                style={{ left: `calc(${travel.pos}% - 6px)`, transition: 'left 480ms cubic-bezier(.4,0,.2,1)' }}
              />
            )}
            {stops.map(({ era, i, state }) => (
              <button
                key={era.start}
                type="button"
                onClick={() => jumpTo(i)}
                aria-label={`Jump to ${era.name}${state === 'here' ? ', you are here' : ''}`}
                className="group relative flex min-h-11 min-w-0 flex-1 flex-col items-center gap-1.5 border-0 bg-transparent p-0 pt-1"
              >
                {i === 0 && <StopBranch up />}
                {i === 1 && <StopBranch />}
                <span
                  className="relative z-[1] box-border rounded-full border-4"
                  style={{
                    width: state === 'here' ? 22 : 18,
                    height: state === 'here' ? 22 : 18,
                    marginTop: state === 'here' ? 0 : 2,
                    borderColor: state === 'soon' ? '#F5A524' : state === 'ahead' ? '#4A4D55' : '#E23636',
                    background: state === 'done' ? '#E23636' : state === 'here' ? '#F2EFEA' : '#0E0F12',
                  }}
                />
                <span
                  className={`whitespace-nowrap font-display text-[15px] uppercase tracking-[0.01em] sm:text-[17px] ${state === 'here' ? 'font-extrabold text-ink' : state === 'soon' ? 'font-bold text-gold' : 'font-bold text-muted group-hover:text-ink'}`}
                >
                  {STOP_LABEL[i]}
                </span>
              </button>
            ))}
          </div>
        </nav>

        <div className="-mb-7 flex flex-wrap justify-end gap-x-7 gap-y-2">
          <button
            type="button"
            role="switch"
            aria-checked={spoiler}
            onClick={toggleSpoiler}
            className="flex h-11 items-center gap-3 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink"
          >
            Spoiler-free
            <span className={`relative inline-block h-[26px] w-[46px] shrink-0 rounded-full ${spoiler ? 'bg-btn' : 'bg-line'}`}>
              <span className="absolute top-[3px] size-5 rounded-full bg-ink transition-[left]" style={{ left: spoiler ? 23 : 3 }} />
            </span>
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={hideWatched}
            onClick={toggleHide}
            className="flex h-11 items-center gap-3 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink"
          >
            Hide watched
            <span className={`relative inline-block h-[26px] w-[46px] shrink-0 rounded-full ${hideWatched ? 'bg-btn' : 'bg-line'}`}>
              <span className="absolute top-[3px] size-5 rounded-full bg-ink transition-[left]" style={{ left: hideWatched ? 23 : 3 }} />
            </span>
          </button>
        </div>

        <section aria-label="Timeline" className="flex flex-col">
          {list.map(t => {
            const eraIndex = heads.get(t.id) ?? -1
            const era = eraIndex >= 0 ? ERAS[eraIndex] : undefined
            const foldedAway = isFolded(eraOf.get(t.id) ?? -1)
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
            const mine = tickFx?.id === t.id ? tickFx : null
            const party = celebrate && celebrate.era === eraOf.get(t.id)
            const headIdx = era ? rowIdx++ : 0
            const idx = tucked(t) || foldedAway ? 0 : rowIdx++

            return (
              <div key={t.id}>
                {era && (
                  <div id={`era-${eraIndex}`} className="scroll-mt-20 grid grid-cols-[38px_30px_minmax(0,1fr)] gap-x-2 sm:grid-cols-[52px_34px_minmax(0,1fr)] sm:gap-x-3">
                    <span />
                    <div className="relative">
                      <div
                        className={`absolute inset-y-0 left-2.5 w-1 ${railRed || complete[eraIndex] ? 'bg-red' : 'bg-track'}`}
                        style={celebrate?.era === eraIndex ? { animation: 'st-sparks 900ms ease-out both' } : enterRail(headIdx)}
                      />
                    </div>
                    <div className="relative flex flex-col gap-1.5 pb-3.5 pt-11" style={enterRow(headIdx)}>
                      {celebrate?.era === eraIndex && (
                        <div aria-hidden="true" className="pointer-events-none absolute -inset-x-2 bottom-1.5 top-9 origin-left rounded-lg bg-[rgba(245,165,36,0.22)] [animation:st-sweep_1300ms_ease-out_both]" />
                      )}
                      <span className="relative flex items-center justify-between gap-3">
                        <h2
                          key={arrived?.era === eraIndex ? `arrived-${arrived.n}` : 'head'}
                          className="m-0 font-display text-[clamp(34px,4.4vw,48px)] font-extrabold uppercase leading-[0.95]"
                          style={celebrate?.era === eraIndex ? { animation: 'st-glow-text 1400ms ease-out both' }
                            : arrived?.era === eraIndex && anim.on('jump') ? { animation: 'st-flash 1000ms ease-out both' } : undefined}
                        >
                          {era.name}
                        </h2>
                        {complete[eraIndex] && (
                          <button
                            type="button"
                            onClick={() => toggleFold(eraIndex)}
                            aria-expanded={!isFolded(eraIndex)}
                            aria-label={`${isFolded(eraIndex) ? 'Show' : 'Fold away'} the titles of ${era.name}`}
                            className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-surface text-muted"
                          >
                            <Chevron down={isFolded(eraIndex)} />
                          </button>
                        )}
                      </span>
                      {/* Finished sagas: the stamp gets its own line, with the saga's hours and title count beside it. */}
                      {complete[eraIndex] && (
                        <span className="relative flex flex-wrap items-center gap-x-4 gap-y-3 pb-2 pt-1.5">
                          <span
                            className="inline-block rotate-[-4deg] rounded-md border-[3px] border-red px-3 py-0.5 font-display text-[22px] font-extrabold uppercase tracking-[0.06em] text-[#F07B7B]"
                            style={celebrate?.era === eraIndex ? { animation: `st-stamp-tilt 620ms ${EASE} 250ms both` } : undefined}
                          >
                            Saga complete
                          </span>
                          <span className="font-display text-[22px] font-bold">
                            {duration(sagaTitles(eraIndex).reduce((a, x) => a + totalMins(x), 0))} · {sagaTitles(eraIndex).length} {sagaTitles(eraIndex).length === 1 ? 'title' : 'titles'}
                          </span>
                        </span>
                      )}
                      <span className="relative text-[15px] text-muted">{isFolded(eraIndex) ? `${era.years} · tap the arrow to show its titles` : era.years}</span>
                    </div>
                  </div>
                )}
                {era && tuckedInEra[eraIndex] > 0 && !isFolded(eraIndex) && (
                  <div className="grid grid-cols-[38px_30px_minmax(0,1fr)] gap-x-2 sm:grid-cols-[52px_34px_minmax(0,1fr)] sm:gap-x-3">
                    <span />
                    <div className="relative"><div className={`absolute inset-y-0 left-2.5 w-1 ${railRed ? 'bg-red' : 'bg-track'}`} /></div>
                    <span className="pb-3.5 text-[15px] text-muted">
                      {tuckedInEra[eraIndex]} watched {tuckedInEra[eraIndex] === 1 ? 'title' : 'titles'} hidden
                    </span>
                  </div>
                )}
                {!tucked(t) && !foldedAway && (
                <div className="grid grid-cols-[38px_30px_minmax(0,1fr)] gap-x-2 sm:grid-cols-[52px_34px_minmax(0,1fr)] sm:gap-x-3">
                  <span className="pt-4 text-right font-display text-base font-semibold tabular-nums text-muted sm:text-xl">{showYear ? year : ''}</span>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-2.5 w-1 ${railRed ? 'bg-red' : 'bg-track'}`} style={enterRail(idx)} />
                    {/* The red line grows down on a tick and drains back up on an untick. */}
                    {mine && !branch && (mine.kind === 'tick' || mine.kind === 'untick') && (
                      <div
                        key={mine.n}
                        className="absolute inset-y-0 left-2.5 w-1 origin-top bg-red"
                        style={{ animation: `${mine.kind === 'tick' ? 'st-draw-down 380ms ease-out' : 'st-drain 380ms ease-in'} both` }}
                      />
                    )}
                    {branch && (
                      <svg width="34" height="44" viewBox="0 0 34 44" fill="none" aria-hidden="true" className="absolute left-0 top-0">
                        <path
                          d="M12 2 C12 18 26 14 26 29" stroke="#5A5D66" strokeWidth="3" strokeLinecap="round"
                          style={anim.on('branch') && fx?.id === t.id && fx.kind === 'branch-out' ? { strokeDasharray: 40, animation: 'st-branch-draw 420ms ease-out both' } : undefined}
                        />
                      </svg>
                    )}
                    <div
                      key={party ? `party-${celebrate!.n}` : mine?.kind === 'tick' ? `tick-${mine.n}` : 'dot'}
                      className="absolute box-border rounded-full"
                      style={{
                        ...(branch
                          ? { top: 27, left: 19, width: 14, height: 14, border: `3px solid ${done ? '#8A8D96' : '#5A5D66'}`, background: done ? '#8A8D96' : '#0E0F12' }
                          : { top: 20, left: 3, width: 18, height: 18, border: `4px solid ${!out ? '#F5A524' : done ? '#E23636' : '#4A4D55'}`, background: !out ? '#F5A524' : done ? '#E23636' : '#0E0F12' }),
                        transition: anim.on('branch') ? `left 320ms ${EASE}, top 320ms ${EASE}, width 320ms, height 320ms` : undefined,
                        animation: party && !branch && out ? `st-sparks 700ms ease-out ${idx * 40}ms both`
                          : mine?.kind === 'tick' && !branch ? 'st-ring 650ms ease-out both' : undefined,
                      }}
                    />
                  </div>

                  <div className={mini ? 'pb-2.5 pt-3.5' : 'pb-5 pt-3'} style={{ opacity: branch ? 0.55 : 1, ...enterRow(idx) }}>
                    <div className="flex items-center gap-3.5">
                      {!mini && t.poster && (
                        <button type="button" onClick={e => openDetail(t, e)} aria-label={`Details for ${t.title}`} className="shrink-0 border-0 bg-transparent p-0">
                          <img src={poster(t, 'w154')} alt="" width={48} height={72} loading="lazy" className="block h-[72px] w-12 rounded-[3px] object-cover bg-track" />
                        </button>
                      )}
                      <div className="flex min-w-0 flex-auto flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={e => openDetail(t, e)}
                          className={`border-0 bg-transparent p-0 text-left ${mini ? 'text-base font-semibold text-muted' : 'text-[19px] font-semibold leading-tight text-ink'}`}
                        >
                          {t.title}
                        </button>
                        {!mini && (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[15px] text-muted">{meta.filter(Boolean).join(' · ')}</span>
                              {watchCount(t, p) > 1 && <span className="text-[15px] font-bold text-gold">Watched {watchCount(t, p)}×</span>}
                              {out && <Services t={t} jf={onJellyfin(t)} />}
                              {t.credits && (t.credits.mid || t.credits.end) && (
                                <span title={creditsText(t.credits, true)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#2A2312] px-2 py-0.5 text-[13px] font-bold text-gold">
                                  <CreditsIcon size={12} />
                                  {creditsText(t.credits)}
                                </span>
                              )}
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
                          className={`grid size-11 shrink-0 place-items-center rounded-full border-2 p-0 transition-colors duration-200 active:scale-95 ${done ? 'border-btn bg-btn text-white' : 'border-line bg-transparent text-branch'}`}
                        >
                          <span key={mine ? mine.n : 'still'} className="grid" style={mine && (mine.kind === 'tick' || mine.kind === 'untick') ? { animation: `st-pop 380ms ${EASE} both` } : undefined}>
                            <Check />
                          </span>
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
                        onClick={() => toggleIncluded(t)}
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
                          const ripple = anim.on('season') && fx?.id === t.id && fx.kind === 'season' && fx.season === s.season
                          return (
                            <div key={s.season} className="flex flex-col gap-2">
                              <span className="text-[15px] font-bold">Season {s.season}</span>
                              <div className="flex flex-wrap items-center gap-2">
                                <Fragment key={ripple ? `ripple-${fx!.n}` : 'eps'}>
                                {list.map(e => {
                                  const on = !!p.watched[e.key]
                                  return (
                                    <button
                                      key={e.key}
                                      type="button"
                                      disabled={!e.aired}
                                      title={e.aired ? undefined : `Airs ${e.airs ? fmtDate(e.airs) : 'soon'}`}
                                      onClick={() => setWatched([e.key], !on, `${on ? 'Unmarked' : 'Marked'} ${t.title} S${s.season} E${e.number}`)}
                                      aria-pressed={on}
                                      aria-label={`Season ${s.season} episode ${e.number}${on ? ', watched' : ''}${e.aired ? '' : ', not out yet'}`}
                                      className={`size-10 rounded-lg border-0 text-[15px] font-bold tabular-nums transition-colors ${on ? 'bg-btn text-white' : 'bg-track text-ink'} disabled:cursor-default disabled:opacity-35`}
                                      style={ripple ? { animation: `st-ripple 420ms ease-out ${(e.number - 1) * 45}ms both` } : undefined}
                                    >
                                      {e.number}
                                    </button>
                                  )
                                })}
                                </Fragment>
                                {keys.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!all) play({ id: t.id, kind: 'season', season: s.season })
                                      setWatched(keys, !all, `${all ? 'Unmarked' : 'Marked'} ${t.title} season ${s.season}`)
                                    }}
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
                )}
              </div>
            )
          })}
        </section>
        </>
        )}

        <footer className="text-sm text-muted">
          Posters and episode data from TMDB. This app uses the TMDB API but is not endorsed or certified by TMDB.
        </footer>
      </div>
      {detailTitle && (
        <Details
          key={detailTitle.id}
          t={detailTitle}
          p={p}
          services={<Services t={detailTitle} jf={onJellyfin(detailTitle)} />}
          from={anim.on('detail') ? detail : null}
          onClose={() => setDetail(null)}
          onToggle={() => toggleTitle(detailTitle)}
          onRewatch={() => rewatch(detailTitle)}
          spoiler={spoiler}
          hidden={!!p.hidden[detailTitle.id]}
          onHide={() => {
            setDetail(null)
            setHidden(detailTitle, !p.hidden[detailTitle.id])
          }}
        />
      )}
      {showWrapped && <Wrapped p={p} onClose={() => setShowWrapped(false)} />}
      {splash}
      <BackToTop raised={!!toast} />
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="fixed left-1/2 z-40 flex w-max max-w-[calc(100%-32px)] items-center gap-3.5 overflow-hidden rounded-2xl bg-track py-2.5 pl-3.5 pr-2.5 text-ink shadow-[0_10px_32px_rgba(0,0,0,0.6)] [animation:st-rise_220ms_ease-out_both]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)', transform: 'translateX(-50%)' }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
            <circle cx="14" cy="14" r="14" fill="#E23636" />
            <path d="M8.5 14.5l3.5 3.5 7.5-8" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0 truncate text-base font-semibold">{toast.label}</span>
          <button type="button" onClick={undo} className="h-10 shrink-0 rounded-full border-0 bg-gold px-[18px] text-base font-bold text-bg">
            Undo
          </button>
          <div className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-red [animation:st-countdown_5s_linear_forwards]" />
        </div>
      )}
    </div>
  )
}

// An on/off preference kept in this browser only.
function useLocalFlag(key: string) {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(key) === '1' } catch { return false }
  })
  const toggle = () => {
    setOn(!on)
    try { localStorage.setItem(key, on ? '0' : '1') } catch { /* private mode: keep it for this visit */ }
  }
  return [on, toggle] as const
}

// The big percentage rolls to its new value (and counts up from 0 each time the timeline opens).
function useRolling(target: number, animate: boolean, fromZero: number) {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  useEffect(() => {
    const from = fromZero ? 0 : shownRef.current
    if ((!animate && !fromZero) || from === target) {
      shownRef.current = target
      setShown(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 650)
      const value = Math.round((from + (target - from) * (1 - Math.pow(1 - t, 3))) * 10) / 10
      shownRef.current = value
      setShown(value)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, animate, fromZero])
  return shown
}

// Decorative branches on the jump bar, like the logo: gold one survives, grey one is pruned.
function StopBranch({ up = false }: { up?: boolean }) {
  return up ? (
    <svg width="56" height="22" viewBox="0 0 56 22" aria-hidden="true" className="absolute left-1/2 top-[-6px] ml-2.5">
      <path d="M2 19 C12 19 12 5 24 5 H46" fill="none" stroke="#F5A524" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="5" r="3" fill="#F5A524" />
    </svg>
  ) : (
    <svg width="56" height="22" viewBox="0 0 56 22" aria-hidden="true" className="absolute left-1/2 top-3 ml-2.5">
      <path d="M2 3 C12 3 12 11 24 11 H38" fill="none" stroke="#5A5D66" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M42 8 L47 14 M47 8 L42 14" stroke="#5A5D66" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

// Appears once you are well down the list.
function BackToTop({ raised }: { raised: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed right-5 grid size-12 place-items-center rounded-full border-0 bg-ink text-bg shadow-[0_6px_20px_rgba(0,0,0,0.5)] active:scale-95"
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${raised ? 88 : 20}px)`, transition: 'bottom 200ms ease' }}
    >
      <Chevron down={false} />
    </button>
  )
}

// Where to watch: streaming services, plus your own Jellyfin copy with its quality.
function Services({ t, jf }: { t: Title; jf?: JellyfinItem }) {
  const list = t.where.length ? t.where : jf ? [] : ['rent']
  return (
    <span className="inline-flex items-center gap-1.5">
      {list.map(w => <Service key={w} name={w} />)}
      {jf && <Service name="Jellyfin" />}
      {jf?.quality && <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[13px] font-bold ${QUALITY_STYLE[jf.quality]}`}>{jf.quality}</span>}
    </span>
  )
}

// Offline, ticks stay on this device; the pill says so and confirms once they reach the server.
function SyncPill({ net }: { net: Net }) {
  if (!net.offline && !net.sync) return null
  const [dot, text] = net.offline
    ? ['bg-red', net.pending ? `Offline · ${net.pending} ${net.pending === 1 ? 'change' : 'changes'} saved on this device` : 'Offline']
    : net.sync === 'syncing' ? ['bg-gold', 'Back online · syncing…'] : ['bg-[#5BD08A]', 'All synced']
  return (
    <span role="status" className="order-last flex w-full items-center gap-2 text-[15px] font-semibold text-muted sm:order-none sm:w-auto sm:rounded-full sm:bg-surface sm:px-3.5 sm:py-1.5">
      <span className={`size-2.5 shrink-0 rounded-full ${dot}`} />
      {text}
    </span>
  )
}
