import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ANIM_GROUPS, type AnimKey, type AnimPrefs } from './anim'
import { QUALITY_STYLE, fmtDate, poster, titles, today, type Title } from './data'
import { NOTIF_KINDS, pushSupported, usePush } from './push'
import { runTask, type Tva as TvaData } from './store'
import { daysOld, fmtBytes, kindOf, useTempad } from './TemPad'

const KIND = { movie: 'Film', series: 'Series', special: 'Special' } as const

type Props = {
  tva: TvaData
  anim: { prefs: Partial<AnimPrefs>; on: (k: AnimKey) => boolean; set: (k: AnimKey | 'all', v: boolean) => void }
  entering: boolean
  hidden: Title[]
  onShow: (t: Title) => void
  onReset: () => void
}

// The server checks on the 1st and 15th of each month.
const nextCheck = () => {
  const d = new Date()
  const next = d.getDate() < 15 ? new Date(d.getFullYear(), d.getMonth(), 15) : new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return next.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const VARIANCE = {
  episodes: { label: 'New episodes', icon: 'EP', tile: 'bg-red text-white text-[17px]' },
  streaming: { label: 'Streaming change', icon: 'D+', tile: 'bg-[#4FC3F7] text-[#06213A] text-[17px]' },
  date: { label: 'Release date change', icon: 'DATE', tile: 'bg-gold text-bg text-[13px]' },
  title: { label: 'New title announced', icon: 'NEW', tile: 'bg-[#A58BF0] text-[#1E1438] text-[13px]' },
} as const

const stamp = (on: boolean, delay: number): CSSProperties | undefined =>
  on ? { animation: `st-stamp 440ms cubic-bezier(.2,.8,.2,1) ${delay}ms both` } : undefined

export default function Tva({ tva, anim, entering, hidden, onShow, onReset }: Props) {
  const push = usePush()
  const [pushMsg, setPushMsg] = useState('')
  const pushDo = async (task: () => Promise<string | null>, ok = '') => {
    setPushMsg('')
    const error = await task().catch(() => "Couldn't set up notifications on this device.")
    setPushMsg(error ?? ok)
  }
  const [busy, setBusy] = useState<'jellyfin' | 'backup' | 'variance' | null>(null)
  const [message, setMessage] = useState<{ task: 'jellyfin' | 'backup' | 'variance'; text: string } | null>(null)
  const [leaving, setLeaving] = useState<string[]>([])
  const [listOpen, setListOpen] = useState(false)
  const [animOpen, setAnimOpen] = useState(false)
  const [hiddenOpen, setHiddenOpen] = useState(false)
  const [padOpen, setPadOpen] = useState(false)
  const [confirm, setConfirm] = useState<'backup' | 'reset' | null>(null)
  const [wasReset, setWasReset] = useState(false)
  const [fresh, setFresh] = useState<string[]>([])
  const tmdbIds = new Map(titles.map(t => [t.tmdb?.split('/')[1], t]))
  const door = entering && anim.on('tva')
  const tasks = anim.on('tasks')

  // Approved or dismissed cards fold away first, then the server applies it.
  const resolve = async (keys: string[], approve: boolean) => {
    setLeaving(keys)
    if (tasks) await new Promise(r => setTimeout(r, 320))
    for (const key of keys) {
      const error = await runTask('variance/resolve', { key, approve })
      if (error) setMessage({ task: 'variance', text: error })
    }
    setLeaving([])
  }

  const run = async (task: 'jellyfin' | 'backup' | 'variance') => {
    const before = new Set((tva.jellyfin?.items ?? []).map(i => i.tmdb))
    setBusy(task)
    setMessage(null)
    const error = await runTask(task)
    setBusy(null)
    setMessage(error ? { task, text: error } : null)
    if (!error && task === 'jellyfin') {
      setListOpen(true)
      // The live record update arrives right after; remember what was there before to spot new titles.
      setFresh([...before].filter(Boolean) as string[])
    }
  }

  const onTimeline = (tva.jellyfin?.items ?? []).filter(i => i.tmdb && tmdbIds.get(i.tmdb) && tmdbIds.get(i.tmdb)!.tmdb?.startsWith(i.type))
  const isNew = (tmdb: string | null) => fresh.length > 0 && tmdb !== null && !fresh.includes(tmdb)
  const checked = tva.jellyfin ? fmtDate(tva.jellyfin.checkedAt.slice(0, 10)) : null
  const backedUp = tva.lastBackup ? tva.lastBackup.slice(0, 10) : null

  return (
    <div className={`relative flex flex-col gap-12 ${door ? '[animation:st-door-open_460ms_cubic-bezier(.2,.8,.2,1)_both]' : ''}`}>
      {door && <div className="st-door-line" aria-hidden="true" />}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4" style={stamp(door, 220)}>
        <h1 className="m-0 font-display text-[clamp(64px,9vw,112px)] font-extrabold uppercase leading-[0.85]">TVA</h1>
        <span className="pb-2 text-[19px] text-muted">Keeps your timeline safe.</span>
      </div>

      <section aria-labelledby="st-var" className="flex flex-col gap-4" style={stamp(door, 250)}>
        <Heading id="st-var" tile="bg-gold" icon={<><path d="M4 14h16" stroke="#0E0F12" strokeWidth="2.2" strokeLinecap="round" /><path d="M9 14c2 0 2-6 5-6h3" fill="none" stroke="#0E0F12" strokeWidth="2.2" strokeLinecap="round" /><circle cx="18" cy="8" r="1.8" fill="#0E0F12" /></>}>
          Variance report
        </Heading>
        <p className="m-0 max-w-[62ch]">Every two weeks the TVA checks TMDB for new episodes, changed release dates, streaming changes and newly announced titles. Nothing changes on your timeline until you approve it.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <TaskButton busy={busy === 'variance'} sand={tasks} disabled={!!busy} onClick={() => run('variance')} className="border-gold bg-transparent text-gold">
            {busy === 'variance' ? 'Checking TMDB…' : 'Check now'}
          </TaskButton>
          <span role="status" className="text-muted">
            {busy === 'variance' ? 'Looking for new episodes, dates and titles…'
              : message?.task === 'variance' ? <span className="text-[#F07B7B]">{message.text}</span>
              : `${tva.varChecked ? `Last checked ${fmtDate(tva.varChecked.slice(0, 10))}. ` : ''}${tva.variances.length ? `${tva.variances.length} ${tva.variances.length === 1 ? 'change waits' : 'changes wait'} for you.` : 'Your timeline is up to date.'} Next automatic check: ${nextCheck()}.`}
          </span>
        </div>
        {tva.variances.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {tva.variances.map((v, i) => (
              <div
                key={v.key}
                className="flex flex-wrap items-center gap-x-4 gap-y-3.5 rounded-xl bg-surface px-4 py-3.5"
                style={leaving.includes(v.key) && tasks ? { animation: `st-fold 320ms ease-in ${i * 40}ms both` } : undefined}
              >
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl font-display font-extrabold tracking-[0.02em] ${VARIANCE[v.kind].tile}`}>{VARIANCE[v.kind].icon}</div>
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                  <span className="text-sm font-bold text-muted">{VARIANCE[v.kind].label}</span>
                  <span className="text-lg font-bold leading-tight">{v.title}</span>
                  <span className="text-[#D9D5CD]">{v.detail}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => resolve([v.key], false)} aria-label={`Dismiss: ${v.title}`} className="h-11 rounded-full border-2 border-line bg-transparent px-4 text-[15px] font-bold text-ink">Dismiss</button>
                  <button type="button" onClick={() => resolve([v.key], true)} aria-label={`Approve: ${v.title}`} className="h-11 rounded-full border-2 border-gold bg-gold px-[18px] text-[15px] font-extrabold text-bg">Approve</button>
                </div>
              </div>
            ))}
            {tva.variances.length > 1 && (
              <button
                type="button"
                onClick={() => resolve(tva.variances.map(v => v.key), true)}
                className="self-start border-0 bg-transparent py-2.5 text-base font-bold text-gold underline underline-offset-4"
              >
                Approve all {tva.variances.length}
              </button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="st-hd" className="flex flex-col gap-4" style={stamp(door, 270)}>
        <Heading id="st-hd" tile="bg-branch" icon={<><path d="M5 12s2.6-4.5 7-4.5S19 12 19 12s-2.6 4.5-7 4.5S5 12 5 12z" fill="none" stroke="#0E0F12" strokeWidth="2" /><circle cx="12" cy="12" r="2" fill="#0E0F12" /><path d="M6 18L18 6" stroke="#0E0F12" strokeWidth="2.2" strokeLinecap="round" /></>}>
          Hidden titles
        </Heading>
        <p className="m-0 max-w-[62ch]">Films and shows you took off the timeline. They don't show or count anywhere; your ticks on them are kept. Hide one from its details card.</p>
        {hidden.length === 0 ? (
          <span className="text-muted">Nothing hidden. Every title is on your timeline.</span>
        ) : (
          <div className="flex flex-col rounded-xl bg-surface px-4 py-1">
            <button
              type="button"
              onClick={() => setHiddenOpen(!hiddenOpen)}
              aria-expanded={hiddenOpen}
              className="flex min-h-14 items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-[17px] font-bold text-ink"
            >
              {hidden.length} hidden {hidden.length === 1 ? 'title' : 'titles'}
              <Chev open={hiddenOpen} />
            </button>
            {hiddenOpen && hidden.map(t => (
              <div key={t.id} className="flex items-center gap-3.5 border-t border-[#2C2F36] py-3">
                <img src={poster(t, 'w154')} alt="" width={40} height={60} className="h-[60px] w-10 shrink-0 rounded-[3px] bg-track object-cover opacity-60 grayscale" />
                <span className="flex min-w-0 flex-auto flex-col gap-0.5">
                  <span className="text-[17px] font-semibold leading-tight text-muted">{t.title}</span>
                  <span className="text-sm text-muted">{[KIND[t.kind], t.release?.slice(0, 4)].filter(Boolean).join(' · ')}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked="false"
                  aria-label={`Show ${t.title} on the timeline again`}
                  onClick={() => onShow(t)}
                  className="flex h-11 shrink-0 items-center gap-2.5 border-0 bg-transparent px-0.5 text-[15px] font-bold text-ink"
                >
                  Show
                  <span className="relative inline-block h-[26px] w-[46px] rounded-full bg-line">
                    <span className="absolute left-[3px] top-[3px] size-5 rounded-full bg-muted" />
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="st-jf" className="flex flex-col gap-4" style={stamp(door, 290)}>
        <Heading id="st-jf" tile="bg-[#A58BF0]" icon={<path d="M12 5.2 L18.6 17.4 Q19 18.2 18.1 18.2 H5.9 Q5 18.2 5.4 17.4 Z M12 11 L9.4 15.6 H14.6 Z" fill="#1E1438" fillRule="evenodd" />}>
          Jellyfin library
        </Heading>
        <p className="m-0 max-w-[60ch]">Looks through your Jellyfin server for films and shows on the timeline, so they get the Jellyfin icon and their quality.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <TaskButton busy={busy === 'jellyfin'} sand={tasks} disabled={!!busy} onClick={() => run('jellyfin')} className="border-[#A58BF0] bg-[#A58BF0] text-[#1E1438]">
            {busy === 'jellyfin' ? 'Checking…' : 'Check library now'}
          </TaskButton>
          <span role="status" className="text-muted">
            {busy === 'jellyfin' ? 'Looking through your movies and shows…'
              : message?.task === 'jellyfin' ? <span className="text-[#F07B7B]">{message.text}</span>
              : checked ? `Last checked ${checked}. Found ${onTimeline.length} timeline ${onTimeline.length === 1 ? 'title' : 'titles'}.`
              : 'Not checked yet.'}
          </span>
        </div>
        {onTimeline.length > 0 && (
          <div className="flex flex-col rounded-xl bg-surface px-5 py-1">
            <button
              type="button"
              onClick={() => setListOpen(!listOpen)}
              aria-expanded={listOpen}
              className="flex min-h-14 items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-[17px] font-bold text-ink"
            >
              {onTimeline.length} timeline {onTimeline.length === 1 ? 'title' : 'titles'} on your Jellyfin
              <Chev open={listOpen} />
            </button>
            {listOpen && (
              <div className="flex flex-col pb-2">
                {onTimeline.map(i => (
                  <div
                    key={i.tmdb}
                    className={`flex min-h-[52px] items-center justify-between gap-3 ${isNew(i.tmdb) && tasks ? '-mx-3 rounded-lg px-3 [animation:st-from-right_420ms_cubic-bezier(.2,.8,.2,1)_both,st-glow_1800ms_ease-out_300ms_both]' : ''}`}
                  >
                    <span className="text-[17px] font-semibold">{tmdbIds.get(i.tmdb!)!.title.replace(/ · Season \d+$/, '')}</span>
                    <span className="flex items-center gap-2">
                      {isNew(i.tmdb) && <span className="rounded-full bg-[#2A2312] px-2.5 py-0.5 text-[13px] font-bold text-gold">New</span>}
                      {i.quality && <span className={`whitespace-nowrap rounded-md px-2.5 py-0.5 text-sm font-bold ${QUALITY_STYLE[i.quality]}`}>{i.quality}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="st-bk" className="flex flex-col gap-4" style={stamp(door, 360)}>
        <Heading id="st-bk" tile="bg-ink" icon={<path d="M12 6v8m0 0l-3.5-3.5M12 14l3.5-3.5M7 17.5h10" fill="none" stroke="#0E0F12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}>
          Backup
        </Heading>
        <p className="m-0 max-w-[60ch]">
          Saves your progress, rewatch history and Jellyfin title list to your private GitHub repo{' '}
          <span className="font-bold text-gold">NicolasKis/sacred-timeline-backups</span>. It only runs when you press the button.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <TaskButton busy={busy === 'backup'} sand={tasks} disabled={!!busy} onClick={() => setConfirm('backup')} className="border-ink bg-ink text-bg">
            {busy === 'backup' ? 'Backing up…' : 'Back up now'}
          </TaskButton>
          <span role="status" className="flex items-center gap-2 text-muted">
            {busy === 'backup' ? 'Saving to GitHub…'
              : message?.task === 'backup' ? <span className="text-[#F07B7B]">{message.text}</span>
              : backedUp ? (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="11" fill="#1F3A24" />
                    <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#7BE08F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={tasks ? { strokeDasharray: 24, animation: 'st-check-draw 420ms ease-out 100ms both' } : undefined} />
                  </svg>
                  Last backup: {backedUp === today() ? 'today' : fmtDate(backedUp)}.
                </>
              ) : 'No backups yet.'}
          </span>
        </div>
      </section>

      <section aria-labelledby="st-nt" className="flex flex-col gap-4" style={stamp(door, 400)}>
        <Heading id="st-nt" tile="bg-[#4FC3F7]" icon={<><path d="M8 16.5h8l-1.2-1.6V11a2.8 2.8 0 0 0-5.6 0v3.9z" fill="#06213A" /><circle cx="12" cy="18.3" r="1.3" fill="#06213A" /></>}>
          Notifications
        </Heading>
        <p className="m-0 max-w-[62ch]">Works on your iPhone when Sacred Timeline is on the Home Screen. Each device is switched on separately.</p>
        {!pushSupported() ? (
          <span className="text-muted">This browser can't show notifications. On iPhone, open Sacred Timeline from its Home Screen icon.</span>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                onClick={() => pushDo(push.on ? push.disable : push.enable)}
                className={`h-12 rounded-full border-2 px-[22px] text-base font-bold ${push.on ? 'border-line bg-transparent text-[#7BE08F]' : 'border-[#4FC3F7] bg-[#4FC3F7] text-[#06213A]'}`}
              >
                {push.on ? 'On for this device · turn off' : 'Turn on notifications'}
              </button>
              {push.on && (
                <button type="button" onClick={() => pushDo(push.test, 'Test sent. It should arrive in a few seconds.')} className="h-12 rounded-full border-2 border-line bg-transparent px-5 text-base font-bold text-ink">
                  Send a test
                </button>
              )}
              {pushMsg && <span role="status" className="text-muted">{pushMsg}</span>}
            </div>
            <div className="flex flex-col rounded-xl bg-surface px-5 py-1">
              {NOTIF_KINDS.map(([key, label, hint]) => (
                <Switch key={key} label={label} hint={hint} dim={!push.on} on={push.kinds[key]} onChange={v => pushDo(() => push.setKind(key, v))} />
              ))}
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="st-tp" className="flex flex-col gap-4" style={stamp(door, 415)}>
        <Heading id="st-tp" tile="bg-gold" icon={<path d="M7 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 9h6M9 12h6M9 15h3" stroke="#0E0F12" strokeWidth="1.8" strokeLinecap="round" fill="none" />}>
          TemPad storage
        </Heading>
        <TempadStorage tva={tva} open={padOpen} onToggle={() => setPadOpen(!padOpen)} />
      </section>

      <section aria-labelledby="st-an" className="flex flex-col gap-4" style={stamp(door, 430)}>
        <Heading id="st-an" tile="bg-red" icon={<path d="M12 5l1.6 4.4L18 11l-4.4 1.6L12 17l-1.6-4.4L6 11l4.4-1.6z" fill="#FFFFFF" />}>
          Animations
        </Heading>
        <div className="flex flex-col rounded-xl bg-surface px-5 py-1">
          <button
            type="button"
            onClick={() => setAnimOpen(!animOpen)}
            aria-expanded={animOpen}
            className="flex min-h-14 items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-[17px] font-bold text-ink"
          >
            {animSummary(anim.prefs)}
            <Chev open={animOpen} />
          </button>
          {animOpen && (
            <div className="flex flex-col pb-3">
              <Switch label="All animations" big on={anim.prefs.all !== false} onChange={v => anim.set('all', v)} />
              {ANIM_GROUPS.map(g => (
                <div key={g.name} className="flex flex-col pt-2.5">
                  <span className="py-1 text-sm font-bold text-muted">{g.name}</span>
                  {g.items.map(([key, label, hint]) => (
                    <Switch key={key} label={label} hint={hint} dim={anim.prefs.all === false} on={anim.prefs[key] !== false} onChange={v => anim.set(key, v)} />
                  ))}
                </div>
              ))}
              <span className="pt-3 text-sm text-muted">These switches decide, even if your phone or PC is set to reduce motion. They're saved on this device.</span>
            </div>
          )}
        </div>
      </section>

      {/* For testing: wipes ticks, extras choices, start date and rewatches on every device. */}
      <section aria-labelledby="st-reset" className="flex flex-col gap-4" style={stamp(door, 470)}>
        <h2 id="st-reset" className="m-0 text-[17px] font-bold text-ink">Reset the timeline</h2>
        <p className="m-0 max-w-[62ch] text-muted">Clears every tick, extras you added, your start date and rewatches, on every device. The title list and TVA settings stay.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <button type="button" onClick={() => setConfirm('reset')} className="h-12 rounded-full border-2 border-red bg-transparent px-6 text-[17px] font-bold text-[#F07B7B]">Reset timeline</button>
          {wasReset && <span role="status" className="text-muted">Timeline reset. Back to 0%.</span>}
        </div>
      </section>

      <section aria-labelledby="st-about" className="flex flex-col gap-2 text-[15px] text-muted" style={stamp(door, 500)}>
        <h2 id="st-about" className="m-0 mb-1 text-[17px] font-bold text-ink">About</h2>
        <span>Sacred Timeline · {titles.length} titles</span>
        <span>Running on jellyfin-server, reached through Tailscale.</span>
      </section>

      {confirm && (
        <div onClick={() => setConfirm(null)} className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(5,6,8,0.8)] p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="st-confirm"
            onClick={e => e.stopPropagation()}
            className="flex w-full max-w-[460px] flex-col gap-4 rounded-2xl bg-surface p-7 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          >
            <h2 id="st-confirm" className="m-0 font-display text-[40px] font-extrabold leading-none">{confirm === 'reset' ? 'Reset the timeline?' : 'Back up now?'}</h2>
            <p className="m-0 text-[17px] leading-normal">
              {confirm === 'reset'
                ? 'Every tick, added extra, start date and rewatch is cleared on all your devices. This can’t be undone.'
                : 'This saves your progress, rewatch history and Jellyfin title list to NicolasKis/sacred-timeline-backups on GitHub.'}
            </p>
            <div className="flex flex-wrap justify-end gap-2.5 pt-1">
              <button type="button" autoFocus onClick={() => setConfirm(null)} className="h-12 rounded-full border-2 border-line bg-transparent px-[22px] text-[17px] font-bold text-ink">Cancel</button>
              {confirm === 'reset' ? (
                <button type="button" onClick={() => { setConfirm(null); onReset(); setWasReset(true) }} className="h-12 rounded-full border-2 border-btn bg-btn px-6 text-[17px] font-bold text-white">Reset</button>
              ) : (
                <button type="button" onClick={() => { setConfirm(null); run('backup') }} className="h-12 rounded-full border-2 border-ink bg-ink px-6 text-[17px] font-bold text-bg">Back up</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const animSummary = (prefs: Partial<AnimPrefs>) => {
  if (prefs.all === false) return 'Animations are off'
  const keys = ANIM_GROUPS.flatMap(g => g.items.map(i => i[0]))
  const on = keys.filter(k => prefs[k] !== false).length
  return on === keys.length ? `All ${keys.length} animations on` : `${on} of ${keys.length} animations on`
}

// How full TemPad is, what takes the space, and the keep time and limit. Folded, it shows just "4.2 GB of 20 GB".
function TempadStorage({ tva, open, onToggle }: { tva: TvaData; open: boolean; onToggle: () => void }) {
  const { msgs } = useTempad()
  const [disk, setDisk] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const { keepDays, limitGB, lastPrune } = tva.tempad
  useEffect(() => {
    if (open) fetch('/api/st/tempad/disk').then(r => r.json()).then(d => setDisk(d.free)).catch(() => {})
  }, [open])

  const sum = (list: { size: number }[]) => list.reduce((s, m) => s + m.size, 0)
  const used = sum(msgs)
  const limit = limitGB * 1e9
  const parts = [
    ['Videos', '#E23636', msgs.filter(m => kindOf(m) === 'video')],
    ['Photos', '#F5A524', msgs.filter(m => kindOf(m) === 'photo')],
    ['Files', '#7A8BFF', msgs.filter(m => kindOf(m) === 'file')],
    ['Text', '#A7A39C', msgs.filter(m => !m.file)],
  ] as const
  const sacred = msgs.filter(m => m.pinned)
  // Messages whose time runs out within three days, soonest first.
  const next = keepDays ? msgs.filter(m => !m.pinned && keepDays - daysOld(m) <= 3).sort((a, b) => a.created.localeCompare(b.created)) : []
  const nextIn = next.length ? Math.max(0, keepDays - daysOld(next[0])) : 0
  const plural = (n: number) => `${n} message${n === 1 ? '' : 's'}`
  const set = (body: object) => runTask('tempad/settings', body).then(e => setNote(e ?? ''))
  const pruneNow = () => runTask('tempad/prune').then(e => setNote(e ?? 'Pruned everything that was due.'))

  return (
    <div className="flex flex-col rounded-xl bg-surface px-5 py-1">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-14 items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-[17px] font-bold text-ink">
        <span className="tabular-nums">{fmtBytes(used)} of {limitGB} GB</span>
        <Chev open={open} />
      </button>
      {open && (
        <div className="flex flex-col gap-5 pb-5">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3 tabular-nums">
              <strong className="font-display text-[44px] font-extrabold leading-[0.9]">{fmtBytes(used)}</strong>
              <span className="text-[15px] text-muted">of {limitGB} GB · {Math.round((used / limit) * 100)}% full</span>
            </div>
            <div className="flex h-3.5 overflow-hidden rounded-lg bg-track">
              {parts.map(([label, color, list]) => <span key={label} style={{ width: `${(sum(list) / limit) * 100}%`, background: color }} />)}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[15px] tabular-nums">
              {parts.map(([label, color, list]) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><i className="inline-block size-2.5 rounded-[3px]" style={{ background: color }} />{label}</span>
                  <span className="text-muted">{fmtBytes(sum(list))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <Row title="Sacred" hint={`${plural(sacred.length)} · never pruned`} value={fmtBytes(sum(sacred))} />
            <Row title="Pruned next" hint={next.length ? `${plural(next.length)} ${nextIn === 0 ? 'tonight' : `in ${nextIn} day${nextIn === 1 ? '' : 's'}`}` : 'Nothing in the next 3 days'} value={next.length ? fmtBytes(sum(next)) : ''} />
            <Row title="Last pruning" hint={lastPrune ? `${fmtDate(lastPrune.at.slice(0, 10))} · pruned ${plural(lastPrune.count)}` : 'Not yet. It runs every night at 3:00'} value={lastPrune ? `${fmtBytes(lastPrune.bytes)} freed` : ''} />
            <Row title="Server disk" hint="Free space left for TemPad" value={disk === null ? '…' : `${fmtBytes(disk)} free`} />
          </div>
          <Seg label="Prune messages that aren't sacred after" options={[[7, '7 days'], [30, '30 days'], [90, '90 days'], [0, 'Forever']]} value={keepDays} onPick={v => set({ keepDays: v })} />
          <Seg label="Storage limit" options={[[5, '5 GB'], [10, '10 GB'], [20, '20 GB'], [50, '50 GB']]} value={limitGB} onPick={v => set({ limitGB: v })} />
          <button type="button" onClick={pruneNow} className="h-[52px] self-start rounded-full border-0 bg-btn px-6 text-[17px] font-bold text-white">Prune now</button>
          {note && <span className="text-sm text-muted">{note}</span>}
        </div>
      )}
    </div>
  )
}

function Row({ title, hint, value }: { title: string; hint: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-track py-2.5 first:border-t-0">
      <div className="min-w-0"><strong className="block font-semibold">{title}</strong><small className="text-[13px] text-muted">{hint}</small></div>
      <span className="shrink-0 text-[15px] text-muted">{value}</span>
    </div>
  )
}

function Seg({ label, options, value, onPick }: { label: string; options: [number, string][]; value: number; onPick: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-bold">{label}</span>
      <div className="grid grid-cols-4 gap-1 rounded-full bg-track p-1">
        {options.map(([v, text]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)} className={`h-10 rounded-full border-0 text-[15px] font-bold ${value === v ? 'bg-ink text-bg' : 'bg-transparent text-muted'}`}>{text}</button>
        ))}
      </div>
    </div>
  )
}

function Heading({ id, tile, icon, children }: { id: string; tile: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" className={`rounded-md ${tile}`}>{icon}</svg>
      <h2 id={id} className="m-0 font-display text-[40px] font-extrabold uppercase leading-none">{children}</h2>
    </div>
  )
}

function Hourglass({ sand }: { sand: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
      {sand && <>
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" className="[animation:st-sand_600ms_linear_infinite]" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" className="[animation:st-sand_600ms_linear_300ms_infinite]" />
      </>}
    </svg>
  )
}

function TaskButton({ busy, sand, disabled, onClick, className, children }: { busy: boolean; sand: boolean; disabled: boolean; onClick: () => void; className: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex h-12 items-center gap-2 rounded-full border-2 px-6 text-[17px] font-bold disabled:opacity-75 ${className}`}>
      {busy && <Hourglass sand={sand} />}
      {children}
    </button>
  )
}

function Chev({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 transition-transform duration-200" style={{ transform: `rotate(${open ? 180 : 0}deg)` }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function Switch({ label, hint, on, onChange, big = false, dim = false }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void; big?: boolean; dim?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex min-h-14 items-center justify-between gap-4 border-0 bg-transparent py-1.5 text-left text-ink ${dim ? 'opacity-60' : ''}`}
    >
      <span className="flex flex-col gap-px">
        <span className={big ? 'text-lg font-extrabold' : 'text-[17px] font-semibold'}>{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
      <span className={`relative inline-block h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${on ? 'bg-btn' : 'bg-line'}`}>
        <span className="absolute top-[3px] size-5 rounded-full bg-ink transition-[left]" style={{ left: on ? 23 : 3 }} />
      </span>
    </button>
  )
}
