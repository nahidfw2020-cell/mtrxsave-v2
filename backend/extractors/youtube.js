import { ytdlpJson } from '../services/ytdlp.js';
import { videoFormats, firstThumb } from './_base.js';

export async function analyze(url) {
  const info = await ytdlpJson(url);
  return {
    platform: 'youtube',
    contentType: 'video',
    title: info.title || 'YouTube Video',
    creator: {
      username: info.uploader_id || info.channel_id || info.uploader || '',
      displayName: info.uploader || info.channel || '',
      avatar: info.channel_thumbnails?.[0]?.url || '',
    },
    thumbnail: firstThumb(info),
    duration: info.duration || null,
    sourceUrl: url,
    formats: videoFormats(info),
  };
}
