/// <reference path="../pb_data/types.d.ts" />
// What the TVA screen shows: the last Jellyfin library check and the last backup. Only server hooks write it.
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "tva",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "jellyfin", type: "json", maxSize: 2000000 },
      { name: "lastBackup", type: "text" },
    ],
  })
  app.save(collection)

  const record = new Record(collection)
  record.set("id", "tvastate0000001")
  app.save(record)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("tva"))
})
