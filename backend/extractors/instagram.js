import { ytdlpJson } from '../services/ytdlp.js';
import { withPage } from '../services/puppeteer.js';
import { videoFormats, firstThumb, imageFormats } from './_base.js';
import { Errors } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

function looksLikeImage(entry) {
  if (entry?.duration) return false;
  if (Array.isArray(entry?.formats) && entry.formats.some((f) => f.vcodec && f.vcodec !== 'none')) return false;
  return true;
}

export async function analyze(url) {
  // First try yt-dlp (handles reels + many post types).
  try {
    const info = await ytdlpJson(url, ['--yes-playlist']);
    if (Array.isArray(info.entries) && info.entries.length > 1) {
      const allImages = info.entries.every(looksLikeImage);
      if (allImages) {
        const images = info.entries.map((e) => ({
          url: e.url || e.thumbnail,
          ext: 'jpg',
          width: e.width,
          height: e.height,
        })).filter((i) => i.url);
        if (images.length) return buildCarousel(url, images);
      }
      const primary = info.entries.find((e) => !looksLikeImage(e)) || info.entries[0];
      return analyzeEntry(primary, url);
    }
    const entry = info.entries?.[0] || info;
    return analyzeEntry(entry, url);
  } catch (e) {
    logger.info({ url, err: e.message?.slice(0, 200) }, 'instagram yt-dlp failed, falling back to scrape');
    // yt-dlp errors on image-only posts ("There is no video in this post"). Fall through to Puppeteer.
  }

  // Puppeteer fallback for image/carousel posts.
  return analyzeViaScrape(url);
}

function analyzeEntry(entry, url) {
  if (looksLikeImage(entry)) {
    const directUrl = entry.url || entry.thumbnail;
    if (!directUrl) throw Errors.contentUnavailable('No media found');
    const images = [{ url: directUrl, ext: 'jpg', width: entry.width, height: entry.height }];
    return {
      platform: 'instagram',
      contentType: 'image',
      title: entry.title || 'Instagram Post',
      creator: { username: entry.uploader || entry.uploader_id || '', displayName: entry.uploader || '' },
      thumbnail: directUrl,
      imageCount: 1,
      sourceUrl: url,
      formats: imageFormats(images),
    };
  }
  return {
    platform: 'instagram',
    contentType: 'video',
    title: entry.title || entry.description || 'Instagram Video',
    creator: { username: entry.uploader || entry.uploader_id || '', displayName: entry.uploader || '' },
    thumbnail: firstThumb(entry),
    duration: entry.duration || null,
    sourceUrl: url,
    previewUrl: entry.url || null,
    formats: videoFormats(entry),
  };
}

function buildCarousel(url, images) {
  return {
    platform: 'instagram',
    contentType: 'carousel',
    title: 'Instagram Carousel',
    creator: { username: '', displayName: '' },
    thumbnail: images[0]?.url || '',
    imageCount: images.length,
    sourceUrl: url,
    formats: imageFormats(images),
  };
}

/**
 * Scrape fallback for image posts. Hits the public /embed endpoint, which is
 * lighter than the main post page and exposes og:image without auth.
 */
async function analyzeViaScrape(url) {
  // Normalize: derive shortcode → use /embed/captioned to get richer markup.
  const m = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([^/?#]+)/i);
  if (!m) throw Errors.contentUnavailable('Unrecognized Instagram URL');
  const shortcode = m[1];
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;

  const result = await withPage(async (page) => {
    await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    const data = await page.evaluate(() => {
      const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content || '';
      const ogImage = og('og:image');
      const ogTitle = og('og:title');
      const ogVideo = og('og:video') || og('og:video:secure_url');

      // /embed/ injects all media via <img class="EmbeddedMediaImage"> or background-image
      const imgEls = Array.from(document.querySelectorAll('img'))
        .map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight }))
        .filter((i) => i.src && i.w >= 320 && i.h >= 320 && /cdninstagram|fbcdn/i.test(i.src));

      // Username from header.
      const usernameNode = document.querySelector('.UsernameText, [class*="UsernameText"], a[href*="instagram.com/"]');
      const username = usernameNode?.textContent?.trim() || '';

      return { ogImage, ogTitle, ogVideo, imgEls, username };
    });

    return data;
  }, { timeoutMs: 25000 });

  if (result.ogVideo) {
    // Embed page detected video; we cannot reliably download from embed alone.
    throw Errors.contentUnavailable('Video post detected but unavailable without auth');
  }

  // Pick the largest image (post creative).
  const sorted = [...result.imgEls].sort((a, b) => b.w * b.h - a.w * a.h);
  const candidates = sorted.length ? sorted : (result.ogImage ? [{ src: result.ogImage, w: 1080, h: 1080 }] : []);
  if (!candidates.length) throw Errors.contentUnavailable('No image found in post');

  // Dedup by stem (different CDN sizes of the same asset).
  const seen = new Set();
  const images = [];
  for (const c of candidates) {
    const base = c.src.split('/').pop()?.split('?')[0] || c.src;
    if (seen.has(base)) continue;
    seen.add(base);
    images.push({ url: c.src, width: c.w, height: c.h, ext: 'jpg' });
  }

  return {
    platform: 'instagram',
    contentType: images.length > 1 ? 'carousel' : 'image',
    title: result.ogTitle || 'Instagram Post',
    creator: { username: result.username || '', displayName: result.username || '' },
    thumbnail: images[0].url,
    imageCount: images.length,
    sourceUrl: url,
    formats: imageFormats(images),
  };
}
