import { LRUCache } from 'lru-cache';
import { config } from '../config/index.js';

export const analyzeCache = new LRUCache({
  max: 1000,
  ttl: config.tokenTtl * 1000,
  ttlAutopurge: true,
});

export function putAnalyze(token, result) {
  analyzeCache.set(token, result);
}

export function getAnalyze(token) {
  return analyzeCache.get(token);
}
