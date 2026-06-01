/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Platform = 'meta_ad' | 'tiktok_ad' | 'instagram' | 'tiktok' | 'pinterest' | 'facebook';

export interface VideoPlatformInfo {
  id: Platform;
  name: string;
  badgeLabel: string;
  placeholderUrl: string;
  logoColor: string;
  bannerQuote: string;
  username: string;
  videoSrc: string;
  imgUrl: string;
  duration: string;
  sizeGb: string;
  viewsCount: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export const SUPPORTED_PLATFORMS: VideoPlatformInfo[] = [
  {
    id: 'meta_ad',
    name: 'Meta Ad Library',
    badgeLabel: 'Meta Ad Library',
    placeholderUrl: 'https://www.facebook.com/ads/library/?id=123456789',
    logoColor: 'text-[#1877F2]',
    bannerQuote: 'Unbox our pet-friendly modular sofa with 30% off summer sale! 🛋️✨',
    username: 'cozyliving_home',
    videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-smiling-facing-camera-34076-large.mp4',
    imgUrl: 'https://res.cloudinary.com/dp63sgdvp/image/upload/q_auto/f_auto/v1780095050/UD_doxckf.jpg',
    duration: '0:15',
    sizeGb: '4.2 MB',
    viewsCount: '112.4K views'
  },
  {
    id: 'tiktok_ad',
    name: 'TikTok Ad Library',
    badgeLabel: 'TikTok Ad Library',
    placeholderUrl: 'https://library.tiktok.com/ads/detail/123456',
    logoColor: 'text-[#000000]',
    bannerQuote: 'This viral barrier support cream completely restored my glow in 5 days! 🧴🌿',
    username: 'glowwithmaya_ad',
    videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-with-curly-hair-posing-smiling-34281-large.mp4',
    imgUrl: 'https://res.cloudinary.com/dp63sgdvp/image/upload/q_auto/f_auto/v1780095658/MN_i626ht.jpg',
    duration: '0:22',
    sizeGb: '6.8 MB',
    viewsCount: '89.5K views'
  },
  {
    id: 'instagram',
    name: 'Instagram Video',
    badgeLabel: 'Instagram Video',
    placeholderUrl: 'https://www.instagram.com/reel/C3_abcD123/',
    logoColor: 'text-[#E1306C]',
    bannerQuote: 'Secret turquoise lagoon tucked away deep in Bali paradise 🌊🌴',
    username: 'exploringwithsophia',
    videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-woman-standing-near-the-beach-at-sunset-30128-large.mp4',
    imgUrl: 'https://res.cloudinary.com/dp63sgdvp/image/upload/q_auto/f_auto/v1780096379/Dress_code_2-_askglr.jpg',
    duration: '0:30',
    sizeGb: '9.4 MB',
    viewsCount: '1.4M views'
  },
  {
    id: 'tiktok',
    name: 'TikTok Video',
    badgeLabel: 'TikTok Video',
    placeholderUrl: 'https://www.tiktok.com/@dance_crew/video/7891234',
    logoColor: 'text-[#01F2EA]',
    bannerQuote: 'POV: Challenging a professional street dancer in Tokyo 🗣️🇯🇵🔥',
    username: 'tokyocrew_official',
    videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-woman-dancing-hip-hop-styled-in-an-underpass-43407-large.mp4',
    imgUrl: 'https://res.cloudinary.com/dp63sgdvp/image/upload/q_auto/f_auto/v1780095363/PQ_gsf4ir.jpg',
    duration: '0:45',
    sizeGb: '14.1 MB',
    viewsCount: '4.2M views'
  },
  {
    id: 'pinterest',
    name: 'Pinterest Video',
    badgeLabel: 'Pinterest Video',
    placeholderUrl: 'https://www.pinterest.com/pin/1234567890/',
    logoColor: 'text-[#BD081C]',
    bannerQuote: 'Minimalist concrete architectural masterpiece with a sunken fire pit 📏📐',
    username: 'architectural_gems',
    videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-drone-shot-of-a-luxury-mansion-with-a-pool-at-night-42211-large.mp4',
    imgUrl: 'https://res.cloudinary.com/dp63sgdvp/image/upload/q_auto/f_auto/v1780095953/tc_2_wdc3w4.jpg',
    duration: '0:58',
    sizeGb: '18.7 MB',
    viewsCount: '45.1K views'
  },
  {
    id: 'facebook',
    name: 'Facebook Video',
    badgeLabel: 'Facebook Video',
    placeholderUrl: 'https://www.facebook.com/watch/?v=987654321',
    logoColor: 'text-[#1877F2]',
    bannerQuote: 'The ultimate high-protein cucumber and crispy chickpea crunch salad 🥒🥗',
    username: 'chef_lucas_bites',
    videoSrc: 'https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-salad-close-up-4573-large.mp4',
    imgUrl: 'https://res.cloudinary.com/dp63sgdvp/image/upload/q_auto/f_auto/v1780095852/TC_qwockt.jpg',
    duration: '1:15',
    sizeGb: '22.5 MB',
    viewsCount: '310.2K views'
  }
];

export const FAQS: FAQItem[] = [
  {
    question: 'How do I download videos using MtrxSave?',
    answer: 'Simply copy the URL of the video or ad from your favorite platform (TikTok, Instagram, Facebook, Pinterest, or Meta Ad Library), paste it into the prominent link field, and click the "Download" button. We will analyze the link and present options to save it in high definition.'
  },
  {
    question: 'Is there any limit to the number of downloads?',
    answer: 'No, MtrxSave is 100% free with unlimited downloads. You can fetch and store as many videos as you want without experiencing any speed throttles.'
  },
  {
    question: 'Does MtrxSave support downloading from Ad Libraries?',
    answer: 'Absolutely! MtrxSave is specially optimized for marketers and creators. You can paste links from both the Meta Ad Library and the TikTok Creative Center/Ad Library to download ad assets for analysis and creative brainstorming.'
  },
  {
    question: 'Do you store downloaded videos on your servers?',
    answer: 'No, MtrxSave prioritizes user privacy. We do not store any videos on our servers, nor do we track download logs. All fetches are completed in real-time straight to your local browser storage and downloaded securely.'
  },
  {
    question: 'Can I download videos on Android, iOS, or macOS?',
    answer: 'Yes, MtrxSave has a responsive framework that runs on all devices. You can save social media clips on iPhone, Android tablets, iPads, Windows, and Mac computers instantly.'
  },
  {
    question: 'Are there options to extract just the audio or select resolutions?',
    answer: 'Yes! Upon inserting a link, MtrxSave parses options for multiple resolutions including HD 1080p, SD 720p, 480p, and a separate High-Bitrate MP3 audio-only extraction.'
  }
];

export const FEATURES: FeatureItem[] = [
  {
    icon: 'Zap',
    title: 'Instant Downloader',
    description: 'No waiting, queue systems, or intermediate clicks. Our systems parse the link and output file links instantly.'
  },
  {
    icon: 'ShieldCheck',
    title: '100% Secure & Private',
    description: 'Secure SSL tunnels query platform files directly. Your private account details, logs, or cache remain secure.'
  },
  {
    icon: 'Tv',
    title: 'lossless HD Quality',
    description: 'Download the source video in its original resolution—supporting up to 2K, 1080p, and high-fidelity stereo sound.'
  },
  {
    icon: 'Smartphone',
    title: 'Cross-Device System',
    description: 'A responsive visual experience that functions smoothly across Chrome, Safari, Firefox, Edge, on iOS & Android.'
  },
  {
    icon: 'UserCheck',
    title: 'No Sign-In Required',
    description: 'Get straight to downloading. There is no email authorization, CAPTCHA fatigue, or payment gateways.'
  },
  {
    icon: 'Sparkles',
    title: 'Ad Library Optimized',
    description: 'Ideal tool for creators, copywriters, and performance marketers seeking swipe files from ad platforms.'
  }
];
