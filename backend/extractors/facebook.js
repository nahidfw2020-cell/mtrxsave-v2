import { ytdlpJson } from '../services/ytdlp.js';
import { withPage } from '../services/puppeteer.js';
import { videoFormats, firstThumb, imageFormats } from './_base.js';
import { Errors } from '../utils/errors.js';

function looksLikeImagePostUrl(url) {
  return /facebook\.com\/[^/]+\/photos\//i.test(url) || /facebook\.com\/photo(\.php|\/)/i.test(url);
}

export async function analyze(url) {
  if (looksLikeImagePostUrl(url)) {
    return analyzeImagePost(url);
  }
  try {
    const info = await ytdlpJson(url);
    return {
      platform: 'facebook',
      contentType: 'video',
      title: info.title || info.description || 'Facebook Video',
      creator: { username: info.uploader || info.uploader_id || '', displayName: info.uploader || '' },
      thumbnail: firstThumb(info),
      duration: info.duration || null,
      sourceUrl: url,
      previewUrl: info.url || null,
      formats: videoFormats(info),
    };
  } catch (e) {
    if (e.code === 'CONTENT_UNAVAILABLE') throw e;
    return analyzeImagePost(url);
  }
}

async function analyzeImagePost(url) {
  const meta = await withPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    return page.evaluate(() => {
      const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content || '';
      return {
        ogImage: og('og:image'),
        ogTitle: og('og:title'),
        ogDescription: og('og:description'),
      };
    });
  });

  if (!meta.ogImage) throw Errors.contentUnavailable('No image found');
  const images = [{ url: meta.ogImage, ext: 'jpg' }];
  return {
    platform: 'facebook',
    contentType: 'image',
    title: meta.ogTitle || meta.ogDescription || 'Facebook Image',
    creator: { username: '', displayName: '' },
    thumbnail: meta.ogImage,
    imageCount: 1,
    sourceUrl: url,
    formats: imageFormats(images),
  };
}
