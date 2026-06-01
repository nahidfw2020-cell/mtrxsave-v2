import { withPage } from '../services/puppeteer.js';
import { videoFormats, imageFormats } from './_base.js';
import { Errors } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Meta Ad Library SPA scrape.
 *
 * Improved strategy:
 *  - Use DOM <img> + background-image only (network-intercepted CDN URLs are
 *    polluted by UI chrome placeholders like gradient fills).
 *  - Require natural dimensions >= 400×400 AND aspect ratio between 0.4 and 3.0.
 *  - Scroll progressively and re-scan to catch lazy creatives.
 *  - Sort by pixel area desc, dedup by base filename.
 *  - Filter to scontent/video fbcdn CDN hosts only.
 *  - Drop SVG/GIF emoji/UI assets.
 */

const FB_CDN = /fbcdn\.net/i;
const FB_CHROME = /(static\.|emoji\.|rsrc\.php|\.svg(\?|$)|\.gif(\?|$))/i;

function isCreativeImage(u, w = 0, h = 0) {
  if (!u) return false;
  if (FB_CHROME.test(u)) return false;
  if (!FB_CDN.test(u)) return false;
  if (w && h) {
    if (w < 400 || h < 400) return false;
    const ar = w / h;
    if (ar < 0.4 || ar > 3.0) return false;
  }
  return true;
}

function isCreativeVideo(u) {
  if (!u) return false;
  return FB_CDN.test(u) || /\.mp4(\?|$)/i.test(u);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function collectDomCreatives(page) {
  return page.evaluate(() => {
    const out = new Map();
    const push = (src, w, h) => {
      if (!src) return;
      if (!w || !h) return;
      if (w < 400 || h < 400) return;
      const ar = w / h;
      if (ar < 0.4 || ar > 3.0) return;
      const key = src.split('?')[0];
      const prev = out.get(key);
      if (!prev || prev.w * prev.h < w * h) {
        out.set(key, { src, w, h });
      }
    };
    for (const img of document.querySelectorAll('img')) {
      push(img.currentSrc || img.src, img.naturalWidth, img.naturalHeight);
    }
    for (const el of document.querySelectorAll('[style*="background"], div')) {
      const bg = getComputedStyle(el).backgroundImage;
      const m = bg && bg.match(/url\((['"]?)(https?:[^'")]+)\1\)/);
      if (m) {
        const r = el.getBoundingClientRect();
        push(m[2], Math.round(r.width), Math.round(r.height));
      }
    }
    return Array.from(out.values());
  });
}

export async function analyze(url) {
  const scraped = await withPage(async (page) => {
    const videos = new Set();

    page.on('response', (resp) => {
      try {
        const ct = resp.headers()['content-type'] || '';
        const u = resp.url();
        if (/^video\//.test(ct) || /\.mp4(\?|$)/i.test(u)) {
          if (isCreativeVideo(u)) videos.add(u);
        }
      } catch {}
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});

    // Wait for first creative-sized image to materialize.
    try {
      await page.waitForFunction(
        () => Array.from(document.images).some(
          (i) => /fbcdn\.net/.test(i.currentSrc || i.src) && i.naturalWidth >= 400 && i.naturalHeight >= 400
        ),
        { timeout: 15000 }
      );
    } catch {
      // Continue — may still find via scroll passes.
    }

    // Brief settle so the target ad's own video can fire its request (no scroll
    // yet, so the advertiser's other ads are not loaded).
    await sleep(1500);

    // Snapshot the TARGET ad's video state BEFORE scrolling. Scrolling lazy-loads
    // the advertiser's OTHER ads, whose videos would otherwise pollute the
    // classification and turn an image ad into a video result.
    const earlyVideoState = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('video'));
      return {
        hasVideoEl: els.length > 0,
        domVideoSrcs: els.map((v) => v.currentSrc || v.src).filter(Boolean),
      };
    });
    const earlyNetVideos = Array.from(videos);

    // Multiple scroll passes to coax lazy-loaded card images.
    const allImages = new Map();
    for (let pass = 0; pass < 6; pass++) {
      await page.evaluate((dy) => window.scrollBy(0, dy), 500);
      await sleep(700);
      const found = await collectDomCreatives(page);
      for (const f of found) {
        if (!isCreativeImage(f.src, f.w, f.h)) continue;
        const key = f.src.split('?')[0];
        const prev = allImages.get(key);
        if (!prev || prev.w * prev.h < f.w * f.h) {
          allImages.set(key, f);
        }
      }
      if (allImages.size && pass >= 2) break; // we have at least one, brief extra wait done
    }

    const meta = await page.evaluate(() => {
      const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content || '';
      const posters = Array.from(document.querySelectorAll('video[poster]'))
        .map((v) => v.getAttribute('poster'))
        .filter(Boolean);
      return {
        title: og('og:title') || document.title,
        description: og('og:description'),
        ogImage: og('og:image'),
        posters,
      };
    });

    // Sort by area desc.
    const sortedImages = Array.from(allImages.values()).sort((a, b) => b.w * b.h - a.w * a.h);

    // Classify as video only from the TARGET ad's pre-scroll state: a <video>
    // element must have rendered, and we use only video URLs seen before the
    // scroll passes loaded the advertiser's other (possibly video) ads.
    const domVideos = (earlyVideoState.domVideoSrcs || []).filter(isCreativeVideo);
    const videoUrls = earlyVideoState.hasVideoEl ? [...domVideos, ...earlyNetVideos] : [];

    return {
      title: meta.title || 'Meta Ad',
      advertiser: meta.description || '',
      videos: Array.from(new Set(videoUrls)),
      images: sortedImages.map((i) => ({ url: i.src, width: i.w, height: i.h })),
      posters: meta.posters,
      ogImage: meta.ogImage,
    };
  }, { timeoutMs: 45000 });

  logger.info({
    videos: scraped.videos.length,
    images: scraped.images.length,
    topImage: scraped.images[0]?.url?.slice(0, 80),
  }, 'meta_ad scrape complete');

  if (scraped.videos.length) {
    const thumb =
      scraped.images[0]?.url
      || scraped.posters?.[0]
      || (scraped.ogImage && !/static\./.test(scraped.ogImage) ? scraped.ogImage : '')
      || '';
    return {
      platform: 'meta_ad',
      contentType: 'video',
      title: scraped.title || 'Meta Ad Video',
      creator: { username: '', displayName: scraped.advertiser || '' },
      thumbnail: thumb,
      duration: null,
      sourceUrl: url,
      previewUrl: scraped.videos[0] || null,
      _directVideoUrl: scraped.videos[0],
      formats: videoFormats(null),
    };
  }

  if (scraped.images.length) {
    // Dedup by base filename suffix (different CDN size variants).
    const seen = new Set();
    const deduped = [];
    for (const img of scraped.images) {
      const base = img.url.split('/').pop()?.split('?')[0] || img.url;
      if (seen.has(base)) continue;
      seen.add(base);
      deduped.push({ url: img.url, width: img.width || null, height: img.height || null, ext: 'jpg' });
    }
    return {
      platform: 'meta_ad',
      contentType: deduped.length > 1 ? 'carousel' : 'image',
      title: scraped.title || 'Meta Ad Image',
      creator: { username: '', displayName: scraped.advertiser || '' },
      thumbnail: deduped[0].url,
      imageCount: deduped.length,
      sourceUrl: url,
      formats: imageFormats(deduped),
    };
  }

  throw Errors.contentUnavailable('No ad creative found');
}
