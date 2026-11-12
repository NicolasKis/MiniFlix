/// <reference path="../pb_data/types.d.ts" />
// TemPad: the size limit on new messages, nightly pruning, and the TVA screen's storage buttons.

onRecordCreateRequest((e) => {
  const tempad = require(`${__hooks}/tempad.js`)
  const file = e.record.getUnsavedFiles("file")[0]
  const size = file ? file.size : e.record.getString("text").length
  if (!file && !e.record.getString("text").trim()) throw new BadRequestError("Write something or add a file.")
  const limit = tempad.settings(e.app).limitGB * 1e9
  if (tempad.used(e.app) + size > limit) throw new BadRequestError("TemPad is full. Prune something or unpin a sacred message, or raise the limit on the TVA screen.")
  e.record.set("size", size)
  e.record.set("pinned", false)
  e.next()
}, "tempad")

cronAdd("tempad-prune", "0 3 * * *", () => {
  try {
    require(`${__hooks}/tempad.js`).prune($app)
  } catch (err) {
    console.log("tempad prune failed:", err)
  }
})

routerAdd("POST", "/api/st/tempad/prune", (e) => e.json(200, require(`${__hooks}/tempad.js`).prune(e.app)))

routerAdd("POST", "/api/st/tempad/settings", (e) => {
  const body = e.requestInfo().body || {}
  const patch = {}
  if ([7, 30, 90, 0].indexOf(body.keepDays) >= 0) patch.keepDays = body.keepDays
  if ([5, 10, 20, 50].indexOf(body.limitGB) >= 0) patch.limitGB = body.limitGB
  if (!Object.keys(patch).length) return e.json(400, { error: "Unknown setting." })
  require(`${__hooks}/tempad.js`).saveSettings(e.app, patch)
  return e.json(200, { ok: true })
})

// Free space on the disk that holds TemPad's files.
routerAdd("GET", "/api/st/tempad/disk", (e) => {
  try {
    const out = toString($os.cmd("df", "-k", "/pb_data").output()).trim().split("\n").pop().split(/\s+/)
    return e.json(200, { free: Number(out[3]) * 1024 })
  } catch (err) {
    return e.json(200, { free: null })
  }
})
