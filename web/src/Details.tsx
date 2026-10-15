import { useEffect, useRef, type ReactNode } from 'react'
import { countLabel, duration, fmtDate, isDone, poster, released, totalMins, watchCount, type Progress, type Title } from './data'

const KIND = { movie: 'Film', series: 'Series', special: 'Special' } as const
const EXTRA = { debated: 'Debated canon', side: 'Side story', main: '' } as const

type Props = {
  t: Title
  p: Progress
  services: ReactNode
  onClose: () => void
  onToggle: () => void
  onRewatch: () => void
}

// The card that opens when you tap a poster or title.
export default function Details({ t, p, services, onClose, onToggle, onRewatch }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const out = released(t)
  const done = out && isDone(t, p)

  useEffect(() => closeRef.current?.focus(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const meta = out
    ? [KIND[t.kind], duration(totalMins(t)), EXTRA[t.category] || null].filter(Boolean).join(' · ')
    : [KIND[t.kind], t.release ? `Out ${fmtDate(t.release)}` : 'Date to be announced'].join(' · ')

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[rgba(5,6,8,0.8)] p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        onClick={e => e.stopPropagation()}
        className="relative my-auto flex w-full max-w-[760px] flex-wrap gap-6 rounded-2xl bg-surface p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
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
                {done ? 'Watched in marathon ✓' : 'Mark watched'}
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
