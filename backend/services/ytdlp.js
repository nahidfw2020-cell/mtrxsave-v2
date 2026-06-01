import { spawn } from 'node:child_process';
import { config } from '../config/index.js';
import { Errors } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

let active = 0;

function gate() {
  if (active >= config.maxConcurrentYtdlp) {
    throw Errors.busy('yt-dlp pool exhausted');
  }
  active++;
  return () => {
    active = Math.max(0, active - 1);
  };
}

function baseArgs() {
  const a = ['--no-warnings', '--no-progress', '--no-check-certificate'];
  if (config.cookieJarPath) a.push('--cookies', config.cookieJarPath);
  return a;
}

export function ytdlpVersion() {
  return new Promise((resolve) => {
    const child = spawn(config.ytdlpPath, ['--version']);
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('error', () => resolve(null));
    child.on('close', () => resolve(out.trim() || null));
  });
}

export async function ytdlpJson(url, extraArgs = []) {
  const release = gate();
  return new Promise((resolve, reject) => {
    const args = [...baseArgs(), '--dump-single-json', ...extraArgs, url];
    const child = spawn(config.ytdlpPath, args);
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => {
      release();
      reject(Errors.extractionFailed(`yt-dlp spawn failed: ${e.message}`));
    });
    child.on('close', (code) => {
      release();
      if (code !== 0) {
        const lower = err.toLowerCase();
        if (/unavailable|private|removed|404|not found/.test(lower)) {
          return reject(Errors.contentUnavailable(err.split('\n')[0] || 'Unavailable'));
        }
        logger.warn({ url, code, err: err.slice(0, 400) }, 'yt-dlp non-zero');
        return reject(Errors.extractionFailed(err.split('\n')[0] || `yt-dlp exit ${code}`));
      }
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(Errors.extractionFailed(`yt-dlp JSON parse failed: ${e.message}`));
      }
    });
  });
}

/**
 * Stream a single yt-dlp format directly to stdout (no temp file).
 * Returns the child process so the route can pipe stdout → res and kill on abort.
 */
export function ytdlpStream(url, formatSelector, extraArgs = []) {
  const release = gate();
  const args = [
    ...baseArgs(),
    '-f', formatSelector,
    '-o', '-',
    ...extraArgs,
    url,
  ];
  const child = spawn(config.ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderrBuf = '';
  child.stderr.on('data', (d) => {
    stderrBuf += d.toString();
    if (stderrBuf.length > 8192) stderrBuf = stderrBuf.slice(-8192);
  });
  const cleanup = () => release();
  child.on('close', cleanup);
  child.on('error', cleanup);
  child._getStderr = () => stderrBuf;
  return child;
}
