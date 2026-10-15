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
    catalog.titles
      .filter((t) => t.release === today && !hidden[t.id])
      .forEach((t) => notify(app, "releases", t.title + " is out today", "It's on your Sacred Timeline" + (t.where && t.where.length ? ", on " + t.where.join(", ") : "") + "."))
  }
  if (today.slice(8) === "01") {
    const last = tva.getString("lastBackup")
    if (!last || new Date() - new Date(last) > 30 * 86400000) {
      notify(app, "backup", "Time for a backup", "Your last Sacred Timeline backup is over a month old. Open TVA and press Back up now.")
    }
  }
}

module.exports = { send: send, notify: notify, daily: daily }
