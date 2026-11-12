# MiniFlix

**I built my own Netflix… ish.** MiniFlix turns an old office mini PC into a home server: it streams my own films and shows, works from anywhere, and runs apps I build myself.

A school project that started as a hobby project. By Nicolas Kiš.

## What runs on it

| Part | What it does |
|---|---|
| **Jellyfin** | My own Netflix: streams my films and shows to the PC and phone |
| **Tailscale** | A private network just for my devices, so it works from anywhere with no ports open on the router |
| **Sacred Timeline** | My own app for tracking every Marvel film and show in story order (the code in this repo) |

## Hardware

- HP ProDesk mini PC (Intel Core i3, 8 GB RAM)
- 2 TB SSD for the media library
- Ubuntu Server 26.04, no monitor, everything controlled over SSH
- Every app runs in its own Docker container

## Sacred Timeline

A web app that installs on the iPhone like a normal app.

- Tick films and episodes as you watch; it shows your progress, the time left and your expected finish date
- **Up next** card with a *Tonight I have 1 / 2 / 3 / 4 h* planner
- Jump bar for the four sagas, spoiler-free mode, hide watched titles
- **History** with search, rewatches and stats (streaks, hours per month)
- **TVA** screen: checks TMDB every two weeks for new episodes and release-date changes, checks the Jellyfin library, backs up progress to GitHub
- Notifications for new releases, new episodes and titles leaving a streaming service
- **TemPad**: send yourself notes, links and files between devices (with a storage limit, old items are pruned)
- Works offline and syncs when the connection comes back

### Tech stack

| Front end | Back end | Tools |
|---|---|---|
| React 19, TypeScript, Tailwind CSS 4, Vite | PocketBase (database, API, file storage), TMDB API, Web Push | Docker, Git + GitHub |

### Project structure

```
web/                React app (src/, public/)
server/
  pb_migrations/    database schema
  pb_hooks/         server logic: TMDB checks, Jellyfin check, backups, push notifications, TemPad
  push/send.js      sends the notifications
data/titles.json    the Marvel titles in story order
Dockerfile          builds the app and PocketBase into one image
docker-compose.yml  runs it on the server
```

### Run it locally

Step-by-step guides: [SETUP-LOCAL.md](SETUP-LOCAL.md) for your own computer, [SETUP-SERVER.md](SETUP-SERVER.md) for a full home server (Ubuntu, Docker, Jellyfin, Tailscale). Quick version:

1. Download [PocketBase](https://pocketbase.io/docs/) into `server/bin/`.
2. Build the web app:
   ```bash
   cd web
   npm install
   npm run build
   ```
3. Start PocketBase, which serves the built app on <http://127.0.0.1:8090>:
   ```bash
   server/bin/pocketbase serve --http=127.0.0.1:8090 --dir=server/pb_data --migrationsDir=server/pb_migrations --publicDir=web/dist
   ```

For live reloading while coding, keep PocketBase running and run `npm run dev` in `web/` (Vite forwards `/api` to port 8090).

### Run it on a server

```bash
docker compose up -d --build
```

The container only listens on `127.0.0.1:8090`; put it behind Tailscale (or another proxy) to reach it from your devices. Optional features read their keys from `server/.env`, which is never committed:

| Variable | Used for |
|---|---|
| `TMDB_TOKEN` | Posters, post-credits tags and the TVA's new-episode checks |
| `JELLYFIN_URL`, `JELLYFIN_KEY` | The Jellyfin library check |
| `GITHUB_TOKEN`, `BACKUP_REPO` | "Back up now" to a private GitHub repo |
| `VAPID_PUBLIC`, `VAPID_PRIVATE` | Push notifications |
