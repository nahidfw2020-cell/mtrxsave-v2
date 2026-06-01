// Platform URL signatures. Order matters — ad libraries before generic platform.
export const PLATFORM_PATTERNS = [
  {
    id: 'meta_ad',
    hosts: ['facebook.com', 'www.facebook.com'],
    test: (u) => /facebook\.com\/ads\/library/i.test(u),
  },
  {
    id: 'tiktok_ad',
    hosts: ['library.tiktok.com', 'ads.tiktok.com'],
    test: (u) => /(library\.tiktok\.com|ads\.tiktok\.com\/business\/creativecenter)/i.test(u),
  },
  {
    id: 'youtube',
    hosts: ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'],
    test: (u) => /(youtube\.com|youtu\.be)/i.test(u),
  },
  {
    id: 'tiktok',
    hosts: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'm.tiktok.com'],
    test: (u) => /tiktok\.com/i.test(u),
  },
  {
    id: 'instagram',
    hosts: ['instagram.com', 'www.instagram.com'],
    test: (u) => /instagram\.com\/(reel|reels|p|tv|stories)/i.test(u),
  },
  {
    id: 'facebook',
    hosts: ['facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com'],
    test: (u) => /(facebook\.com|fb\.watch)/i.test(u),
  },
  {
    id: 'pinterest',
    hosts: ['pinterest.com', 'www.pinterest.com', 'pin.it', 'pinterest.co.uk', 'pinterest.ca'],
    test: (u) => /(pinterest\.[a-z.]+|pin\.it)/i.test(u),
  },
  {
    id: 'twitter',
    hosts: ['twitter.com', 'www.twitter.com', 'mobile.twitter.com', 'x.com', 'www.x.com', 'mobile.x.com', 't.co'],
    test: (u) => /(twitter\.com|x\.com|t\.co)/i.test(u),
  },
  {
    id: 'reddit',
    hosts: ['reddit.com', 'www.reddit.com', 'old.reddit.com', 'new.reddit.com', 'np.reddit.com', 'm.reddit.com', 'redd.it', 'v.redd.it', 'i.redd.it'],
    test: (u) => /(reddit\.com|redd\.it)/i.test(u),
  },
];

export const PLATFORM_IDS = PLATFORM_PATTERNS.map((p) => p.id);

export function isPlatformId(v) {
  return PLATFORM_IDS.includes(v);
}
