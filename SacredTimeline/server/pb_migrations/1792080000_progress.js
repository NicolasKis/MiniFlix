/// <reference path="../pb_data/types.d.ts" />
// One record holds the whole watch-through, so every device reads and writes the same thing.
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "progress",
    // shortcut: open to anyone who can reach the server (Tailscale only); add auth before exposing it publicly
    listRule: "",
    viewRule: "",
    updateRule: "",
    createRule: null,
    deleteRule: null,
    fields: [{ name: "data", type: "json", maxSize: 2000000 }],
  })
  app.save(collection)

  const record = new Record(collection)
  record.set("id", "progressstate01")
  record.set("data", { watched: {}, included: {}, minimised: {}, started: null, log: [] })
  app.save(record)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("progress"))
})
