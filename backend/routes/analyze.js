import { Router } from 'express';
import { z } from 'zod';
import { analyzeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { validateUrl } from '../utils/urlValidator.js';
import { detectPlatform } from '../utils/platformDetect.js';
import { getExtractor } from '../extractors/index.js';
import { signToken } from '../services/tokens.js';
import { putAnalyze } from '../services/analyzeCache.js';
import { logger } from '../utils/logger.js';

const bodySchema = z.object({ url: z.string().min(4).max(2048) });

export const analyzeRouter = Router();

analyzeRouter.post('/', analyzeLimiter, validateBody(bodySchema), async (req, res, next) => {
  try {
    const cleanUrl = validateUrl(req.body.url);
    const platform = detectPlatform(cleanUrl);
    const extractor = getExtractor(platform);

    const t0 = Date.now();
    const result = await extractor.analyze(cleanUrl);
    logger.info({ reqId: req.id, platform, ms: Date.now() - t0 }, 'analyze ok');

    const token = signToken({ url: cleanUrl, platform });
    putAnalyze(token, result);

    // Strip internal fields before responding.
    const { _directVideoUrl, ...publicResult } = result;
    res.json({ token, ...publicResult });
  } catch (e) {
    next(e);
  }
});
