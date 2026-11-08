// TemPad settings and pruning. Loaded with require() from the hooks, because hook handlers can't see each other's code.
const ID = "tvastate0000001"
const DEFAULTS = { keepDays: 30, limitGB: 20, lastPrune: null }

function settings(app) {
  const raw = app.findRecordById("tva", ID).getString("tempad")
  return Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {})
}

function saveSettings(app, patch) {
  const record = app.findRecordById("tva", ID)
  record.set("tempad", Object.assign(settings(app), patch))
  app.save(record)
}

function used(app) {
  const row = new DynamicModel({ total: 0 })
  app.db().newQuery("SELECT COALESCE(SUM(size), 0) AS total FROM tempad").one(row)
  return row.total
}

// Deletes messages that aren't sacred (pinned) once they're older than the keep time.
function prune(app) {
  const s = settings(app)
  let count = 0
  let bytes = 0
  if (s.keepDays > 0) {
    const cutoff = new Date(Date.now() - s.keepDays * 86400000).toISOString().replace("T", " ")
    const old = app.findRecordsByFilter("tempad", "pinned = false && created < {:cutoff}", "", 0, 0, { cutoff: cutoff })
    old.forEach((r) => {
      bytes += r.getInt("size")
      count++
      app.delete(r)
    })
  }
  saveSettings(app, { lastPrune: { at: new Date().toISOString(), count: count, bytes: bytes } })
  return { count: count, bytes: bytes }
}

module.exports = { settings: settings, saveSettings: saveSettings, used: used, prune: prune }
