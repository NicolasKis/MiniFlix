// The Variance report: compares the timeline with TMDB and lists what changed, for you to approve.
// Loaded with require() from the hooks, because hook handlers can't see each other's code.
const ID = "tvastate0000001"
const PROVIDERS = { "Disney Plus": "Disney+", "Netflix": "Netflix", "HBO Max": "HBO Max", "Max": "HBO Max" }

const read = (record, field, fallback) => {
  const raw = record.getString(field)
  return raw ? JSON.parse(raw) : fallback
}

function tmdb(path) {
  const token = $os.getenv("TMDB_TOKEN")
  if (!token) throw new Error("The TMDB token is not set on the server yet.")
  const res = $http.send({ url: "https://api.themoviedb.org/3" + path, headers: { Authorization: "Bearer " + token }, timeout: 30 })
  if (res.statusCode !== 200) throw new Error("TMDB answered " + res.statusCode + " for " + path)
  return res.json
}

const fmt = (iso) => {
  if (!iso) return "no date"
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const p = iso.split("-")
  return parseInt(p[2], 10) + " " + m[parseInt(p[1], 10) - 1] + " " + p[0]
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

function check(app) {
  const record = app.findRecordById("tva", ID)
  const catalog = read(record, "catalog", null)
  if (!catalog) throw new Error("The timeline list isn't on the server yet.")
  const handled = read(record, "handled", [])
  const pending = read(record, "variances", [])
  const known = {}
  handled.concat(pending.map((v) => v.key)).forEach((k) => (known[k] = true))
  const today = new Date().toISOString().slice(0, 10)
  const lastYear = String(new Date().getFullYear() - 1)
  const found = []
  const add = (v) => { if (!known[v.key]) { known[v.key] = true; found.push(v) } }

  // Titles you hid don't get reported.
  const hidden = JSON.parse(app.findRecordById("progress", "progressstate01").getString("data") || "{}").hidden || {}
  catalog.titles.forEach((t) => {
    if (!t.tmdb || hidden[t.id]) return
    const released = t.release && t.release <= today

    // New episodes: only shows from the last year or so, older ones don't change.
    if (t.kind === "series" && t.seasons && t.seasons.length && (t.release || "") >= lastYear) {
      t.seasons.forEach((s) => {
        const eps = (tmdb("/" + t.tmdb + "/season/" + s.season).episodes || [])
        if (eps.length <= s.episodes.length) return
        const extra = eps.length - s.episodes.length
        add({
          key: "episodes:" + t.id + ":" + s.season + ":" + eps.length, kind: "episodes", title: t.title,
          detail: extra + (extra === 1 ? " new episode" : " new episodes") + " in season " + s.season + ".",
          patch: { titleId: t.id, season: s.season, episodes: eps.map((e) => (e.air_date && e.air_date <= today ? (e.runtime || 45) : { min: e.runtime || 45, airs: e.air_date || null })) },
        })
      })
    }

    // Release dates of what isn't out yet.
    if (!released && t.tmdb.indexOf("movie/") === 0) {
      const date = tmdb("/" + t.tmdb).release_date || null
      // TMDB's date is often the first release anywhere, a day or two before ours; only real moves count.
      if (date && t.release && Math.abs(new Date(date) - new Date(t.release)) > 7 * 86400000) {
        add({
          key: "date:" + t.id + ":" + date, kind: "date", title: t.title,
          detail: "Release date moved from " + fmt(t.release) + " to " + fmt(date) + ".",
          patch: { titleId: t.id, fields: { release: date } },
        })
      }
    }

    // Where it streams in Slovakia (subscription services you care about).
    if (released) {
      const sk = (tmdb("/" + t.tmdb + "/watch/providers").results || {}).SK
      if (!sk) return // no Slovak data yet (common right after release), not a removal
      const where = []
      ;(sk.flatrate || []).forEach((p) => { const n = PROVIDERS[p.provider_name]; if (n && where.indexOf(n) === -1) where.push(n) })
      where.sort()
      const now = (t.where || []).slice().sort()
      if (where.join(",") !== now.join(",")) {
        add({
          key: "streaming:" + t.id + ":" + where.join(","), kind: "streaming", title: t.title,
          detail: where.length ? "Now streaming on " + where.join(", ") + " in Slovakia." : "No longer on your streaming services in Slovakia.",
          patch: { titleId: t.id, fields: { where: where } },
        })
      }
    }
  })

  // Newly announced Marvel Studios films and shows that aren't on the timeline yet.
  const ids = {}
  catalog.titles.forEach((t) => { if (t.tmdb) ids[t.tmdb] = true })
  const year = new Date().getFullYear()
  const fresh = []
  ;(tmdb("/discover/movie?with_companies=420&primary_release_date.gte=" + year + "-01-01&without_genres=99&sort_by=primary_release_date.asc").results || [])
    .forEach((m) => fresh.push({ tmdb: "movie/" + m.id, title: m.title, release: m.release_date || null, kind: "movie", poster: m.poster_path, overview: m.overview }))
  ;(tmdb("/discover/tv?with_companies=420&first_air_date.gte=" + year + "-01-01&without_genres=99,10762,10763,10764,10767&sort_by=first_air_date.asc").results || [])
    .forEach((s) => fresh.push({ tmdb: "tv/" + s.id, title: s.name, release: s.first_air_date || null, kind: "series", poster: s.poster_path, overview: s.overview }))
  fresh.forEach((n) => {
    if (ids[n.tmdb] || /podcast/i.test(n.title)) return
    // shortcut: credits scenes are read once, when a title is added; TMDB usually tags them after release
    if (n.kind === "movie" && !known["title:" + n.tmdb]) {
      const kw = (tmdb("/" + n.tmdb + "/keywords").keywords || []).map((k) => k.id)
      if (kw.indexOf(179430) !== -1 || kw.indexOf(179431) !== -1) n.credits = { mid: kw.indexOf(179430) !== -1, end: kw.indexOf(179431) !== -1 }
    }
    add({
      key: "title:" + n.tmdb, kind: "title", title: n.title,
      detail: "Newly announced" + (n.release ? ", out " + fmt(n.release) : "") + ". It would be added at the end of the timeline.",
      patch: { add: {
        id: slug(n.title) + "-" + n.tmdb.split("/")[1], title: n.title, kind: n.kind, category: "main", setIn: "TBA",
        release: n.release, where: [], runtime: null, seasons: n.kind === "series" ? [] : undefined,
        poster: n.poster || null, tmdb: n.tmdb, overview: n.overview || undefined, credits: n.credits,
      } },
    })
  })

  record.set("variances", pending.concat(found))
  record.set("varChecked", new Date().toISOString())
  app.save(record)
  return found.length
}

// Approving applies the change to the timeline list; either way it won't be reported again.
function resolve(app, key, approve) {
  const record = app.findRecordById("tva", ID)
  const pending = read(record, "variances", [])
  const v = pending.filter((x) => x.key === key)[0]
  if (!v) return false
  if (approve) {
    const catalog = read(record, "catalog", null)
    if (v.patch.add) catalog.titles.push(v.patch.add)
    else {
      const t = catalog.titles.filter((x) => x.id === v.patch.titleId)[0]
      if (t && v.patch.season) t.seasons.forEach((s) => { if (s.season === v.patch.season) s.episodes = v.patch.episodes })
      if (t && v.patch.fields) Object.keys(v.patch.fields).forEach((k) => (t[k] = v.patch.fields[k]))
    }
    record.set("catalog", catalog)
  }
  record.set("variances", pending.filter((x) => x.key !== key))
  record.set("handled", read(record, "handled", []).concat([key]))
  app.save(record)
  return true
}

module.exports = { check: check, resolve: resolve }
