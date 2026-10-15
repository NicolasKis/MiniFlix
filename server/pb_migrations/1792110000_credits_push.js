/// <reference path="../pb_data/types.d.ts" />
// Batch 5: post-credits scenes join the server's title list, and each device's push subscription gets a home.
migrate((app) => {
  // Copy "credits" from the list shipped in the image onto the matching titles of the server's copy.
  const record = app.findRecordById("tva", "tvastate0000001")
  try {
    const shipped = JSON.parse(toString($os.readFile($os.getenv("CATALOG_FILE") || "/pb/titles.json"))).titles
    const catalog = JSON.parse(record.getString("catalog") || "null")
    if (catalog) {
      const byId = {}
      shipped.forEach((t) => { if (t.credits) byId[t.id] = t.credits })
      catalog.titles.forEach((t) => { if (byId[t.id]) t.credits = byId[t.id] })
      record.set("catalog", catalog)
      app.save(record)
    }
  } catch (err) {
    console.log("credits not merged:", err)
  }

  // Subscriptions are private: no API rules, so only the server's own hooks can read or write them.
  const subs = new Collection({
    type: "base",
    name: "pushsubs",
    fields: [
      { name: "endpoint", type: "text", required: true, max: 2000 },
      { name: "sub", type: "json", maxSize: 10000 },
      { name: "kinds", type: "json", maxSize: 1000 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_pushsubs_endpoint ON pushsubs (endpoint)"],
  })
  app.save(subs)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("pushsubs"))
})
