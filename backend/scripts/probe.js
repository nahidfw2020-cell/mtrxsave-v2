#!/usr/bin/env node
/**
 * Facebook / yt-dlp diagnostic probe.
 *
 *   node scripts/probe.js <URL> [height]
 *
 * Steps:
 *   1. yt-dlp -F          (list all formats)
 *   2. yt-dlp -j           (resolved metadata)
 *   3. download with the same H264+AAC selector the backend uses, to /tmp
 *   4. ffprobe -show_format -show_streams on resulting file
 *
 * Prints: container + video codec + audio codec + chosen format ids.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const url = process.argv[2];
const height = process.argv[3] ? parseInt(process.argv[3], 10) : 0;
if (!url) {
  console.error('Usage: node scripts/probe.js <URL> [height]');
  process.exit(2);
}

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '';
    let stderr = '';
    c.stdout.on('data', (d) => (stdout += d.toString()));
    c.stderr.on('data', (d) => (stderr += d.toString()));
    c.on('close', (code) => resolve({ code, stdout, stderr }));
    c.on('error', (e) => resolve({ code: -1, stdout, stderr: e.message }));
  });
}

function buildSelector(h) {
  const cap = h ? `[height<=${h}]` : '';
  return [
    `bv*[vcodec^=avc1]${cap}+ba[acodec^=mp4a]/`,
    `bv*[vcodec^=avc1]${cap}+ba/`,
    `b[vcodec^=avc1][acodec^=mp4a]${cap}/`,
    `b[ext=mp4]${cap}/`,
    `bv*${cap}+ba/b${cap}`,
  ].join('').replace(/\/$/, '');
}

(async () => {
  console.log('URL:', url);
  console.log('Height cap:', height || '(none)');
  console.log('YT-DLP:', YTDLP);
  console.log('FFPROBE:', FFPROBE);
  console.log('---');

  console.log('1) yt-dlp -F  (available formats)');
  const list = await run(YTDLP, ['--no-warnings', '-F', url]);
  console.log(list.stdout || list.stderr);
  console.log('---');

  const selector = buildSelector(height);
  console.log('2) Backend selector:', selector);

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'mtrxsave-probe-'));
  const outPath = path.join(tmp, 'out.mp4');

  console.log('3) Downloading to', outPath, '...');
  const dl = await run(YTDLP, [
    '--no-warnings',
    '-f', selector,
    '--remux-video', 'mp4',
    '--postprocessor-args', 'ffmpeg:-movflags +faststart',
    '-o', outPath,
    url,
  ]);
  process.stdout.write(dl.stdout);
  process.stderr.write(dl.stderr);
  console.log('yt-dlp exit code:', dl.code);
  if (dl.code !== 0) process.exit(dl.code || 1);

  console.log('---');
  console.log('4) ffprobe codec/container report');
  const probe = await run(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'format=format_name,format_long_name,duration,size:stream=index,codec_type,codec_name,profile,width,height,channels,sample_rate,bit_rate',
    '-of', 'default=noprint_wrappers=0',
    outPath,
  ]);
  console.log(probe.stdout || probe.stderr);

  // Compact summary.
  const m = probe.stdout || '';
  const fmt = (m.match(/format_name=([^\n]+)/) || [])[1];
  const vCodec = (m.match(/codec_type=video\s*[\s\S]*?codec_name=([^\n]+)/) || [])[1];
  const aCodec = (m.match(/codec_type=audio\s*[\s\S]*?codec_name=([^\n]+)/) || [])[1];
  console.log('---');
  console.log('SUMMARY');
  console.log('  container :', fmt || '(unknown)');
  console.log('  video     :', vCodec || '(none)');
  console.log('  audio     :', aCodec || '(none)');
  console.log('  saved to  :', outPath);
})().catch((e) => {
  console.error('probe failed:', e);
  process.exit(1);
});
