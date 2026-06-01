import { ytdlpJson } from '../services/ytdlp.js';
import { withPage } from '../services/puppeteer.js';
import { videoFormats, firstThumb, imageFormats } from './_base.js';
import { Errors } from '../utils/errors.js';

export async function analyze(url) {
  try {
    const info = await ytdlpJson(url);
    const hasVideo = Array.isArray(info.formats) && info.formats.some((f) => f.vcodec && f.vcodec !== 'none');
    if (hasVideo || info.duration) {
      return {
        platform: 'pinterest',
        contentType: 'video',
        title: info.title || 'Pinterest Video',
        creator: { username: info.uploader || info.uploader_id || '', displayName: info.uploader || '' },
        thumbnail: firstThumb(info),
        duration: info.duration || null,
        sourceUrl: url,
        previewUrl: info.url || null,
        formats: videoFormats(info),
      };
    }
    // Image pin
    const directUrl = info.url || firstThumb(info);
    if (!directUrl) throw Errors.contentUnavailable('No media found');
    const images = [{ url: directUrl, ext: 'jpg' }];
    return {
      platform: 'pinterest',
      contentType: 'image',
      title: info.title || 'Pinterest Pin',
      creator: { username: info.uploader || '', displayName: info.uploader || '' },
      thumbnail: directUrl,
      imageCount: 1,
      sourceUrl: url,
      formats: imageFormats(images),
    };
  } catch (e) {
    if (e.code === 'CONTENT_UNAVAILABLE') {
      return analyzeImagePin(url);
    }
    // Try Puppeteer fallback for og:image pins.
    return analyzeImagePin(url);
  }
}

async function analyzeImagePin(url) {
  const meta = await withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    return page.evaluate(() => {
      const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content || '';
      return {
        ogImage: og('og:image'),
        ogTitle: og('og:title'),
      };
    });
  });
  if (!meta.ogImage) throw Errors.contentUnavailable('No pin image found');
  const images = [{ url: meta.ogImage, ext: 'jpg' }];
  return {
    platform: 'pinterest',
    contentType: 'image',
    title: meta.ogTitle || 'Pinterest Pin',
    creator: { username: '', displayName: '' },
    thumbnail: meta.ogImage,
    imageCount: 1,
    sourceUrl: url,
    formats: imageFormats(images),
  };
}
