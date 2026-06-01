import { request } from 'undici';
import { ytdlpJson } from '../services/ytdlp.js';
import { videoFormats, firstThumb, imageFormats } from './_base.js';
import { Errors } from '../utils/errors.js';

function looksLikeImage(entry) {
  if (entry?.duration) return false;
  if (Array.isArray(entry?.formats) && entry.formats.some((f) => f.vcodec && f.vcodec !== 'none')) return false;
  return true;
}

async function fetchRedditJson(url) {
  // Reddit gallery posts often need the .json endpoint to enumerate media.
  let target = url.replace(/\?.*$/, '');
  if (!target.endsWith('.json')) target = target.replace(/\/?$/, '.json');
  try {
    const { body, statusCode } = await request(target, {
      method: 'GET',
      headers: { 'user-agent': 'mtrxsave/1.0' },
    });
    if (statusCode >= 400) return null;
    const text = await body.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractGalleryImages(post) {
  const items = post?.gallery_data?.items;
  const meta = post?.media_metadata;
  if (!items || !meta) return [];
  const out = [];
  for (const it of items) {
    const m = meta[it.media_id];
    if (!m) continue;
    const ext = (m.m && m.m.split('/')[1]) || 'jpg';
    const src = m.s?.u || m.p?.[m.p.length - 1]?.u;
    if (!src) continue;
    // Reddit serializes URLs with HTML entities.
    const clean = src.replace(/&amp;/g, '&');
    out.push({ url: clean, ext: ext.toLowerCase().replace('jpeg', 'jpg'), width: m.s?.x, height: m.s?.y });
  }
  return out;
}

export async function analyze(url) {
  // Try gallery first (yt-dlp doesn't expand reddit galleries reliably).
  const json = await fetchRedditJson(url);
  const post = Array.isArray(json) ? json[0]?.data?.children?.[0]?.data : null;
  if (post?.is_gallery && post?.gallery_data) {
    const images = extractGalleryImages(post);
    if (images.length) {
      return {
        platform: 'reddit',
        contentType: images.length > 1 ? 'carousel' : 'image',
        title: post.title || 'Reddit Post',
        creator: { username: post.author || '', displayName: post.author || '' },
        thumbnail: images[0].url,
        imageCount: images.length,
        sourceUrl: url,
        formats: imageFormats(images),
      };
    }
  }

  // Single image post (i.redd.it / external).
  if (post?.post_hint === 'image' && post?.url_overridden_by_dest) {
    const imgUrl = post.url_overridden_by_dest;
    const images = [{ url: imgUrl, ext: imgUrl.match(/\.(\w+)(\?|$)/)?.[1] || 'jpg' }];
    return {
      platform: 'reddit',
      contentType: 'image',
      title: post.title || 'Reddit Image',
      creator: { username: post.author || '', displayName: post.author || '' },
      thumbnail: imgUrl,
      imageCount: 1,
      sourceUrl: url,
      formats: imageFormats(images),
    };
  }

  // Video / external embed → yt-dlp.
  try {
    const info = await ytdlpJson(url);
    if (info && (info.duration || (Array.isArray(info.formats) && info.formats.some((f) => f.vcodec && f.vcodec !== 'none')))) {
      return {
        platform: 'reddit',
        contentType: 'video',
        title: info.title || post?.title || 'Reddit Video',
        creator: { username: info.uploader || post?.author || '', displayName: info.uploader || post?.author || '' },
        thumbnail: firstThumb(info),
        duration: info.duration || null,
        sourceUrl: url,
        previewUrl: info.url || null,
        formats: videoFormats(info),
      };
    }
    if (looksLikeImage(info)) {
      const directUrl = info.url || info.thumbnail;
      if (directUrl) {
        const images = [{ url: directUrl, ext: 'jpg' }];
        return {
          platform: 'reddit',
          contentType: 'image',
          title: info.title || 'Reddit Image',
          creator: { username: info.uploader || '', displayName: info.uploader || '' },
          thumbnail: directUrl,
          imageCount: 1,
          sourceUrl: url,
          formats: imageFormats(images),
        };
      }
    }
  } catch (e) {
    if (e.code !== 'CONTENT_UNAVAILABLE' && e.code !== 'EXTRACTION_FAILED') throw e;
  }

  throw Errors.contentUnavailable('No reddit media found');
}
