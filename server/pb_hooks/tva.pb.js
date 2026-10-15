/// <reference path="../pb_data/types.d.ts" />
// TVA tasks, run only when you press their buttons. Each handler is self-contained: PocketBase runs
// handlers in separate JS contexts, so code outside them is not visible inside.

// Looks through the Jellyfin library and remembers every film and show with its TMDB id and quality.
routerAdd("POST", "/api/st/jellyfin", (e) => {
  const base = $os.getenv("JELLYFIN_URL") || "http://jellyfin:8096"
  const key = $os.getenv("JELLYFIN_KEY")
  if (!key) return e.json(400, { error: "The Jellyfin API key is not set on the server yet." })

  const get = (path) => {
    const res = $http.send({ url: base + path, headers: { "X-Emby-Token": key }, timeout: 60 })
    if (res.statusCode !== 200) throw new Error("Jellyfin answered " + res.statusCode)
    return res.json
  }
  // Width, not height: wide films are 1920×800 and are still 1080p.
  const quality = (w) => (!w ? null : w >= 3200 ? "4K" : w >= 2200 ? "1440p" : w >= 1600 ? "1080p" : w >= 1100 ? "720p" : "480p")
  const videoWidth = (streams) => {
    const v = (streams || []).filter((s) => s.Type === "Video")[0]
    return v ? v.Width : 0
  }

  try {
    const found = get("/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds,MediaStreams&EnableImages=false")
    const items = (found.Items || []).map((it) => {
      let width = videoWidth(it.MediaStreams)
      if (it.Type === "Series") {
        // shortcut: a show's quality is its first episode's, until mixed-quality shows matter
        const eps = get("/Shows/" + it.Id + "/Episodes?Limit=1&Fields=MediaStreams")
        width = eps.Items && eps.Items[0] ? videoWidth(eps.Items[0].MediaStreams) : 0
      }
      return {
        name: it.Name,
        year: it.ProductionYear || null,
        type: it.Type === "Series" ? "tv" : "movie",
        tmdb: (it.ProviderIds && it.ProviderIds.Tmdb) || null,
        quality: quality(width),
      }
    })
    const record = e.app.findRecordById("tva", "tvastate0000001")
    record.set("jellyfin", { checkedAt: new Date().toISOString(), items: items })
    e.app.save(record)
    return e.json(200, { count: items.length })
  } catch (err) {
    return e.json(502, { error: "Couldn't read the Jellyfin library: " + err })
  }
})

// Variance report: on demand, and by itself on the 1st and 15th of each month (every two weeks).
routerAdd("POST", "/api/st/variance", (e) => {
  try {
    return e.json(200, { found: require(`${__hooks}/variance.js`).check(e.app) })
  } catch (err) {
    return e.json(502, { error: "Couldn't check TMDB: " + err })
  }
})

routerAdd("POST", "/api/st/variance/resolve", (e) => {
  const body = e.requestInfo().body
  if (!body || typeof body.key !== "string") return e.json(400, { error: "Missing variance key." })
  const ok = require(`${__hooks}/variance.js`).resolve(e.app, body.key, body.approve === true)
  return ok ? e.json(200, { ok: true }) : e.json(404, { error: "That change was already handled." })
})

cronAdd("variance-check", "0 5 1,15 * *", () => {
  try {
    require(`${__hooks}/variance.js`).check($app)
  } catch (err) {
    console.log("variance check failed:", err)
  }
})

// Saves progress, rewatch history and the Jellyfin title list to the private backup repo on GitHub.
routerAdd("POST", "/api/st/backup", (e) => {
  const token = $os.getenv("GITHUB_TOKEN")
  const repo = $os.getenv("BACKUP_REPO") || "NicolasKis/sacred-timeline-backups"
  if (!token) return e.json(400, { error: "The GitHub token is not set on the server yet." })

  // GitHub wants the file as base64 of its UTF-8 bytes (titles can have accents).
  const base64 = (text) => {
    const bytes = []
    for (let i = 0; i < text.length; i++) {
      let c = text.charCodeAt(i)
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) c = 0x10000 + ((c - 0xd800) << 10) + (text.charCodeAt(++i) - 0xdc00)
      if (c < 0x80) bytes.push(c)
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63))
      else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
      else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    }
    const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    let out = ""
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0)
      out += abc[(n >> 18) & 63] + abc[(n >> 12) & 63] + (i + 1 < bytes.length ? abc[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? abc[n & 63] : "=")
    }
    return out
  }
  // Self-check of the encoder against a known value.
  if (base64("Tóny ×") !== "VMOzbnkgw5c=") return e.json(500, { error: "Backup encoder self-check failed." })

  try {
    const progress = JSON.parse(e.app.findRecordById("progress", "progressstate01").getString("data") || "{}")
    const tva = e.app.findRecordById("tva", "tvastate0000001")
    const jellyfin = JSON.parse(tva.getString("jellyfin") || "null")
    const savedAt = new Date().toISOString()
    const catalog = JSON.parse(tva.getString("catalog") || "null")
    const file = JSON.stringify({ savedAt: savedAt, progress: progress, jellyfinLibrary: jellyfin, timeline: catalog }, null, 2)

    const url = "https://api.github.com/repos/" + repo + "/contents/backup.json"
    const headers = { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "User-Agent": "sacred-timeline" }
    const current = $http.send({ url: url, headers: headers, timeout: 30 })
    const body = { message: "Backup " + savedAt, content: base64(file) }
    if (current.statusCode === 200) body.sha = current.json.sha
    const res = $http.send({ url: url, method: "PUT", headers: headers, body: JSON.stringify(body), timeout: 30 })
    if (res.statusCode !== 200 && res.statusCode !== 201) {
      return e.json(502, { error: "GitHub answered " + res.statusCode + "." })
    }
    tva.set("lastBackup", savedAt)
    e.app.save(tva)
    return e.json(200, { savedAt: savedAt })
  } catch (err) {
    return e.json(502, { error: "Backup failed: " + err })
  }
})
