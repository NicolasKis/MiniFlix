/// <reference path="../pb_data/types.d.ts" />
// Batch 6: TemPad, notes and files you send yourself between devices. Settings live on the TVA record.
migrate((app) => {
  const tempad = new Collection({
    type: "base",
    name: "tempad",
    // Open rules like the rest of the app: only your Tailscale devices can reach the server.
    listRule: "",
    viewRule: "",
    createRule: "",
    // Only the sacred (pinned) switch can change after sending.
    updateRule: "@request.body.text:isset = false && @request.body.file:isset = false && @request.body.device:isset = false && @request.body.size:isset = false",
    deleteRule: "",
    fields: [
      { name: "text", type: "text", max: 20000 },
      { name: "file", type: "file", maxSelect: 1, maxSize: 8000000000, thumbs: ["480x0"] },
      { name: "device", type: "select", values: ["phone", "pc"], maxSelect: 1 },
      { name: "size", type: "number" },
      { name: "pinned", type: "bool" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE INDEX idx_tempad_created ON tempad (created)"],
  })
  app.save(tempad)

  const tva = app.findCollectionByNameOrId("tva")
  tva.fields.add(new JSONField({ name: "tempad", maxSize: 10000 }))
  app.save(tva)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("tempad"))
  const tva = app.findCollectionByNameOrId("tva")
  tva.fields.removeByName("tempad")
  app.save(tva)
})
