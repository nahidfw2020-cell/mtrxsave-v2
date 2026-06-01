import * as youtube from './youtube.js';
import * as tiktok from './tiktok.js';
import * as instagram from './instagram.js';
import * as facebook from './facebook.js';
import * as pinterest from './pinterest.js';
import * as metaAds from './metaAds.js';
import * as tiktokAds from './tiktokAds.js';
import * as twitter from './twitter.js';
import * as reddit from './reddit.js';
import { Errors } from '../utils/errors.js';

const REGISTRY = {
  youtube,
  tiktok,
  instagram,
  facebook,
  pinterest,
  meta_ad: metaAds,
  tiktok_ad: tiktokAds,
  twitter,
  reddit,
};

export function getExtractor(platformId) {
  const ext = REGISTRY[platformId];
  if (!ext) throw Errors.unsupportedPlatform();
  return ext;
}
