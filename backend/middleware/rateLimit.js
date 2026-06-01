import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

export const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimitAnalyze,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many analyze requests' } },
});

export const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimitDownload,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many download requests' } },
});
