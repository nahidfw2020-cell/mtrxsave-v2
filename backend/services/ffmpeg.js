import { spawn } from 'node:child_process';
import { config } from '../config/index.js';
import { Errors } from '../utils/errors.js';

export function ffmpegVersion() {
  return new Promise((resolve) => {
    const child = spawn(config.ffmpegPath, ['-version']);
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('error', () => resolve(null));
    child.on('close', () => {
      const first = out.split('\n')[0];
      resolve(first || null);
    });
  });
}

/**
 * Pipe stdin → MP3 → stdout. Used by chaining yt-dlp (audio) -> ffmpeg.
 */
export function ffmpegToMp3(bitrate = 192) {
  const args = [
    '-hide_banner', '-loglevel', 'error',
    '-i', 'pipe:0',
    '-vn',
    '-c:a', 'libmp3lame',
    '-b:a', `${bitrate}k`,
    '-f', 'mp3',
    'pipe:1',
  ];
  const child = spawn(config.ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let err = '';
  child.stderr.on('data', (d) => {
    err += d.toString();
    if (err.length > 4096) err = err.slice(-4096);
  });
  child._getStderr = () => err;
  child.on('error', (e) => {
    child.emit('app-error', Errors.extractionFailed(`ffmpeg spawn failed: ${e.message}`));
  });
  return child;
}
