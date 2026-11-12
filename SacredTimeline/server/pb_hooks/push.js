// Push notifications: sends to every device that switched the given kind on (or to one device for a test).
// Loaded with require() from the hooks, like variance.js.
function send(app, subs, title, body) {
  if (!subs.length) return 0
  if (!$os.getenv("VAPID_PRIVATE")) throw new Error("The notification keys are not set on the server yet.")
  const out = $os.cmd("node", "/pb/push/send.js", JSON.stringify({
    subs: subs.map((r) => JSON.parse(r.getString("sub"))),
    payload: { title: title, body: body },
  })).output()
  const results = JSON.parse(toString(out))
  let sent = 0
  results.forEach((res) => {
    // 404 and 410 mean the device dropped the subscription; forget it.
    if (res.status === 404 || res.status === 410) {
      try { app.delete(app.findFirstRecordByData("pushsubs", "endpoint", res.endpoint)) } catch (_) {}
    } else if (res.status >= 200 && res.status < 300) sent++
  })
  return sent
}

function notify(app, kind, title, body) {
  const subs = app.findAllRecords("pushsubs").filter((r) => {
    const kinds = JSON.parse(r.getString("kinds") || "{}")
    return kinds[kind] === true
  })
  return send(app, subs, title, body)
}

// Daily: titles that come out today, and on the 1st a backup reminder if the last one is over a month old.
function daily(app) {
  const today = new Date().toISOString().slice(0, 10)
  const tva = app.findRecordById("tva", "tvastate0000001")
  const catalog = JSON.parse(tva.getString("catalog") || "null")
  const progress = JSON.parse(app.findRecordById("progress", "progressstate01").getString("data") || "{}")
  const hidden = progress.hidden || {}
  if (catalog) {
    const titles = catalog.titles.filter((t) => !hidden[t.id])
    titles
      .filter((t) => t.release === today)
      .forEach((t) => notify(app, "releases", t.title + " is out today", "It's on your Sacred Timeline" + (t.where && t.where.length ? ", on " + t.where.join(", ") : "") + "."))

    // Countdown: a week before a release, with how much is left to catch up on.
    const inWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const soon = titles.filter((t) => t.release === inWeek)
    if (soon.length) {
      const left = minutesLeft(titles, progress, today)
      const h = Math.floor(left / 60), m = left % 60
      soon.forEach((t) => notify(app, "countdown", t.title + " in 7 days",
        left ? "You have " + (h ? h + " h " : "") + (m ? m + " min " : "") + "left before you're caught up." : "You're all caught up. Ready when it lands."))
    }

    // New episode: only for shows you're partway through.
    const watched = progress.watched || {}
    titles.filter((t) => t.kind === "series").forEach((t) => {
      const started = Object.keys(watched).some((k) => k.indexOf(t.id + ":") === 0)
      if (!started) return
      ;(t.seasons || []).forEach((s) => s.episodes.forEach((e, i) => {
        if (typeof e === "object" && e.airs === today) notify(app, "episodes", "New episode of " + t.title, "Season " + s.season + ", episode " + (i + 1) + " is out today.")
      }))
    })
  }
  if (today.slice(8) === "01") {
    const last = tva.getString("lastBackup")
    if (!last || new Date() - new Date(last) > 30 * 86400000) {
      notify(app, "backup", "Time for a backup", "Your last Sacred Timeline backup is over a month old. Open TVA and press Back up now.")
    }
  }
}

// Minutes still to watch on everything that counts: released main titles plus extras you added, as in the app.
function minutesLeft(titles, progress, today) {
  const watched = progress.watched || {}
  const included = progress.included || {}
  let left = 0
  titles.forEach((t) => {
    if (!t.release || t.release > today || (t.category !== "main" && !included[t.id])) return
    if (t.kind !== "series") { if (!watched[t.id]) left += t.runtime || 0; return }
    ;(t.seasons || []).forEach((s) => s.episodes.forEach((e, i) => {
      const min = typeof e === "number" ? e : e.min
      const aired = typeof e === "number" || !e.airs || e.airs <= today
      if (aired && !watched[t.id + ":" + s.season + ":" + (i + 1)]) left += min
    }))
  })
  return left
}

// After a variance check: tell devices about titles that left one of your streaming services.
function leaving(app, before) {
  const tva = app.findRecordById("tva", "tvastate0000001")
  const catalog = JSON.parse(tva.getString("catalog") || "null")
  const known = {}
  before.forEach((k) => (known[k] = true))
  JSON.parse(tva.getString("variances") || "[]")
    .filter((v) => v.kind === "streaming" && !known[v.key])
    .forEach((v) => {
      const t = catalog && catalog.titles.filter((x) => x.id === v.patch.titleId)[0]
      const gone = ((t && t.where) || []).filter((w) => v.patch.fields.where.indexOf(w) === -1)
      if (gone.length) notify(app, "leaving", v.title + " left " + gone.join(" and "), "It's no longer on " + gone.join(" or ") + " in Slovakia. Open TVA to update your timeline.")
    })
}

module.exports = { send: send, notify: notify, daily: daily, leaving: leaving }
