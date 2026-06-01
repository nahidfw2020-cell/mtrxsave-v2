/**
 * Unified analyze result contract.
 *
 * Returned by every extractor.analyze(url) → AnalyzeResult.
 *
 * type AnalyzeResult = {
 *   platform: PlatformId,
 *   contentType: 'video' | 'image' | 'carousel',
 *   title: string,
 *   creator: { username: string, displayName?: string, avatar?: string },
 *   thumbnail: string,
 *   duration?: number,
 *   imageCount?: number,
 *   sourceUrl: string,
 *   previewUrl?: string | null,
 *   formats: Format[]
 * }
 *
 * Video formats simplified to just:
 *   - Original MP4 (best available, prefers H264+AAC, falls back to anything)
 *   - MP3 192 kbps audio extracted from the same source
 *
 * Image formats:
 *   - One entry per image
 *   - One ZIP entry when carousel
 */

function biggest(arr) {
  let m = 0;
  for (const f of arr) {
    const s = f.filesize || f.filesize_approx || 0;
    if (s > m) m = s;
  }
  return m;
}

function estimateVideoSize(info) {
  if (!info) return null;
  if (typeof info.filesize === 'number' && info.filesize > 0) return info.filesize;
  if (typeof info.filesize_approx === 'number' && info.filesize_approx > 0) return info.filesize_approx;
  if (Array.isArray(info.formats)) {
    const videos = info.formats.filter((f) => f.vcodec && f.vcodec !== 'none');
    const audios = info.formats.filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
    const v = biggest(videos);
    const a = biggest(audios);
    if (v) return v + a;
  }
  return null;
}

function estimateAudioSize(info) {
  const dur = info?.duration || 0;
  if (!dur) return null;
  return Math.round((dur * 192 * 1000) / 8); // 192 kbps mp3
}

export function videoFormats(info) {
  return [
    {
      id: 'video_original',
      kind: 'video',
      container: 'mp4',
      label: 'Original Video (MP4)',
      size: estimateVideoSize(info),
      hasAudio: true,
    },
    {
      id: 'audio_mp3',
      kind: 'audio',
      container: 'mp3',
      label: 'Audio Only (MP3, 192 kbps)',
      bitrate: 192,
      size: estimateAudioSize(info),
    },
  ];
}

export function imageFormats(images) {
  const list = images.map((img, i) => ({
    id: `image_${i}`,
    kind: 'image',
    container: (img.ext || 'jpg').toLowerCase(),
    label: images.length > 1 ? `Image ${i + 1}` : 'Original Image',
    width: img.width || null,
    height: img.height || null,
    size: img.size || null,
    index: i,
    directUrl: img.url,
  }));
  if (images.length > 1) {
    list.push({
      id: 'images_zip',
      kind: 'zip',
      container: 'zip',
      label: 'Download All as ZIP',
      count: images.length,
    });
  }
  return list;
}

export function firstThumb(info) {
  if (typeof info?.thumbnail === 'string') return info.thumbnail;
  if (Array.isArray(info?.thumbnails) && info.thumbnails.length) {
    return info.thumbnails[info.thumbnails.length - 1]?.url || info.thumbnails[0]?.url;
  }
  return '';
}
