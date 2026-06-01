import archiver from 'archiver';
import { request } from 'undici';
import { extFromUrl } from '../utils/mime.js';
import { logger } from '../utils/logger.js';

/**
 * Streams a ZIP of remote URLs straight to the response.
 * Returns the archiver instance so caller can pipe to res and listen for events.
 */
export function streamZip(images, baseName = 'images') {
  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.on('warning', (e) => logger.warn({ err: e.message }, 'archiver warning'));
  archive.on('error', (e) => logger.error({ err: e.message }, 'archiver error'));

  (async () => {
    let idx = 1;
    for (const item of images) {
      const url = typeof item === 'string' ? item : item.url;
      if (!url) continue;
      const ext = (typeof item === 'object' && item.ext) || extFromUrl(url) || 'jpg';
      const name = `${baseName}_${String(idx).padStart(2, '0')}.${ext}`;
      try {
        const { body, statusCode } = await request(url, { method: 'GET' });
        if (statusCode >= 400) {
          logger.warn({ url, statusCode }, 'zip entry fetch failed');
          continue;
        }
        archive.append(body, { name });
      } catch (e) {
        logger.warn({ url, err: e.message }, 'zip entry skipped');
      }
      idx++;
    }
    archive.finalize().catch((e) => logger.error({ err: e.message }, 'archive finalize failed'));
  })();

  return archive;
}
