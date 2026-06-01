import 'dotenv/config';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function list(v) {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL || 'info',

  corsOrigins: list(process.env.CORS_ORIGIN),

  tokenSecret: process.env.TOKEN_SECRET || '',
  tokenTtl: num(process.env.TOKEN_TTL_SECONDS, 600),

  ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  cookieJarPath: process.env.COOKIE_JAR_PATH || '',

  // Extra yt-dlp --extractor-args. Default switches YouTube to player clients
  // that often bypass the datacenter "Sign in to confirm you're not a bot"
  // check. Override/disable via YTDLP_EXTRACTOR_ARGS (empty string = none).
  ytdlpExtractorArgs:
    process.env.YTDLP_EXTRACTOR_ARGS !== undefined
      ? process.env.YTDLP_EXTRACTOR_ARGS
      : 'youtube:player_client=android',

  // Cookies for yt-dlp (--cookies). Provide EITHER:
  //   YOUTUBE_COOKIES      raw cookies.txt (Netscape, tab-separated) content
  //   YOUTUBE_COOKIES_B64  the same file base64-encoded (survives env mangling)
  // Written to a temp file at startup. Robust YouTube fix + unlocks HD.
  youtubeCookies: process.env.YOUTUBE_COOKIES || '',
  youtubeCookiesB64: process.env.YOUTUBE_COOKIES_B64 || '',

  maxConcurrentYtdlp: num(process.env.MAX_CONCURRENT_YTDLP, 20),
  maxConcurrentPuppeteer: num(process.env.MAX_CONCURRENT_PUPPETEER, 3),
  perIpConcurrentDownloads: num(process.env.PER_IP_CONCURRENT_DOWNLOADS, 2),

  tempDir: path.resolve(root, process.env.TEMP_DIR || './temp'),
  tempMaxAgeMinutes: num(process.env.TEMP_MAX_AGE_MINUTES, 30),

  rateLimitAnalyze: num(process.env.RATE_LIMIT_ANALYZE, 10),
  rateLimitDownload: num(process.env.RATE_LIMIT_DOWNLOAD, 30),
};

if (!config.tokenSecret || config.tokenSecret.length < 32) {
  if (config.env === 'production') {
    throw new Error('TOKEN_SECRET must be set and >=32 chars in production');
  }
  // dev fallback (insecure)
  config.tokenSecret = 'dev-only-insecure-secret-do-not-use-in-prod-xxxxxxxx';
}

// If cookies were supplied via env (and no explicit jar path), materialise them
// to a temp file so yt-dlp can use --cookies. Survives a single container life,
// which is all yt-dlp needs.
if (!config.cookieJarPath) {
  let cookieText = config.youtubeCookies;
  if (!cookieText && config.youtubeCookiesB64) {
    try {
      cookieText = Buffer.from(config.youtubeCookiesB64, 'base64').toString('utf8');
    } catch {
      /* ignore bad base64 */
    }
  }
  if (cookieText) {
    try {
      const p = path.join(os.tmpdir(), 'yt-cookies.txt');
      fs.writeFileSync(p, cookieText, { mode: 0o600 });
      config.cookieJarPath = p;
    } catch {
      // non-fatal: fall back to no cookies
    }
  }
}

// With valid cookies the default web client works and yields full HD, so drop
// the android (≈360p) workaround unless the operator pinned it explicitly.
if (config.cookieJarPath && process.env.YTDLP_EXTRACTOR_ARGS === undefined) {
  config.ytdlpExtractorArgs = '';
}
