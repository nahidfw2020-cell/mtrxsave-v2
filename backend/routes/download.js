import { Router } from 'express';
import { z } from 'zod';
import { downloadLimiter } from '../middleware/rateLimit.js';
import { validateQuery } from '../middleware/validate.js';
import { verifyToken } from '../services/tokens.js';
import { getAnalyze } from '../services/analyzeCache.js';
import { streamVideo, streamDirectVideo, streamMp3, streamImage, streamCarouselZip } from '../services/downloader.js';
import { Errors } from '../utils/errors.js';
import { sanitizeFilename } from '../utils/filename.js';

const querySchema = z.object({
  token: z.string().min(8),
  formatId: z.string().min(1).max(64),
  inline: z.union([z.literal('1'), z.literal('true')]).optional(),
});

export const downloadRouter = Router();

downloadRouter.get('/', downloadLimiter, validateQuery(querySchema), (req, res, next) => {
  try {
    const { token, formatId, inline } = req.validatedQuery;
    const payload = verifyToken(token);
    const cached = getAnalyze(token);
    if (!cached) throw Errors.tokenExpired('Analyze result expired, please re-analyze');

    // Virtual format: 'thumbnail' streams cached.thumbnail (used for previews).
    if (formatId === 'thumbnail') {
      if (!cached.thumbnail) throw Errors.notFound('No thumbnail');
      streamImage({ url: cached.thumbnail, filename: 'thumb.jpg', inline: !!inline }, req, res);
      return;
    }

    const format = cached.formats.find((f) => f.id === formatId);
    if (!format) throw Errors.notFound('Unknown format id');

    const baseName = sanitizeFilename(cached.title || `mtrxsave_${cached.platform}`);

    switch (format.kind) {
      case 'video': {
        // Ad-library creatives can't be handed to yt-dlp; analyze scraped the
        // real mp4 URL into cached._directVideoUrl — proxy it straight through.
        if (cached._directVideoUrl) {
          streamDirectVideo({ url: cached._directVideoUrl, filename: `${baseName}.mp4`, platform: cached.platform }, req, res);
          return;
        }
        streamVideo({ url: payload.url, filename: `${baseName}.mp4`, platform: cached.platform }, req, res);
        return;
      }
      case 'audio': {
        streamMp3({ url: payload.url, filename: `${baseName}.mp3`, bitrate: format.bitrate || 192, platform: cached.platform }, req, res);
        return;
      }
      case 'image': {
        const direct = format.directUrl;
        if (!direct) throw Errors.notFound('Image URL missing');
        const ext = format.container || 'jpg';
        streamImage({ url: direct, filename: `${baseName}_${(format.index ?? 0) + 1}.${ext}`, inline: !!inline }, req, res);
        return;
      }
      case 'zip': {
        const images = cached.formats
          .filter((f) => f.kind === 'image')
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .map((f) => ({ url: f.directUrl, ext: f.container || 'jpg' }));
        if (!images.length) throw Errors.notFound('No images to zip');
        streamCarouselZip({ images, filename: `${baseName}.zip` }, req, res);
        return;
      }
      default:
        throw Errors.notFound('Unsupported format kind');
    }
  } catch (e) {
    next(e);
  }
});
