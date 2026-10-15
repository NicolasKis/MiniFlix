import { useEffect, useRef, useState } from 'react'

// The opening screen: the logo builds itself (red line, nexus dots, gold branch, pruned grey branch),
// the name rises in, then a gold dot travels until the progress is ready and it all fades into the app.
export default function Loading({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [built, setBuilt] = useState(false)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const a = setTimeout(() => setBuilt(true), 1500)
    const b = setTimeout(() => setSlow(true), 2200)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])
  const leaving = built && ready
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => done.current(), 340)
    return () => clearTimeout(t)
  }, [leaving])

  return (
    <div
      role="status"
      aria-label="Loading Sacred Timeline"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-bg"
      style={leaving ? { animation: 'ld-out 340ms ease-in forwards' } : undefined}
    >
      <svg width="216" height="120" viewBox="0 0 72 40" fill="none" aria-hidden="true" className="overflow-visible" style={{ animation: 'ld-glow 1800ms ease-in-out 1400ms infinite' }}>
        <path className="ld-line" pathLength={1} d="M18 26 C27 26 26 9 37 9 H56" stroke="#F5A524" strokeWidth="3" strokeLinecap="round" style={{ animationDelay: '480ms', animationDuration: '420ms' }} />
        <path className="ld-line" pathLength={1} d="M40 26 C47 26 46 36 53 36 H60" stroke="#5A5D66" strokeWidth="3" strokeLinecap="round" style={{ animationDelay: '620ms', animationDuration: '320ms' }} />
        <path className="ld-line" pathLength={1} d="M3 26 H69" stroke="#E23636" strokeWidth="4.5" strokeLinecap="round" />
        <circle className="ld-dot" cx="57" cy="9" r="3.5" fill="#F5A524" style={{ animationDelay: '880ms' }} />
        <path className="ld-x" d="M63 33 L67 39 M67 33 L63 39" stroke="#5A5D66" strokeWidth="2.5" strokeLinecap="round" style={{ animationDelay: '920ms' }} />
        <circle className="ld-dot" cx="18" cy="26" r="4.5" fill="#F2EFEA" style={{ animationDelay: '260ms' }} />
        <circle className="ld-dot" cx="40" cy="26" r="4.5" fill="#F2EFEA" style={{ animationDelay: '380ms' }} />
      </svg>
      <div className="flex flex-col items-center font-display text-[44px] font-extrabold uppercase leading-[0.92] tracking-[-0.01em]">
        <span className="block overflow-hidden"><span className="ld-word" style={{ animationDelay: '960ms' }}>Sacred</span></span>
        <span className="block overflow-hidden"><span className="ld-word" style={{ animationDelay: '1040ms' }}>Timeline</span></span>
      </div>
      <div className="flex flex-col items-center gap-3 opacity-0" style={{ animation: 'st-fade 300ms ease-out 1400ms forwards' }}>
        <div className="relative h-1 w-[210px] rounded-sm bg-track">
          <span className="absolute -top-1 left-0 size-3 rounded-full bg-gold shadow-[0_0_12px_3px_rgba(245,165,36,0.7)]" style={{ animation: 'ld-travel 1000ms cubic-bezier(.4,0,.2,1) 1400ms infinite' }} />
        </div>
        <span className="text-[15px] text-muted">{slow ? 'Syncing your progress…' : 'Opening your timeline…'}</span>
      </div>
    </div>
  )
}
