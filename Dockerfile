# ---------- Stage 1: build the React/Vite frontend ----------
FROM node:20-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_API_BASE left empty -> frontend calls same-origin /api (combined service).
RUN npm run build

# ---------- Stage 2: backend runtime ----------
FROM node:20-slim AS runtime
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# System deps: Chromium (puppeteer), ffmpeg, plus fonts/CA certs Chromium needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ffmpeg \
      ca-certificates \
      fonts-liberation \
      wget \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp standalone binary (self-contained, no python needed).
RUN wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
      -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/ ./

# Drop the built frontend where server.js serves it from (backend/public).
COPY --from=frontend /app/dist ./public

EXPOSE 4000
CMD ["node", "server.js"]
