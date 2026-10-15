import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { countLabel, duration, fmtDate, isDone, poster, released, totalMins, watchCount, type Progress, type Title } from './data'

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
}

// The card that opens when you tap a poster or title.
export default function Details({ t, p, services, from, onClose, onToggle, onRewatch }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [closing, setClosing] = useState(false)
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
    ? [KIND[t.kind], duration(totalMins(t)), EXTRA[t.category] || null].filter(Boolean).join(' Â· ')
    : [KIND[t.kind], t.release ? `Out ${fmtDate(t.release)}` : 'Date to be announced'].join(' Â· ')

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
          {t.overview && <p className="m-0 leading-relaxed">{t.overview}</p>}
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
                {done ? 'Watched in marathon âś“' : 'Mark watched'}
              </button>
              <button type="button" onClick={onRewatch} className="h-12 rounded-full border-2 border-gold bg-transparent px-[22px] text-[17px] font-bold text-gold">
                + Add rewatch
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
