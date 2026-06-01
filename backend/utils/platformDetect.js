import { PLATFORM_PATTERNS } from '../config/platforms.js';
import { Errors } from './errors.js';

export function detectPlatform(url) {
  for (const p of PLATFORM_PATTERNS) {
    if (p.test(url)) return p.id;
  }
  throw Errors.unsupportedPlatform();
}
