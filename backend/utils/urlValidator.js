import { Errors } from './errors.js';
import { PLATFORM_PATTERNS } from '../config/platforms.js';

const MAX_URL_LEN = 2048;

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fc|fd|fe80|metadata\.google\.internal)/i;

const ALLOWED_HOSTS = new Set(
  PLATFORM_PATTERNS.flatMap((p) => p.hosts).map((h) => h.toLowerCase())
);

export function validateUrl(raw) {
  if (typeof raw !== 'string') throw Errors.invalidUrl('URL must be a string');
  const trimmed = raw.trim();
  if (!trimmed) throw Errors.invalidUrl('URL required');
  if (trimmed.length > MAX_URL_LEN) throw Errors.invalidUrl('URL too long');

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw Errors.invalidUrl('Malformed URL');
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw Errors.invalidUrl('Only http/https allowed');
  }

  const host = parsed.hostname.toLowerCase();
  if (PRIVATE_HOST_RE.test(host)) throw Errors.invalidUrl('Private host blocked');

  if (!ALLOWED_HOSTS.has(host)) {
    throw Errors.unsupportedPlatform(`Host not supported: ${host}`);
  }

  return parsed.toString();
}
