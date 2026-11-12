# Home server setup

Turn an old PC into a MiniFlix server: Jellyfin for your films and shows, Tailscale to reach it from anywhere, and Sacred Timeline on top. Replace everything in `<angle brackets>` with your own values.

## What you need

- An old PC or mini PC with an SSD (any recent Intel or AMD CPU and 8 GB RAM is plenty)
- A disk for the media library
- A USB stick for the installer
- A free [Tailscale](https://tailscale.com/) account

## 1. Install Ubuntu Server

1. Write the [Ubuntu Server](https://ubuntu.com/download/server) image to the USB stick (for example with balenaEtcher) and install it.
2. In the installer, enable **OpenSSH server** and create your user.
3. After the reboot, find the server's address on your home network (`ip a` on the server, or your router's device list).

From now on everything runs over SSH from your own computer:

```bash
ssh <user>@<server-address>
```

Tip: set up an SSH key (`ssh-keygen`, then `ssh-copy-id <user>@<server-address>`) so you don't type the password every time.

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in so the group change applies.

## 3. Jellyfin

Mount your media disk (for example at `/mnt/storage`), then create a folder **named `jellyfin`** (Sacred Timeline joins the `jellyfin_default` network that this folder name creates):

```bash
mkdir -p ~/jellyfin && cd ~/jellyfin
```

Create `docker-compose.yml`:

```yaml
services:
  jellyfin:
    image: jellyfin/jellyfin
    container_name: jellyfin
    ports:
      - "8096:8096"
    volumes:
      - ./config:/config
      - ./cache:/cache
      - /mnt/storage:/media
    restart: unless-stopped
```

```bash
docker compose up -d
```

Open `http://<server-address>:8096`, create the admin account and add your libraries from `/media`. Jellyfin wants one folder per library (for example `/media/movies` and `/media/shows`), and folder names are case-sensitive.

## 4. Tailscale

Install it on the server and on every device that should reach it:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Your devices can now reach the server from anywhere through its Tailscale name, without opening any ports on your router. Keep router port forwarding off.

## 5. Sacred Timeline

```bash
cd ~
git clone https://github.com/NicolasKis/MiniFlix.git
cd MiniFlix/SacredTimeline
```

Create `server/.env` for the optional features (all are optional, leave out what you don't use):

```bash
TMDB_TOKEN=<TMDB API read access token>
JELLYFIN_URL=http://jellyfin:8096
JELLYFIN_KEY=<Jellyfin API key>
GITHUB_TOKEN=<GitHub fine-grained token with contents read/write on your backup repo>
BACKUP_REPO=<your-github-user>/<private-backup-repo>
VAPID_PUBLIC=<public key>
VAPID_PRIVATE=<private key>
VAPID_SUBJECT=https://<your server's Tailscale name>
```

Where to get them:

- **TMDB**: themoviedb.org → Settings → API
- **Jellyfin**: Dashboard → API Keys → add one
- **GitHub**: Settings → Developer settings → Fine-grained tokens, limited to a private backup repo
- **VAPID keys**: `npx web-push generate-vapid-keys`

Keep `server/.env` on the server only; it is in `.gitignore` and must never be committed.

Start it:

```bash
docker compose up -d --build
```

The app only listens on the server itself (`127.0.0.1:8090`). Publish it to your Tailscale devices with HTTPS:

```bash
sudo tailscale serve --bg 8090
```

Open `https://<server's Tailscale name>` on your phone. On iPhone: Safari → Share → **Add to Home Screen**, then allow notifications from the app.

## Updating

```bash
cd ~/MiniFlix/SacredTimeline
git pull
docker compose up -d --build
```

Your progress lives in `server/pb_data/` and survives updates. Copy that folder somewhere safe now and then, or use the app's GitHub backup.

## Safety checklist

- Router port forwarding off; reach everything through Tailscale
- Strong password for the server user and the Jellyfin admin
- `server/.env` never committed or shared
- `sudo apt update && sudo apt upgrade` regularly
