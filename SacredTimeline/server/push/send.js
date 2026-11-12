// Sends one notification to a list of push subscriptions. Called by the PocketBase hooks, because
// web push needs encryption and signing the hooks' JavaScript engine doesn't have.
// Input (argv[2]): {"subs":[{endpoint, keys}], "payload":{title, body}}. Output: [{endpoint, status}].
const webpush = require('web-push')

const { VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT } = process.env
webpush.setVapidDetails(VAPID_SUBJECT || 'https://jellyfin-server.tail1c1aa5.ts.net', VAPID_PUBLIC, VAPID_PRIVATE)

const { subs, payload } = JSON.parse(process.argv[2])
Promise.all(
  subs.map(sub =>
    webpush
      .sendNotification(sub, JSON.stringify(payload), { TTL: 86400 })
      .then(r => ({ endpoint: sub.endpoint, status: r.statusCode }))
      .catch(err => ({ endpoint: sub.endpoint, status: err.statusCode || 0 })),
  ),
).then(results => process.stdout.write(JSON.stringify(results)))
