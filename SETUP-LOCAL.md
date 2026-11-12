# Local setup

Run Sacred Timeline on your own computer to try it or work on it. No server, Jellyfin or Tailscale needed.

## What you need

- [Node.js](https://nodejs.org/) 22 or newer
- [Git](https://git-scm.com/)
- [PocketBase](https://pocketbase.io/docs/) for your system (one file)

## 1. Get the code

```bash
git clone https://github.com/NicolasKis/MiniFlix.git
cd MiniFlix/SacredTimeline
```

Every command below runs inside `SacredTimeline/`.

## 2. Add PocketBase

Unzip PocketBase into `server/bin/`, so you have `server/bin/pocketbase` (or `pocketbase.exe` on Windows). This folder is not committed.

## 3. Build the app

```bash
cd web
npm install
npm run build
cd ..
```

## 4. Start it

```bash
server/bin/pocketbase serve --http=127.0.0.1:8090 --dir=server/pb_data --migrationsDir=server/pb_migrations --publicDir=web/dist
```

Open <http://127.0.0.1:8090>. The first start creates the database in `server/pb_data/` (not committed) and loads the title list.

## Working on the code

Keep PocketBase running, then start the Vite dev server in a second terminal:

```bash
cd web
npm run dev
```

Open the address Vite prints. Changes show up instantly, and Vite forwards `/api` calls to PocketBase on port 8090.

## Optional features

Locally the app works without any keys. These need the keys from [SETUP-SERVER.md](SETUP-SERVER.md) and the server hooks (`--hooksDir=server/pb_hooks`), so they won't work in a plain local setup:

- TMDB checks (posters, new episodes)
- Jellyfin library check
- GitHub backup
- Push notifications
