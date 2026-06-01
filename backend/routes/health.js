import { Router } from 'express';
import { ytdlpVersion } from '../services/ytdlp.js';
import { ffmpegVersion } from '../services/ffmpeg.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const [ytdlp, ffmpeg] = await Promise.all([ytdlpVersion(), ffmpegVersion()]);
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    ytdlp: ytdlp || 'unavailable',
    ffmpeg: ffmpeg || 'unavailable',
  });
});
