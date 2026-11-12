import { useEffect, useRef, useState, type ReactNode } from 'react'
import { pb } from './store'

// TemPad: notes and files you send yourself between devices. Messages are pruned after the keep time unless sacred (pinned).
export type Msg = { id: string; collectionId: string; collectionName: string; text: string; file: string; device: 'phone' | 'pc'; size: number; pinned: boolean; created: string }
type Kind = 'text' | 'link' | 'photo' | 'video' | 'file'

const tempad = pb.collection('tempad')
const DEVICE: Msg['device'] = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent)) ? 'phone' : 'pc'

export const kindOf = (m: Msg): Kind => {
  if (!m.file) return /^https?:\/\/\S+$/.test(m.text.trim()) ? 'link' : 'text'
  // PocketBase only makes thumbnails for these, so other images show as files.
  if (/\.(jpe?g|png|gif|webp)$/i.test(m.file)) return 'photo'
  if (/\.(mp4|mov|m4v|webm)$/i.test(m.file)) return 'video'
  return 'file'
}

// PocketBase adds a random suffix to stored file names; show the name as it was sent.
export const fileName = (m: Msg) => m.file.replace(/_[a-z0-9]{10}(\.[^.]+)?$/i, '$1')
const url = (m: Msg, opts?: { thumb?: string; download?: boolean }) => pb.files.getURL(m, m.file, opts)

export const fmtBytes = (n: number) => {
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++ }
  return `${i === 0 || n >= 100 ? n.toFixed(0) : n.toFixed(1)} ${u[i]}`
}

export const daysOld = (m: Msg) => Math.floor((Date.now() - new Date(m.created.replace(' ', 'T')).getTime()) / 86400000)

// The text under each message saying when it gets pruned; `soon` turns it red.
export function lifeLabel(m: Msg, keepDays: number): { text: string; soon: boolean } {
  if (!keepDays) return { text: 'Kept forever', soon: false }
  const left = keepDays - daysOld(m)
  // The server prunes at 3:00, so the last day reads "tonight". Red from 3 days, like "Pruned next" on the TVA screen.
  return { text: left <= 0 ? 'Pruned tonight' : `Pruned in ${left} day${left === 1 ? '' : 's'}`, soon: left <= 3 }
}

// All messages, live: something sent from the PC appears on the phone straight away.
export function useTempad() {
  const [msgs, setMsgs] = useState<Msg[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    tempad.getFullList<Msg>({ sort: 'created' }).then(setMsgs).catch(() => setError("Can't reach TemPad. Check that Tailscale is on."))
    tempad.subscribe<Msg>('*', e => setMsgs(list => {
      const rest = (list ?? []).filter(m => m.id !== e.record.id)
      return e.action === 'delete' ? rest : [...rest, e.record].sort((a, b) => a.created.localeCompare(b.created))
    })).then(u => { unsubscribe = u }).catch(() => {})
    return () => unsubscribe?.()
  }, [])
  return { msgs: msgs ?? [], loaded: msgs !== null, error }
}

export const setSacred = (m: Msg, pinned: boolean) => tempad.update(m.id, { pinned })
export const prune = (m: Msg) => tempad.delete(m.id)

// Sends one message with upload progress (the PocketBase client has no progress events, so this uses XHR).
function send(form: FormData, onProgress: (sent: number) => void) {
  return new Promise<void>((ok, fail) => {
    const x = new XMLHttpRequest()
    x.open('POST', '/api/collections/tempad/records')
    x.upload.onprogress = e => onProgress(e.loaded)
    x.onload = () => (x.status < 300 ? ok() : fail(new Error(JSON.parse(x.responseText || '{}').message || `Sending failed (${x.status}).`)))
    x.onerror = () => fail(new Error('Sending stopped. Check your connection and try again.'))
    x.send(form)
  })
}

const FILTERS = [['all', 'All'], ['sacred', 'Sacred'], ['media', 'Photos & videos'], ['files', 'Files'], ['text', 'Text & links']] as const
type Filter = (typeof FILTERS)[number][0]
const shows = (f: Filter, m: Msg) => {
  const k = kindOf(m)
  return f === 'all' || (f === 'sacred' && m.pinned) || (f === 'media' && (k === 'photo' || k === 'video')) || (f === 'files' && k === 'file') || (f === 'text' && (k === 'text' || k === 'link'))
}

const dayLabel = (created: string) => {
  const d = new Date(created.replace(' ', 'T'))
  const diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'short' })
}

export default function TemPad({ keepDays, limitGB }: { keepDays: number; limitGB: number }) {
  const { msgs, loaded, error } = useTempad()
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const [attach, setAttach] = useState(false)
  const [upload, setUpload] = useState<{ name: string; pct: number } | null>(null)
  const [problem, setProblem] = useState('')
  const [sheet, setSheet] = useState<Msg | null>(null)
  const [view, setView] = useState<Msg | null>(null)
  const [toast, setToast] = useState('')
  const media = useRef<HTMLInputElement>(null)
  const anyFile = useRef<HTMLInputElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  const used = msgs.reduce((s, m) => s + m.size, 0)
  const limit = limitGB * 1e9
  const full = used >= limit
  const shown = msgs.filter(m => shows(filter, m))
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(''), 1600) }

  // Start at the newest message, like a chat.
  useEffect(() => { if (loaded) window.scrollTo(0, document.body.scrollHeight) }, [loaded])
  useEffect(() => { if (upload === null) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) }, [msgs.length, upload])

  const sendText = async () => {
    const t = text.trim()
    if (!t) return
    setProblem('')
    const form = new FormData()
    form.append('text', t)
    form.append('device', DEVICE)
    try {
      await send(form, () => {})
      setText('')
      if (area.current) area.current.style.height = ''
    } catch (e) { setProblem((e as Error).message) }
  }

  const sendFiles = async (files: FileList | null) => {
    setAttach(false)
    if (!files?.length) return
    setProblem('')
    for (const f of Array.from(files)) {
      const form = new FormData()
      form.append('file', f)
      form.append('device', DEVICE)
      setUpload({ name: f.name, pct: 0 })
      try { await send(form, n => setUpload({ name: f.name, pct: Math.min(100, (n / (f.size || 1)) * 100) })) }
      catch (e) { setProblem(`${f.name}: ${(e as Error).message}`); break }
    }
    setUpload(null)
  }

  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(t) } catch { /* older Safari: nothing to fall back to without a visible field */ }
    say('Copied')
  }

  return (
    <div className="flex flex-col gap-4 pb-44">
      <div className="flex items-end justify-between gap-4">
        <h2 className="m-0 font-display text-[clamp(44px,10vw,64px)] font-extrabold uppercase leading-[0.85]">TemPad</h2>
        <div className="flex min-w-0 flex-col items-end gap-1.5 text-sm tabular-nums text-muted">
          <span><b className="text-ink">{fmtBytes(used)}</b> of {limitGB} GB</span>
          <div className="h-1.5 w-[150px] max-w-full overflow-hidden rounded-full bg-track"><div className="h-full bg-red" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div>
        </div>
      </div>

      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
        {FILTERS.map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border-0 px-3.5 text-[15px] font-bold ${filter === f ? 'bg-ink text-bg' : 'bg-surface text-muted'}`}
          >
            {f === 'sacred' && <Pin className="size-3.5 text-gold" />}
            {label}
            {f === 'sacred' && <span className="text-[13px] opacity-70">{msgs.filter(m => m.pinned).length}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 pt-2">
        {error && <p className="m-0 py-10 text-center text-muted">{error}</p>}
        {loaded && !shown.length && <p className="m-0 py-10 text-center text-muted">{filter === 'all' ? 'Nothing here yet. Send yourself something below.' : 'Nothing here yet.'}</p>}
        {shown.map((m, i) => {
          const k = kindOf(m)
          const mine = m.device === DEVICE
          const life = lifeLabel(m, keepDays)
          const day = dayLabel(m.created)
          return (
            <div key={m.id} className="contents">
              {(i === 0 || dayLabel(shown[i - 1].created) !== day) && (
                <span className="self-center pb-0.5 pt-2 text-[13px] font-bold uppercase tracking-[0.1em] text-muted">{day}</span>
              )}
              <div className={`flex max-w-[min(78%,460px)] flex-col gap-1 ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
                {k === 'photo' || k === 'video' ? (
                  <button type="button" onClick={() => setView(m)} aria-label={k === 'photo' ? 'Open photo' : 'Play video'} className={`relative block overflow-hidden rounded-2xl border-0 bg-track p-0 ${m.pinned ? 'ring-[1.5px] ring-gold/60' : ''}`}>
                    {k === 'photo'
                      ? <img src={url(m, { thumb: '480x0' })} alt="" loading="lazy" className="block w-[min(280px,62vw)]" />
                      : <video src={`${url(m)}#t=0.1`} preload="metadata" muted playsInline className="block aspect-[4/3] w-[min(280px,62vw)] object-cover" />}
                    {k === 'video' && <span className="absolute inset-0 grid place-items-center"><span className="grid size-[52px] place-items-center rounded-full bg-bg/70"><svg width="22" height="22" viewBox="0 0 24 24" fill="#F2EFEA" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg></span></span>}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSheet(m)}
                    className={`border-0 px-3.5 py-2.5 text-left text-[17px] text-ink [overflow-wrap:anywhere] ${mine ? 'rounded-[18px_18px_6px_18px] bg-track' : 'rounded-[18px_18px_18px_6px] bg-surface'} ${m.pinned ? 'ring-[1.5px] ring-gold/60' : ''}`}
                  >
                    {k === 'file' ? (
                      <span className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3">
                        <span className="grid size-11 place-items-center rounded-xl bg-gold/15 font-display text-sm font-extrabold uppercase text-gold">{m.file.split('.').pop()?.slice(0, 4)}</span>
                        <span className="min-w-0"><strong className="block truncate font-semibold">{fileName(m)}</strong><small className="text-[13px] text-muted">{fmtBytes(m.size)}</small></span>
                      </span>
                    ) : k === 'link' ? <span className="font-semibold text-gold">{m.text.replace(/^https?:\/\//, '')}</span> : <span className="whitespace-pre-wrap">{m.text}</span>}
                  </button>
                )}
                <div className="flex flex-wrap items-center gap-1.5 px-1.5 text-[12.5px] text-muted">
                  <DeviceIcon device={m.device} />
                  <span aria-hidden="true">·</span>
                  {m.pinned
                    ? <span className="inline-flex items-center gap-1 font-bold text-gold"><Pin className="size-3" />Sacred</span>
                    : <span className={life.soon ? 'font-bold text-[#FF7A7A]' : ''}>{life.text}</span>}
                  <button type="button" onClick={() => setSheet(m)} aria-label="More" className="border-0 bg-transparent px-1 font-extrabold text-muted">···</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-track bg-bg px-5 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2">
          {full && <p className="m-0 rounded-2xl bg-red/15 px-3.5 py-2.5 text-[15px] font-semibold text-[#FF9A9A]">TemPad is full ({limitGB} GB). Prune something or unpin a sacred message, or raise the limit on the TVA screen.</p>}
          {problem && <p className="m-0 rounded-2xl bg-red/15 px-3.5 py-2.5 text-[15px] font-semibold text-[#FF9A9A]">{problem}</p>}
          {upload && (
            <div className="flex flex-col gap-1.5 rounded-2xl bg-surface px-3.5 py-2.5 text-sm">
              <div className="flex justify-between gap-3"><span className="truncate">Sending {upload.name}</span><span className="tabular-nums">{Math.round(upload.pct)}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-track"><div className="h-full bg-gold" style={{ width: `${upload.pct}%` }} /></div>
            </div>
          )}
          {attach && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => media.current?.click()} className="h-10 rounded-full border-0 bg-surface px-3.5 text-[15px] font-bold text-ink">Photo or video</button>
              <button type="button" onClick={() => anyFile.current?.click()} className="h-10 rounded-full border-0 bg-surface px-3.5 text-[15px] font-bold text-ink">File</button>
            </div>
          )}
          <input ref={media} type="file" accept="image/*,video/*" multiple hidden onChange={e => { sendFiles(e.target.files); e.target.value = '' }} />
          <input ref={anyFile} type="file" multiple hidden onChange={e => { sendFiles(e.target.files); e.target.value = '' }} />
          <div className="flex items-end gap-2">
            <button type="button" disabled={full || !!upload} onClick={() => setAttach(!attach)} aria-expanded={attach} aria-label="Add a photo, video or file" className="grid size-12 shrink-0 place-items-center rounded-full border-0 bg-surface text-ink disabled:opacity-35">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <textarea
              ref={area}
              rows={1}
              value={text}
              onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px` }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && DEVICE === 'pc') { e.preventDefault(); sendText() } }}
              placeholder="Send to your devices…"
              aria-label="Message"
              className="min-h-12 min-w-0 flex-1 resize-none rounded-3xl border-0 bg-surface px-[18px] py-3 text-[17px] leading-snug text-ink outline-none placeholder:text-muted"
            />
            <button type="button" onClick={sendText} disabled={!text.trim() || full} aria-label="Send" className="grid size-12 shrink-0 place-items-center rounded-full border-0 bg-btn text-white disabled:opacity-35">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-30 grid items-end justify-items-center bg-[rgba(8,8,10,.6)] px-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }} onClick={e => e.target === e.currentTarget && setSheet(null)}>
          <div role="dialog" aria-label="Message actions" className="flex w-full max-w-[460px] flex-col gap-1 rounded-[22px] bg-surface p-2.5 [animation:st-up_220ms_cubic-bezier(.2,.8,.2,1)_both]">
            <div className="px-3 pb-2 pt-2.5 text-sm text-muted">
              <b className="block truncate text-base text-ink">{sheet.file ? fileName(sheet) : sheet.text}</b>
              {sheet.pinned ? 'Sacred, kept forever' : lifeLabel(sheet, keepDays).text}
            </div>
            <SheetBtn className="text-gold" onClick={() => { setSacred(sheet, !sheet.pinned).then(() => say(sheet.pinned ? 'No longer sacred' : 'Sacred. Kept until you unpin it')); setSheet(null) }}>
              <Pin className="size-5" />{sheet.pinned ? 'Unpin' : 'Make sacred, keep forever'}
            </SheetBtn>
            {sheet.file
              ? <SheetBtn onClick={() => { window.location.href = url(sheet, { download: true }); setSheet(null) }}>Save to this device</SheetBtn>
              : <SheetBtn onClick={() => { copy(sheet.text); setSheet(null) }}>Copy text</SheetBtn>}
            {kindOf(sheet) === 'link' && <SheetBtn onClick={() => { window.open(sheet.text.trim(), '_blank', 'noopener'); setSheet(null) }}>Open link</SheetBtn>}
            <SheetBtn className="text-[#FF7A7A]" onClick={() => { prune(sheet).then(() => say('Pruned')); setSheet(null) }}>Prune now</SheetBtn>
            <SheetBtn className="mt-1 justify-center bg-track" onClick={() => setSheet(null)}>Cancel</SheetBtn>
          </div>
        </div>
      )}

      {view && (
        <div className="fixed inset-0 z-30 grid grid-rows-[auto_1fr_auto] gap-3 bg-[rgba(6,6,8,.97)] px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <div className="flex items-center justify-between gap-3 text-sm text-muted">
            <span className="truncate">{fileName(view)} · {fmtBytes(view.size)}</span>
            <button type="button" onClick={() => setView(null)} aria-label="Close" className="grid size-12 shrink-0 place-items-center rounded-full border-0 bg-surface text-ink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div className="grid min-h-0 place-items-center">
            {kindOf(view) === 'photo'
              ? <img src={url(view)} alt={fileName(view)} className="max-h-full max-w-full rounded-lg object-contain" />
              : <video src={url(view)} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg" />}
          </div>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => { setSacred(view, !view.pinned); setView(null) }} className="flex h-12 items-center gap-2 rounded-full border-0 bg-track px-5 font-bold text-gold"><Pin className="size-5" />{view.pinned ? 'Unpin' : 'Make sacred'}</button>
            <a href={url(view, { download: true })} className="flex h-12 items-center rounded-full bg-btn px-5 font-bold text-white no-underline">Save</a>
          </div>
        </div>
      )}

      {toast && <div className="fixed left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-[18px] py-2.5 font-bold text-bg" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 150px)' }}>{toast}</div>}
    </div>
  )
}

function SheetBtn({ className = '', onClick, children }: { className?: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex h-[52px] items-center gap-3 rounded-[14px] border-0 bg-transparent px-3.5 text-left text-[17px] font-bold text-ink hover:bg-track ${className}`}>{children}</button>
}

function Pin({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><path d="M15 3l6 6-3 1-4 4 .5 4.5L13 20l-4-4-5 5-1-1 5-5-4-4 1.5-1.5L10 10l4-4z" /></svg>
}

function DeviceIcon({ device }: { device: Msg['device'] }) {
  const label = device === 'phone' ? 'From phone' : 'From PC'
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label} className="shrink-0 text-branch">
      <title>{label}</title>
      {device === 'phone' ? <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" /></> : <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /></>}
    </svg>
  )
}
