import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { request } from 'undici';
import { ytdlpStream } from './ytdlp.js';
import { ffmpegToMp3 } from './ffmpeg.js';
import { streamZip } from './zipper.js';
import { mimeFor, extFromUrl } from '../utils/mime.js';
import { attachmentHeader, sanitizeFilename } from '../utils/filename.js';
import { Errors } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Best-quality selector with H264 + AAC priority but a guaranteed fallback
 * to "best single file" so platforms that don't expose the preferred codec
 * still resolve a downloadable format.
 *
 * Order:
 *  1. H264 video + AAC audio        (perfect QuickLook + browsers)
 *  2. H264 video + any audio
 *  3. progressive H264+AAC single file
 *  4. progressive mp4 single file
 *  5. best video+audio of any codec
 *  6. b  (universal — never errors with "Requested format is not available")
 */
function buildSelector() {
  return [
    'bv*[vcodec^=avc1]+ba[acodec^=mp4a]',
    'bv*[vcodec^=avc1]+ba',
    'b[vcodec^=avc1][acodec^=mp4a]',
    'b[ext=mp4]',
    'bv*+ba',
    'b',
  ].join('/');
}


function ytdlpBaseArgs() {
  const a = ['--no-warnings', '--no-progress', '--no-check-certificate'];
  if (config.cookieJarPath) a.push('--cookies', config.cookieJarPath);
  return a;
}


/**
 * Resolve the real output path. yt-dlp may write the file with a different
 * extension than the template suggests (e.g. .webm before remux). After
 * --remux-video mp4 the result is always .mp4 but the basename might differ
 * if yt-dlp post-processes. Try expected first, then scan the dir.
 */
async function resolveOutputFile(expected) {
  try {
    const st = await fsp.stat(expected);
    if (st.size > 0) return expected;
  } catch {}
  const dir = path.dirname(expected);
  const base = path.basename(expected, path.extname(expected));
  try {
    const entries = await fsp.readdir(dir);
    const match = entries.find((n) => n.startsWith(base));
    if (match) return path.join(dir, match);
  } catch {}
  return null;
}

/**
 * Video pipeline: yt-dlp → temp mp4 → stream to client → cleanup.
 *
 * Why temp file (not stdout): yt-dlp cannot merge multi-stream selections
 * (DASH video + audio) into a single pipe. Instagram, Facebook, YouTube
 * routinely return DASH split; piping yields a half-stream silent or video-less
 * "MPEG-4 movie" that QuickLook can't open. Writing to disk lets the muxer
 * merge properly.
 *
 * H264+AAC selector + --remux-video mp4 + faststart guarantees mp4/H264/AAC.
 */
export async function streamVideo({ url, filename, platform }, req, res) {
  const selector = buildSelector();
  const safe = sanitizeFilename(filename || `mtrxsave_${Date.now()}.mp4`);
  const finalName = safe.endsWith('.mp4') ? safe : `${safe}.mp4`;

  await fsp.mkdir(config.tempDir, { recursive: true });
  const stageId = `${Date.now()}-${randomUUID()}`;
  const stagePath = path.join(config.tempDir, `${stageId}.mp4`);

  const extra = [
    '--remux-video', 'mp4',
    '--postprocessor-args', 'ffmpeg:-movflags +faststart',
  ];

  logger.info({
    reqId: req.id, platform, selector, stagePath,
  }, 'starting video stream (temp-file pipeline)');

  // Manual spawn so we can kill on client abort.
  const args = [...ytdlpBaseArgs(), '-f', selector, '-o', stagePath, ...extra, url];
  const child = spawn(config.ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => {
    stderr += d.toString();
    if (stderr.length > 32768) stderr = stderr.slice(-32768);
  });

  const abort = () => {
    try { child.kill('SIGKILL'); } catch {}
  };
  req.on('close', abort);
  res.on('close', abort);

  child.on('close', async (code) => {
    const lines = stderr.split('\n');
    const downloadingLine = lines.find((l) => l.includes('format(s):'));
    const mergerLine = lines.find((l) => l.startsWith('[Merger]') || l.includes('Merging formats'));
    const remuxLine = lines.find((l) => l.startsWith('[VideoRemuxer]') || l.includes('Remuxing'));
    const ffmpegLine = lines.find((l) => l.toLowerCase().includes('ffmpeg'));

    if (code !== 0) {
      logger.warn({
        reqId: req.id, platform, code, stderr: stderr.slice(-800),
      }, 'yt-dlp exit non-zero — abort send');
      await fsp.rm(stagePath, { force: true }).catch(() => {});
      if (!res.headersSent) {
        res.status(502).json({ error: { code: 'EXTRACTION_FAILED', message: 'Download failed' } });
      } else {
        res.end();
      }
      return;
    }

    const file = await resolveOutputFile(stagePath);
    if (!file) {
      logger.warn({ reqId: req.id, platform, stagePath }, 'output file missing after yt-dlp exit 0');
      await fsp.rm(stagePath, { force: true }).catch(() => {});
      if (!res.headersSent) {
        res.status(502).json({ error: { code: 'EXTRACTION_FAILED', message: 'Output missing' } });
      }
      return;
    }

    let size = 0;
    try { size = (await fsp.stat(file)).size; } catch {}

    logger.info({
      reqId: req.id,
      platform,
      selectedFormat: downloadingLine?.trim() || null,
      merger: mergerLine?.trim() || null,
      remux: remuxLine?.trim() || null,
      ffmpeg: ffmpegLine?.trim() || null,
      outputFile: file,
      bytes: size,
    }, 'yt-dlp finished — streaming to client');

    res.setHeader('Content-Type', mimeFor('mp4'));
    res.setHeader('Content-Disposition', attachmentHeader(finalName));
    res.setHeader('Cache-Control', 'no-store');
    if (size) res.setHeader('Content-Length', size);
    res.setHeader('Accept-Ranges', 'none');

    const rs = fs.createReadStream(file);
    rs.on('error', (e) => {
      logger.warn({ reqId: req.id, err: e.message }, 'temp read failed');
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    const cleanup = () => {
      fsp.rm(file, { force: true }).catch(() => {});
      if (file !== stagePath) fsp.rm(stagePath, { force: true }).catch(() => {});
    };
    rs.on('close', cleanup);
    res.on('close', () => {
      try { rs.destroy(); } catch {}
    });
    rs.pipe(res);
  });

  child.on('error', (e) => {
    logger.error({ reqId: req.id, err: e.message }, 'yt-dlp spawn failed');
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'INTERNAL', message: 'Downloader spawn failed' } });
    }
  });
}

/**
 * MP3 extraction: yt-dlp bestaudio → ffmpeg → mp3.
 */
export function streamMp3({ url, filename, bitrate = 192, platform }, req, res) {
  const safe = sanitizeFilename(filename || `mtrxsave_${Date.now()}.mp3`);
  res.setHeader('Content-Type', mimeFor('mp3'));
  res.setHeader('Content-Disposition', attachmentHeader(safe.endsWith('.mp3') ? safe : `${safe}.mp3`));
  res.setHeader('Cache-Control', 'no-store');

  logger.info({ reqId: req.id, platform, bitrate }, 'starting mp3 stream');

  const ytdlp = ytdlpStream(url, 'ba/b', []);
  const ff = ffmpegToMp3(bitrate);

  const abort = () => {
    try { ytdlp.kill('SIGKILL'); } catch {}
    try { ff.kill('SIGKILL'); } catch {}
  };
  req.on('close', abort);
  res.on('close', abort);

  ytdlp.stdout.pipe(ff.stdin).on('error', () => {});
  ff.stdout.pipe(res);

  ff.on('close', (code) => {
    if (code !== 0 && !res.headersSent) {
      const err = ff._getStderr ? ff._getStderr() : '';
      logger.warn({ reqId: req.id, code, err: err.slice(0, 300) }, 'ffmpeg mp3 non-zero');
      res.status(502).json({ error: { code: 'EXTRACTION_FAILED', message: 'Audio extraction failed' } });
    } else if (code !== 0) {
      res.end();
    }
  });
  ytdlp.on('close', (code) => {
    if (code !== 0) {
      try { ff.stdin.end(); } catch {}
    }
  });
}

/**
 * Single image: proxy stream from CDN.
 * inline=true → omit attachment Content-Disposition so browsers render the
 * image instead of triggering a download (used for thumbnail previews).
 */
export async function streamImage({ url, filename, inline = false }, req, res) {
  try {
    const { body, statusCode, headers } = await request(url, {
      method: 'GET',
      headers: {
        // CDNs (IG / FB / TikTok) frequently 403 on missing referer/UA. Fake a browser.
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (statusCode >= 400) {
      throw Errors.contentUnavailable(`Image fetch failed: ${statusCode}`);
    }
    const ext = extFromUrl(url) || 'jpg';
    const safe = sanitizeFilename(filename || `mtrxsave_${Date.now()}.${ext}`);
    res.setHeader('Content-Type', headers['content-type'] || mimeFor(ext));
    if (headers['content-length']) res.setHeader('Content-Length', headers['content-length']);
    if (!inline) {
      res.setHeader('Content-Disposition', attachmentHeader(safe.includes('.') ? safe : `${safe}.${ext}`));
    }
    res.setHeader('Cache-Control', inline ? 'public, max-age=600' : 'no-store');
    const abort = () => { try { body.destroy(); } catch {} };
    req.on('close', abort);
    res.on('close', abort);
    body.pipe(res);
  } catch (e) {
    if (!res.headersSent) {
      res.status(e.status || 502).json({
        error: { code: e.code || 'EXTRACTION_FAILED', message: e.message || 'Image stream failed' },
      });
    }
  }
}

/**
 * Carousel ZIP: bundle all CDN images into one zip stream.
 */
export function streamCarouselZip({ images, filename }, req, res) {
  const safe = sanitizeFilename(filename || `mtrxsave_${Date.now()}`);
  res.setHeader('Content-Type', mimeFor('zip'));
  res.setHeader('Content-Disposition', attachmentHeader(safe.endsWith('.zip') ? safe : `${safe}.zip`));
  res.setHeader('Cache-Control', 'no-store');
  const archive = streamZip(images, safe);
  const onAbort = () => {
    try { archive.abort(); } catch {}
  };
  req.on('close', onAbort);
  res.on('close', onAbort);
  archive.pipe(res);
}
