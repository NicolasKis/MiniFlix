/// <reference path="../pb_data/types.d.ts" />
// The title list moves into the TVA record so approved variances can change it.
// It is seeded once from the locked list shipped in the image.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tva")
  collection.fields.add(new JSONField({ name: "catalog", maxSize: 5000000 }))
  collection.fields.add(new JSONField({ name: "variances", maxSize: 1000000 }))
  collection.fields.add(new JSONField({ name: "handled", maxSize: 1000000 }))
  collection.fields.add(new TextField({ name: "varChecked" }))
  app.save(collection)

  const record = app.findRecordById("tva", "tvastate0000001")
  try {
    record.set("catalog", JSON.parse(toString($os.readFile($os.getenv("CATALOG_FILE") || "/pb/titles.json"))))
  } catch (err) {
    // Local development has no /pb/titles.json; the app then uses the list built into it.
    console.log("catalog not seeded:", err)
  }
  record.set("variances", [])
  record.set("handled", [])
  app.save(record)
}, (app) => {
  const collection = app.findCollectionByNameOrId("tva")
  for (const name of ["catalog", "variances", "handled", "varChecked"]) collection.fields.removeByName(name)
  app.save(collection)
})
