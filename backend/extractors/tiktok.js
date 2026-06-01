import { ytdlpJson } from '../services/ytdlp.js';
import { videoFormats, firstThumb, imageFormats } from './_base.js';

export async function analyze(url) {
  const info = await ytdlpJson(url);

  // TikTok photo posts arrive as entries[].
  if (Array.isArray(info.entries) && info.entries.length && info.entries.every((e) => e.thumbnail && !e.duration)) {
    const images = info.entries.map((e) => ({ url: e.thumbnail || e.url, ext: 'jpg' }));
    return {
      platform: 'tiktok',
      contentType: images.length > 1 ? 'carousel' : 'image',
      title: info.title || 'TikTok Post',
      creator: { username: info.uploader || info.uploader_id || '', displayName: info.uploader || '' },
      thumbnail: images[0]?.url || '',
      imageCount: images.length,
      sourceUrl: url,
      formats: imageFormats(images),
    };
  }

  return {
    platform: 'tiktok',
    contentType: 'video',
    title: info.title || info.description || 'TikTok Video',
    creator: {
      username: info.uploader || info.uploader_id || '',
      displayName: info.uploader || '',
    },
    thumbnail: firstThumb(info),
    duration: info.duration || null,
    sourceUrl: url,
    previewUrl: info.url || null,
    formats: videoFormats(info),
  };
}
