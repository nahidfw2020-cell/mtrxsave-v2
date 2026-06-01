import 'dotenv/config';
import path from 'node:path';
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
