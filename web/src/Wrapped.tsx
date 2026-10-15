import { useEffect } from 'react'
import type { Progress } from './data'
import { wrapped } from './stats'

// The red card that opens when the last title is ticked (and again from History).
export default function Wrapped({ p, onClose }: { p: Progress; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(5,6,8,0.85)] p-4 [animation:st-fade_220ms_ease-out_both]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your Sacred Timeline Wrapped"
        onClick={e => e.stopPropagation()}
        className="relative flex w-full max-w-[420px] flex-col gap-[18px] rounded-[22px] bg-red px-7 py-8 text-white shadow-[0_24px_70px_rgba(0,0,0,0.6)] [animation:st-stamp_520ms_cubic-bezier(.2,.8,.2,1)_both]"
      >
        <button type="button" autoFocus onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-11 place-items-center rounded-full border-0 bg-black/20 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <span className="font-display text-xl font-extrabold uppercase tracking-[0.06em] text-[#FFD9D9]">Sacred Timeline Wrapped</span>
        <span className="font-display text-[64px] font-extrabold uppercase leading-[0.9]">Timeline complete</span>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {wrapped(p).map(([value, label]) => (
            <span key={label} className="flex flex-col gap-0.5">
              <span className="font-display text-[38px] font-extrabold leading-none">{value}</span>
              <span className="text-[15px] text-[#FFE3E3]">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
