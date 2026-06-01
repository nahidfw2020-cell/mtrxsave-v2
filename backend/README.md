# MtrxSave Backend

Production extraction + download API for the MtrxSave frontend.

## Prereqs (host)

- Node 20+
- `yt-dlp` on `$PATH` (or set `YTDLP_PATH`)
- `ffmpeg` on `$PATH` (or set `FFMPEG_PATH`)
- Chromium (Puppeteer downloads its own by default)

## Setup

```bash
cd backend
cp .env.example .env
# edit TOKEN_SECRET (32+ random chars), CORS_ORIGIN
npm install
npm run dev      # node --watch
# or
npm start        # production
```

Health check: `GET http://localhost:4000/api/health`

## API

### POST /api/analyze
Body: `{ "url": "https://..." }`
Returns: token + normalized metadata + format list.

### GET /api/download?token=...&formatId=...
Streams the requested format as an attachment.

Format kinds:
- `video` → MP4 (Original / 1080p / 720p)
- `audio` → MP3 (192 kbps)
- `image` → JPG/PNG single file
- `zip` → carousel bundle

## Deploy

PM2:
```bash
pm2 start backend/deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

systemd: copy `deploy/systemd-mtrxsave.service` → `/etc/systemd/system/`, edit paths, `systemctl enable --now mtrxsave`.

nginx: see `deploy/nginx.conf.example` — note `proxy_buffering off` on `/api/download`.

## Cloudflare

- DNS → grey cloud (DNS only) on the download subdomain to avoid CF buffering large streams.
- Or keep orange cloud with WAF rule disabling buffering on `/api/download`.
