import { ytdlpJson } from '../services/ytdlp.js';
import { videoFormats, firstThumb, imageFormats } from './_base.js';
import { Errors } from '../utils/errors.js';

function looksLikeImage(entry) {
  if (entry?.duration) return false;
  if (Array.isArray(entry?.formats) && entry.formats.some((f) => f.vcodec && f.vcodec !== 'none')) return false;
  return true;
}

export async function analyze(url) {
  const info = await ytdlpJson(url, ['--yes-playlist']);

  // Multi-entry: gallery (multiple images) or thread mixed media.
  if (Array.isArray(info.entries) && info.entries.length) {
    const entries = info.entries;
    const allImages = entries.length > 1 && entries.every(looksLikeImage);
    if (allImages) {
      const images = entries.map((e) => ({
        url: e.url || e.thumbnail,
        ext: 'jpg',
        width: e.width,
        height: e.height,
      })).filter((i) => i.url);
      return {
        platform: 'twitter',
        contentType: 'carousel',
        title: info.title || 'Twitter Post',
        creator: { username: info.uploader || info.uploader_id || '', displayName: info.uploader || '' },
        thumbnail: images[0]?.url || firstThumb(info),
        imageCount: images.length,
        sourceUrl: url,
        formats: imageFormats(images),
      };
    }
    // Use first video entry as primary.
    const primary = entries.find((e) => !looksLikeImage(e)) || entries[0];
    return analyzeEntry(primary, url);
  }

  return analyzeEntry(info, url);
}

function analyzeEntry(entry, url) {
  if (looksLikeImage(entry)) {
    const directUrl = entry.url || entry.thumbnail;
    if (!directUrl) throw Errors.contentUnavailable('No media found');
    const images = [{ url: directUrl, ext: 'jpg', width: entry.width, height: entry.height }];
    return {
      platform: 'twitter',
      contentType: 'image',
      title: entry.title || 'Twitter Image',
      creator: { username: entry.uploader || entry.uploader_id || '', displayName: entry.uploader || '' },
      thumbnail: directUrl,
      imageCount: 1,
      sourceUrl: url,
      formats: imageFormats(images),
    };
  }
  return {
    platform: 'twitter',
    contentType: 'video',
    title: entry.title || entry.description || 'Twitter Video',
    creator: { username: entry.uploader || entry.uploader_id || '', displayName: entry.uploader || '' },
    thumbnail: firstThumb(entry),
    duration: entry.duration || null,
    sourceUrl: url,
    previewUrl: entry.url || null,
    formats: videoFormats(entry),
  };
}
