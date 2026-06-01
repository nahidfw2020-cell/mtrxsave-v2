import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { requestId } from './middleware/requestId.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { analyzeRouter } from './routes/analyze.js';
import { downloadRouter } from './routes/download.js';
import { startCleanupCron } from './services/cleanup.js';
import { shutdownPuppeteer } from './services/puppeteer.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: false,
  // Allow the SPA to load external images (Cloudinary logo/cards, CDN thumbnails)
  // and Google Fonts. Without this, helmet's default CSP blocks them.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'https:'],
    },
  },
}));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!config.corsOrigins.length) return cb(null, true);
    if (config.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'));
  },
  methods: ['GET', 'POST'],
  credentials: false,
}));
app.use(express.json({ limit: '4kb' }));
app.use(requestId);

app.use('/api/health', healthRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/download', downloadRouter);

// Serve the built frontend (combined single-service deploy).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, 'public');
app.use(express.static(publicDir));
// SPA fallback: any non-API GET returns index.html.
app.get(/^(?!\/api\/).*/, (_req, res, next) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

startCleanupCron();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'MtrxSave backend ready');
});

function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await shutdownPuppeteer();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => logger.error({ err: err.stack || err.message }, 'uncaughtException'));
