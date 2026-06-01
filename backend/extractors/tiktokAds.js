import { withPage } from '../services/puppeteer.js';
import { videoFormats, imageFormats } from './_base.js';
import { Errors } from '../utils/errors.js';

export async function analyze(url) {
  const scraped = await withPage(async (page) => {
    const videos = new Set();
    page.on('response', (resp) => {
      const ct = resp.headers()['content-type'] || '';
      const reqUrl = resp.url();
      if (/^video\//.test(ct) || /\.mp4(\?|$)/i.test(reqUrl)) videos.add(reqUrl);
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});

    const meta = await page.evaluate(() => {
      const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content || '';
      const title = og('og:title') || document.title;
      const description = og('og:description');
      const ogImage = og('og:image');
      const imgs = Array.from(document.querySelectorAll('img'))
        .map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight }))
        .filter((i) => i.src && i.w >= 400 && i.h >= 400);
      const vids = Array.from(document.querySelectorAll('video'))
        .map((v) => v.currentSrc || v.src)
        .filter(Boolean);
      const posters = Array.from(document.querySelectorAll('video[poster]'))
        .map((v) => v.getAttribute('poster'))
        .filter(Boolean);
      return { title, description, imgs, vids, posters, ogImage };
    });

    for (const v of meta.vids) videos.add(v);
    return {
      title: meta.title || 'TikTok Ad',
      advertiser: meta.description || '',
      videos: Array.from(videos),
      images: meta.imgs,
      posters: meta.posters,
      ogImage: meta.ogImage,
    };
  }, { timeoutMs: 30000 });

  if (scraped.videos.length) {
    const thumb =
      scraped.images[0]?.src
      || scraped.posters?.[0]
      || scraped.ogImage
      || '';
    return {
      platform: 'tiktok_ad',
      contentType: 'video',
      title: scraped.title,
      creator: { username: '', displayName: scraped.advertiser },
      thumbnail: thumb,
      duration: null,
      sourceUrl: url,
      previewUrl: scraped.videos[0] || null,
      _directVideoUrl: scraped.videos[0],
      formats: videoFormats(null),
    };
  }

  if (scraped.images.length) {
    const images = scraped.images.map((i) => ({ url: i.src, width: i.w, height: i.h, ext: 'jpg' }));
    return {
      platform: 'tiktok_ad',
      contentType: images.length > 1 ? 'carousel' : 'image',
      title: scraped.title,
      creator: { username: '', displayName: scraped.advertiser },
      thumbnail: images[0].url,
      imageCount: images.length,
      sourceUrl: url,
      formats: imageFormats(images),
    };
  }

  throw Errors.contentUnavailable('No TikTok ad creative found');
}
