import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CreditsIcon } from './icons'
import { countLabel, creditsText, duration, fmtDate, isDone, poster, released, totalMins, watchCount, type Progress, type Title } from './data'

const KIND = { movie: 'Film', series: 'Series', special: 'Special' } as const
const EXTRA = { debated: 'Debated canon', side: 'Side story', main: '' } as const

type Props = {
  t: Title
  p: Progress
  services: ReactNode
  // Where the tapped poster sits relative to the screen centre; null skips the zoom.
  from: { dx: number; dy: number } | null
  onClose: () => void
  onToggle: () => void
  onRewatch: () => void
  // Spoiler-free blurs the plot of anything not watched yet until you tap it.
  spoiler: boolean
  hidden: boolean
  onHide: () => void
}

// The card that opens when you tap a poster or title.
export default function Details({ t, p, services, from, onClose, onToggle, onRewatch, spoiler, hidden, onHide }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [closing, setClosing] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const out = released(t)
  const done = out && isDone(t, p)
  // With the zoom on, the card shrinks back into the poster before it goes.
  const close = () => {
    if (!from) return onClose()
    setClosing(true)
    setTimeout(onClose, 220)
  }
  const closeRefFn = useRef(close)
  useEffect(() => { closeRefFn.current = close })

  useEffect(() => closeRef.current?.focus(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRefFn.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const zoom = from
    ? ({ '--dx': `${from.dx}px`, '--dy': `${from.dy}px`, animation: closing ? 'st-unzoom 220ms ease-in both' : 'st-zoom 360ms cubic-bezier(.2,.8,.2,1) both' } as CSSProperties)
    : undefined
  const fade = from ? { animation: closing ? 'st-fade 220ms ease-in reverse both' : 'st-fade 200ms ease-out both' } : undefined

  const meta = out
    ? [KIND[t.kind], duration(totalMins(t)), EXTRA[t.category] || null].filter(Boolean).join(' · ')
    : [KIND[t.kind], t.release ? `Out ${fmtDate(t.release)}` : 'Date to be announced'].join(' · ')

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[rgba(5,6,8,0.8)] p-4"
      style={fade}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        onClick={e => e.stopPropagation()}
        style={zoom}
        className="relative my-auto flex w-full max-w-[760px] flex-wrap gap-6 rounded-2xl bg-surface p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-full border-0 bg-track text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {t.poster && (
          <img src={poster(t, 'w342')} alt={`Poster for ${t.title}`} width={180} height={270} className="h-[270px] w-[180px] shrink-0 rounded-lg bg-track object-cover" />
        )}
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 pr-8">
          <h2 className="m-0 font-display text-[clamp(36px,5vw,52px)] font-extrabold leading-[0.95]">{t.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">{meta}</span>
            {out && services}
          </div>
          {t.overview && (spoiler && !done && !revealed ? (
            <div className="relative overflow-hidden rounded-[10px]">
              <p aria-hidden="true" className="m-0 select-none leading-relaxed blur-[7px]">{t.overview}</p>
              <div className="absolute inset-0 grid place-items-center bg-[rgba(24,26,31,0.35)]">
                <button type="button" onClick={() => setRevealed(true)} className="h-11 rounded-full border-2 border-ink bg-surface px-[18px] text-[15px] font-bold text-ink">
                  Spoiler-free: tap to show the plot
                </button>
              </div>
            </div>
          ) : <p className="m-0 leading-relaxed">{t.overview}</p>)}
          {t.credits && (t.credits.mid || t.credits.end) && (
            <span className="inline-flex items-center gap-2 font-semibold text-gold">
              <CreditsIcon size={16} />
              {creditsText(t.credits, true)}
            </span>
          )}
          {t.note && <p className="m-0 text-muted">{t.note}</p>}
          {out && <span className="font-bold text-gold">{countLabel(watchCount(t, p))}</span>}
          {out && (
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={onToggle}
                aria-pressed={done}
                className={`h-12 rounded-full border-2 px-[22px] text-[17px] font-bold ${done ? 'border-line bg-transparent text-ink' : 'border-btn bg-btn text-white'}`}
              >
                {done ? 'Watched in marathon ✓' : 'Mark watched'}
              </button>
              <button type="button" onClick={onRewatch} className="h-12 rounded-full border-2 border-gold bg-transparent px-[22px] text-[17px] font-bold text-gold">
                + Add rewatch
              </button>
            </div>
          )}
          <div className="mt-1 flex flex-col gap-1 border-t border-[#2C2F36] pt-3">
            <button type="button" onClick={onHide} className="inline-flex h-11 items-center gap-2.5 self-start border-0 bg-transparent px-1 text-base font-bold text-muted">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {hidden ? <><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.5" /></>
                  : <><path d="M3 12s3.5-6 9-6c1.6 0 3 .5 4.2 1.2M21 12s-3.5 6-9 6c-1.6 0-3-.5-4.2-1.2" /><path d="M9.9 14.1a3 3 0 0 1 4.2-4.2" /><path d="M4 20L20 4" /></>}
              </svg>
              {hidden ? 'Show on timeline again' : 'Hide from timeline'}
            </button>
            {!hidden && <span className="text-sm text-muted">It won't show or count anywhere. Turn it back on in TVA, under Hidden titles.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
