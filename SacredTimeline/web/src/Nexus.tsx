import { useEffect, useRef, useState, type CSSProperties } from 'react'

// A little something for whoever taps the logo enough times.
type Phase = 'breach' | 'prune' | 'restore' | 'out'

const MAIN_Y = 300
const COLOURS = ['#F5A524', '#FF7A1A', '#E23636', '#F5A524', '#FFD166']

export default function Nexus({ audio, onDone }: { audio: AudioContext | null; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('breach')
  // Branches and sparks are rolled once per run.
  const [branches] = useState(() =>
    Array.from({ length: 22 }, (_, i) => {
      const x0 = 40 + Math.random() * 860
      const up = i % 2 === 0
      const y1 = MAIN_Y + (up ? -1 : 1) * (60 + Math.random() * 220)
      const len = 110 + Math.random() * 220
      return {
        d: `M${x0} ${MAIN_Y} C${x0 + 55} ${MAIN_Y} ${x0 + 35} ${y1} ${x0 + 110} ${y1} H${x0 + len}`,
        end: { x: x0 + len, y: y1 },
        colour: COLOURS[i % COLOURS.length],
        delay: 450 + i * 85,
        width: 2 + Math.random() * 2.5,
      }
    }),
  )
  const [sparks] = useState(() =>
    Array.from({ length: 36 }, () => ({
      left: Math.random() * 100,
      top: 30 + Math.random() * 40,
      x: (Math.random() - 0.5) * 520,
      y: (Math.random() - 0.5) * 420,
      delay: 300 + Math.random() * 2000,
      size: 2 + Math.random() * 4,
    })),
  )

  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('prune'), 2700),
      setTimeout(() => setPhase('restore'), 3700),
      setTimeout(() => setPhase('out'), 5600),
      setTimeout(() => done.current(), 6100),
    ]
    if (audio) play(audio, branches.map(b => b.delay))
    return () => timers.forEach(clearTimeout)
  }, [audio, branches])

  const pruned = phase !== 'breach'
  const at = (ms: number, name: string, dur: number, ease = 'cubic-bezier(.2,.8,.2,1)'): CSSProperties => ({ animation: `${name} ${dur}ms ${ease} ${ms}ms both` })

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[60] overflow-hidden bg-[#07080A] text-ink"
      style={{ animation: phase === 'out' ? 'ee-out 500ms ease-in forwards' : 'ee-in 180ms ease-out both' }}
    >
      <div className="absolute inset-0" style={{ animation: phase === 'breach' ? 'ee-shake 420ms linear 3' : phase === 'prune' ? 'ee-shake 300ms linear 2' : undefined }}>
        {/* Alarm light sweeping the room */}
        {phase === 'breach' && (
          <div className="absolute left-1/2 top-1/2 size-[220vmax] -translate-x-1/2 -translate-y-1/2 opacity-70 blur-2xl" style={{ background: 'conic-gradient(from 0deg, rgba(226,54,54,.55), transparent 22%, transparent 50%, rgba(255,122,26,.45), transparent 72%)', animation: 'ee-spin 900ms linear infinite' }} />
        )}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,.85) 100%)' }} />

        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
          <defs>
            <filter id="ee-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d={`M-20 ${MAIN_Y} H1020`} stroke="#E23636" strokeWidth="7" strokeLinecap="round" pathLength={1} filter="url(#ee-glow)" style={{ strokeDasharray: 1, ...at(80, 'ee-draw', 520, 'cubic-bezier(.6,0,.2,1)') }} />
          {branches.map((b, i) => (
            <g key={i} style={pruned ? { transition: `opacity 700ms ease ${i * 25}ms`, opacity: phase === 'prune' ? 0.55 : 0 } : undefined}>
              <path
                d={b.d}
                fill="none"
                stroke={pruned ? '#5A5D66' : b.colour}
                strokeWidth={b.width}
                strokeLinecap="round"
                pathLength={1}
                filter={pruned ? undefined : 'url(#ee-glow)'}
                style={{ strokeDasharray: 1, transition: 'stroke 300ms', ...at(b.delay, 'ee-draw', 380) }}
              />
              {pruned ? (
                <path d={`M${b.end.x - 7} ${b.end.y - 7} L${b.end.x + 7} ${b.end.y + 7} M${b.end.x + 7} ${b.end.y - 7} L${b.end.x - 7} ${b.end.y + 7}`} stroke="#A7A39C" strokeWidth="3" strokeLinecap="round" style={{ transformBox: 'fill-box', transformOrigin: 'center', ...at(i * 30, 'ee-cut', 260) }} />
              ) : (
                <circle cx={b.end.x} cy={b.end.y} r={b.width + 3} fill={b.colour} filter="url(#ee-glow)" style={{ transformBox: 'fill-box', transformOrigin: 'center', ...at(b.delay + 360, 'ee-pop', 320) }} />
              )}
            </g>
          ))}
          {[180, 420, 640, 860].map((x, i) => (
            <circle key={x} cx={x} cy={MAIN_Y} r="9" fill="#F2EFEA" style={{ transformBox: 'fill-box', transformOrigin: 'center', ...at(300 + i * 90, 'ee-pop', 320) }} />
          ))}
        </svg>

        {phase === 'breach' && sparks.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-gold"
            style={{
              left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, boxShadow: '0 0 10px 2px rgba(245,165,36,.8)',
              '--x': `${s.x}px`, '--y': `${s.y}px`, animation: `ee-spark 1400ms ease-out ${s.delay}ms both`,
            } as CSSProperties}
          />
        ))}

        {/* Scanlines */}
        <div className="pointer-events-none absolute inset-0 opacity-25" style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.6) 0 2px, transparent 2px 4px)' }} />
      </div>

      <div className="absolute inset-x-4 top-[12%] flex flex-col items-center gap-3 text-center">
        {phase === 'breach' && (
          <>
            <Glitch text="Nexus event" />
            <span className="font-display text-lg font-bold uppercase tracking-[0.3em] text-[#FF7A1A]" style={{ animation: 'ee-blink 500ms steps(2) infinite' }}>Branching detected</span>
          </>
        )}
        {phase === 'prune' && (
          <span className="font-display text-[clamp(48px,11vw,110px)] font-extrabold uppercase leading-none tracking-[0.04em] text-[#F2EFEA]" style={at(0, 'ee-slam', 380)}>Pruning</span>
        )}
      </div>

      {phase === 'prune' && (
        <>
          <span className="absolute left-1/2 top-1/2 size-24 rounded-full border-[6px] border-gold" style={{ translate: '-50% -50%', animation: 'ee-ring 900ms ease-out both' }} />
          <span className="absolute left-1/2 top-1/2 size-24 rounded-full border-4 border-[#FF7A1A]" style={{ translate: '-50% -50%', animation: 'ee-ring 900ms ease-out 160ms both' }} />
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#F5A524" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="absolute left-1/2 top-1/2" style={{ translate: '-50% -50%', filter: 'drop-shadow(0 0 18px rgba(245,165,36,.9))', animation: 'ee-flip 900ms cubic-bezier(.6,0,.2,1) both' }}>
            <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
            <path d="M9.5 18.5h5l-2.5-2.2z" fill="#F5A524" stroke="none" />
          </svg>
          <div className="absolute inset-0 bg-[#FFB347]" style={{ animation: 'ee-flash 600ms ease-out both' }} />
        </>
      )}

      {(phase === 'restore' || phase === 'out') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <svg width="216" height="120" viewBox="0 0 72 40" fill="none" style={{ filter: 'drop-shadow(0 0 16px rgba(245,165,36,.55))', ...at(0, 'ee-pop', 500) }}>
            <path d="M18 26 C27 26 26 9 37 9 H56" stroke="#F5A524" strokeWidth="3" strokeLinecap="round" />
            <path d="M40 26 C47 26 46 36 53 36 H60" stroke="#5A5D66" strokeWidth="3" strokeLinecap="round" />
            <path d="M3 26 H69" stroke="#E23636" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="57" cy="9" r="3.5" fill="#F5A524" />
            <path d="M63 33 L67 39 M67 33 L63 39" stroke="#5A5D66" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="26" r="4.5" fill="#F2EFEA" />
            <circle cx="40" cy="26" r="4.5" fill="#F2EFEA" />
          </svg>
          <span className="font-display text-[clamp(40px,8vw,72px)] font-extrabold uppercase leading-[0.9]" style={at(200, 'ee-rise', 500)}>Timeline restored</span>
          <span className="text-lg text-muted" style={at(450, 'ee-rise', 500)}>The TVA thanks you for your cooperation. Carry on watching.</span>
        </div>
      )}
    </div>
  )
}

function Glitch({ text }: { text: string }) {
  const base = 'font-display text-[clamp(52px,12vw,128px)] font-extrabold uppercase leading-none tracking-[0.02em]'
  return (
    <span className="relative inline-block" style={{ animation: 'ee-slam 420ms cubic-bezier(.2,.8,.2,1) both' }}>
      <span className={`${base} text-[#F2EFEA]`}>{text}</span>
      <span className={`${base} absolute inset-0 text-[#E23636] mix-blend-screen`} style={{ animation: 'ee-glitch 700ms steps(1) infinite', translate: '-4px 0' }}>{text}</span>
      <span className={`${base} absolute inset-0 text-[#4FC3F7] mix-blend-screen`} style={{ animation: 'ee-glitch 900ms steps(1) 120ms infinite reverse', translate: '4px 0' }}>{text}</span>
    </span>
  )
}

// Everything you hear is synthesised on the spot: alarm, rising branches, the prune, and the all-clear.
function play(ctx: AudioContext, blips: number[]) {
  ctx.resume().catch(() => {})
  const t0 = ctx.currentTime + 0.05
  const out = ctx.createDynamicsCompressor()
  const master = ctx.createGain()
  master.gain.value = 0.55
  out.connect(master).connect(ctx.destination)

  const tone = (type: OscillatorType, from: number, to: number, start: number, dur: number, gain: number, filter?: number) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(from, t0 + start)
    o.frequency.exponentialRampToValueAtTime(to, t0 + start + dur)
    g.gain.setValueAtTime(0.0001, t0 + start)
    g.gain.exponentialRampToValueAtTime(gain, t0 + start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
    let node: AudioNode = o
    if (filter) {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = filter
      node = o.connect(f)
    }
    node.connect(g).connect(out)
    o.start(t0 + start)
    o.stop(t0 + start + dur + 0.05)
  }
  const noise = (start: number, dur: number, gain: number, fromHz: number, toHz: number) => {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 0.8
    f.frequency.setValueAtTime(fromHz, t0 + start)
    f.frequency.exponentialRampToValueAtTime(toHz, t0 + start + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0 + start)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
    src.connect(f).connect(g).connect(out)
    src.start(t0 + start)
  }

  // Breach: a low hit, then the two-tone alarm.
  tone('sine', 140, 38, 0, 0.7, 0.9)
  noise(0, 0.5, 0.5, 3000, 200)
  for (let i = 0; i < 4; i++) {
    tone('sawtooth', 520, 880, 0.15 + i * 0.6, 0.3, 0.22, 2200)
    tone('sawtooth', 880, 520, 0.45 + i * 0.6, 0.3, 0.22, 2200)
  }
  // Each new branch chirps as it grows.
  blips.forEach((ms, i) => tone('triangle', 500 + ((i * 137) % 900), 900 + ((i * 211) % 1200), ms / 1000, 0.09, 0.12))
  // Prune: a falling zap, a burst and a deep thud.
  tone('square', 1200, 50, 2.7, 0.55, 0.25, 3000)
  noise(2.7, 0.7, 0.7, 6000, 120)
  tone('sine', 90, 30, 2.75, 0.9, 1)
  // All clear: a bright arpeggio with a soft echo.
  ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((hz, i) => {
    tone('sine', hz, hz, 3.75 + i * 0.11, 1.4, 0.22)
    tone('sine', hz * 2, hz * 2, 3.75 + i * 0.11 + 0.18, 1.1, 0.05)
  })
  tone('triangle', 261.63, 261.63, 3.75, 2, 0.12)
}
