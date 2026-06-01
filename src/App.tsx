/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  Tv, 
  Smartphone, 
  UserCheck, 
  Sparkles, 
  Download, 
  Link as LinkIcon, 
  Sun, 
  Moon, 
  ChevronDown, 
  Check, 
  Loader2, 
  Play, 
  Volume2, 
  RefreshCw, 
  PlayCircle, 
  Video, 
  Info, 
  ExternalLink, 
  Eye, 
  Heart,
  Share2,
  X,
  VolumeX,
  ArrowRight,
  Sparkle,
  AudioLines
} from 'lucide-react';
import { SUPPORTED_PLATFORMS, FAQS, FEATURES, VideoPlatformInfo, Platform } from './types';
import { analyzeUrl, buildDownloadUrl, buildPreviewUrl, buildThumbnailUrl, AnalyzeResponse, BackendFormat } from './services/api';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [videoLink, setVideoLink] = useState('');
  const [activePlatform, setActivePlatform] = useState<Platform>('tiktok');
  const [downloadStep, setDownloadStep] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [loadingStepText, setLoadingStepText] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  
  // Custom video player control states
  const [previewVideo, setPreviewVideo] = useState<VideoPlatformInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showMockOverlay, setShowMockOverlay] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  // Real backend analyze result + token (drives download buttons)
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);

  // Premium loading-modal state
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeStage, setAnalyzeStage] = useState('Analyzing URL...');
  const [analyzeReady, setAnalyzeReady] = useState(false);

  // Swipe and selection carousel refs
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleCarouselScroll = () => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    
    // Only synchronize active tab automatically on small views (mobile carousel scroll)
    if (window.innerWidth >= 768) return;

    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const centerPoint = scrollLeft + containerWidth / 2;

    let closestPlatform: Platform | null = null;
    let minDistance = Infinity;

    SUPPORTED_PLATFORMS.forEach((platform) => {
      const el = cardRefs.current[platform.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2 - containerRect.left + scrollLeft;
        const distance = Math.abs(cardCenter - centerPoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestPlatform = platform.id;
        }
      }
    });

    if (closestPlatform && closestPlatform !== activePlatform) {
      setActivePlatform(closestPlatform);
      const platform = SUPPORTED_PLATFORMS.find(p => p.id === closestPlatform);
      if (platform) {
        setVideoLink(platform.placeholderUrl);
      }
    }
  };
  // Initialize theme from system or saved preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme as 'light' | 'dark');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    triggerToast(`Switched to ${nextTheme === 'dark' ? 'Dark Futuristic' : 'Pristine Light'} mode!`);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Set URL input from Bottom Filter Chip or Card play click
  const selectPlatformUrl = (platformId: Platform, autoTrigger = false) => {
    const platform = SUPPORTED_PLATFORMS.find(p => p.id === platformId);
    if (platform) {
      setActivePlatform(platformId);
      setVideoLink(platform.placeholderUrl);

      // Smooth scroll the corresponding preview card into the viewport center
      const targetCard = cardRefs.current[platformId];
      if (targetCard && carouselRef.current) {
        targetCard.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }

      if (autoTrigger) {
        handleDownloadSequence(platform.placeholderUrl, platform);
      } else {
        triggerToast(`Loaded sample URL for ${platform.name}`);
      }
    }
  };

  const getPlatformLogo = (platformId: Platform) => {
    switch (platformId) {
      case 'meta_ad':
        return (
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.1 7.1c-1.3-.1-2.7.5-3.6 1.6l-.5.7-.5-.7c-.9-1.1-2.3-1.7-3.6-1.6-2.5.1-4.4 2-4.4 4.5s2 4.5 4.5 4.5c1.3.1 2.7-.5 3.6-1.6l.5-.7.5.7c.9 1.1 2.3 1.7 3.6 1.6 2.5-.1 4.4-2 4.4-4.5s-2-4.5-4.5-4.5zm-8.2 6.5c-1.2 0-2.2-1-2.2-2.2s1-2.2 2.2-2.2c.8-.1 1.6.4 2 1.1l.6.9-.6.9c-.4.7-1.2 1.2-2 1.3zm8.2 0c-.8-.1-1.6-.6-2-1.3l-.6-.9.6-.9c.4-.7 1.2-1.2 2-1.3 1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2z" fill="#0064E0"/>
          </svg>
        );
      case 'tiktok_ad':
      case 'tiktok':
        return (
          <svg className="w-3.5 h-3.5 text-black shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.72v4.03c-1.44-.17-2.89-.73-3.99-1.72-.11-.1-.22-.21-.32-.32v6.62c.04 2.11-.7 4.31-2.22 5.75-1.63 1.62-4.06 2.25-6.27 1.81-2.57-.45-4.72-2.52-5.18-5.1-.64-3.13 1.25-6.52 4.37-7.22.8-.21 1.64-.22 2.45-.07V13.3c-1.3-.34-2.8-.1-3.83.74-.95.73-1.37 2-1.22 3.19.16 1.49 1.34 2.78 2.82 3.01 1.68.25 3.4-.64 3.95-2.23.18-.5.23-1.04.22-1.57V.02z" />
          </svg>
        );
      case 'instagram':
        return (
          <svg className="w-3.5 h-3.5 text-[#E1306C] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
        );
      case 'pinterest':
        return (
          <svg className="w-3.5 h-3.5 text-[#BD081C] shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.289 0C5.643 0 .02 4.619.02 11.326c0 5.155 3.111 9.534 7.6 11.343-.105-.961-.201-2.433.042-3.483.219-.947 1.411-5.98 1.411-5.98s-.36-.72-.36-1.782c0-1.67 1.01-2.914 2.246-2.914 1.058 0 1.569.794 1.569 1.751 0 1.064-.678 2.658-1.028 4.135-.292 1.233.621 2.24 1.84 2.24 2.203 0 3.896-2.321 3.896-5.674 0-2.969-2.136-5.048-5.185-5.048-3.528 0-5.602 2.646-5.602 5.385 0 1.066.41 2.211.922 2.83a.382.382 0 0 1 .088.363c-.097.404-.316 1.29-.358 1.467-.056.234-.187.283-.431.169-1.609-.749-2.616-3.101-2.616-4.992 0-4.067 2.955-7.802 8.52-7.802 4.475 0 7.95 3.189 7.95 7.447 0 4.444-2.8 8.018-6.685 8.018-1.306 0-2.533-.678-2.953-1.482l-.805 3.07a11.9 11.9 0 0 1-1.157 2.457c1.077.332 2.215.513 3.395.513 6.644 0 12.02-4.968 12.02-11.325C24.31 4.62 18.932 0 12.289 0z"/>
          </svg>
        );
      case 'facebook':
        return (
          <svg className="w-3.5 h-3.5 text-[#1877F2] shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        );
      default:
        return <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />;
    }
  };

  // Pretty bytes formatter for inline size labels.
  const formatBytes = (n: number | null | undefined): string => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '';
    const mb = n / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(n / 1024).toFixed(0)} KB`;
  };

  // Trigger a real download by formatId (resolves via signed token URL).
  const triggerDownload = (formatId: string, label: string) => {
    if (!analysis) {
      triggerToast('Analyze a link first.');
      return;
    }
    triggerToast(`Starting download: ${label}`);
    const href = buildDownloadUrl(analysis.token, formatId);
    const link = document.createElement('a');
    link.href = href;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Map backend platform id (incl. youtube) onto the frontend's existing Platform union.
  const mapBackendPlatform = (p: AnalyzeResponse['platform']): Platform => {
    switch (p) {
      case 'youtube': return 'tiktok';
      case 'tiktok': return 'tiktok';
      case 'tiktok_ad': return 'tiktok_ad';
      case 'instagram': return 'instagram';
      case 'facebook': return 'facebook';
      case 'pinterest': return 'pinterest';
      case 'meta_ad': return 'meta_ad';
      case 'twitter': return 'tiktok';
      case 'reddit': return 'instagram';
      default: return 'tiktok';
    }
  };

  // Adapt backend AnalyzeResponse into the popup's existing VideoPlatformInfo shape.
  const adaptForPopup = (a: AnalyzeResponse, sourceUrl: string): VideoPlatformInfo => {
    const platformId = mapBackendPlatform(a.platform);
    const supported = SUPPORTED_PLATFORMS.find(p => p.id === platformId) || SUPPORTED_PLATFORMS[0];
    const dur = a.duration && a.duration > 0
      ? `${Math.floor(a.duration / 60)}:${String(Math.round(a.duration % 60)).padStart(2, '0')}`
      : (a.contentType === 'video' ? '0:00' : 'Image');
    return {
      ...supported,
      id: platformId,
      name: supported.name,
      placeholderUrl: sourceUrl,
      bannerQuote: a.title || supported.bannerQuote,
      username: a.creator?.username || a.creator?.displayName || supported.username,
      videoSrc: a.previewUrl || '',
      imgUrl: a.thumbnail || supported.imgUrl,
      duration: dur,
      sizeGb: a.contentType === 'carousel' ? `${a.imageCount || 0} images` : (a.contentType === 'image' ? '1 image' : supported.sizeGb),
      viewsCount: a.creator?.displayName || supported.viewsCount,
    };
  };

  // Live analyze sequence: call backend, drive premium loading modal with smooth progress.
  const handleDownloadSequence = (urlToParse: string, _customMedia?: VideoPlatformInfo) => {
    const link = urlToParse.trim();
    if (!link) {
      triggerToast('Please paste a video link first!');
      return;
    }

    setDownloadStep('analyzing');
    setAnalysis(null);
    setAnalyzeProgress(0);
    setAnalyzeReady(false);
    setAnalyzeStage('Analyzing URL...');

    // Stage boundaries; ticker advances progress toward target.
    // Stays capped at 90% until backend resolves, then jumps to 100% + Ready.
    const stages: Array<{ label: string; cap: number }> = [
      { label: 'Analyzing URL...',       cap: 18 },
      { label: 'Detecting Platform...',  cap: 36 },
      { label: 'Fetching Metadata...',   cap: 64 },
      { label: 'Preparing Download...',  cap: 90 },
    ];

    let cur = 0;
    let stageIdx = 0;
    let resolved = false;
    setLoadingStepText(stages[0].label);

    const tick = window.setInterval(() => {
      const cap = resolved ? 100 : stages[stageIdx].cap;
      if (cur < cap) {
        const remaining = cap - cur;
        const step = Math.max(0.4, remaining * 0.08);
        cur = Math.min(cap, cur + step);
        setAnalyzeProgress(cur);
      } else if (!resolved && stageIdx < stages.length - 1) {
        stageIdx++;
        setAnalyzeStage(stages[stageIdx].label);
        setLoadingStepText(stages[stageIdx].label);
      }

      if (resolved && cur >= 100) {
        window.clearInterval(tick);
      }
    }, 60);

    analyzeUrl(link)
      .then((res) => {
        resolved = true;
        setAnalysis(res);
        const adapted = adaptForPopup(res, link);
        setActivePlatform(adapted.id);
        setPreviewVideo(adapted);
        setAnalyzeStage('Ready!');
        setLoadingStepText('Ready!');
        // Once ticker reaches 100, show check + open popup after 800ms.
        const settle = window.setInterval(() => {
          if (cur >= 100) {
            window.clearInterval(settle);
            setAnalyzeReady(true);
            window.setTimeout(() => {
              setDownloadStep('success');
              setIsPlaying(true);
              setIsMuted(true);
              triggerToast('Video successfully analyzed and unlocked!');
              // Reset loader state for next run.
              setAnalyzeProgress(0);
              setAnalyzeReady(false);
              setAnalyzeStage('Analyzing URL...');
            }, 800);
          }
        }, 50);
      })
      .catch((err: Error & { code?: string }) => {
        window.clearInterval(tick);
        setDownloadStep('idle');
        setAnalyzeProgress(0);
        setAnalyzeReady(false);
        setAnalyzeStage('Analyzing URL...');
        triggerToast(err.message || 'Analyze failed');
        // eslint-disable-next-line no-console
        console.error('[mtrx] analyze error', err);
      });
  };


  return (
    <div className={`min-h-screen bg-[#FAF9FF] text-slate-800 transition-colors duration-300 dark:bg-[#090710] dark:text-slate-100 flex flex-col selection:bg-purple-200 selection:text-purple-900`}>
      
      {/* BACKGROUND GRAPHIC BLOBS */}
      <div className="absolute top-[12%] left-0 w-[300px] md:w-[600px] h-[300px] md:h-[600px] rounded-full bg-indigo-200/20 dark:bg-indigo-950/10 blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[25%] right-0 w-[350px] md:w-[700px] h-[350px] md:h-[700px] rounded-full bg-purple-200/20 dark:bg-purple-950/10 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[10%] left-1/4 w-[300px] md:w-[600px] h-[300px] md:h-[600px] rounded-full bg-violet-200/10 dark:bg-violet-950/5 blur-[90px] pointer-events-none z-0" />

      {/* TOAST SYSTEM */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/90 dark:bg-violet-950/90 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-violet-800/20 border-t-violet-400/30 text-sm animate-bounce">
          <Sparkles className="w-4 h-4 text-purple-300 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}


      {/* HEADER NAVBAR */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between relative z-30">
        {/* Logo */}
        <div 
          onClick={() => {
            setDownloadStep('idle');
            setVideoLink('');
            triggerToast('Welcome back to the dashboard!');
          }} 
          className="flex items-center gap-2 cursor-pointer group"
          id="brand-logo"
        >
          <div className="relative w-10 h-10">
            <span className="absolute -inset-1 rounded-md bg-violet-500/25 blur-md animate-logo-glow pointer-events-none" />
            <img
              src="https://res.cloudinary.com/dp63sgdvp/image/upload/q_auto/f_auto/v1780157095/Logo_B_d4udlb.png"
              alt="MtrxSave"
              className="relative h-10 w-10 rounded-md object-contain transition-transform group-hover:scale-105 active:scale-95 select-none"
              draggable={false}
            />
          </div>
          <span className="font-sans font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
            Mtrx<span className="text-violet-600 dark:text-violet-400">Save</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <a href="#features" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Features</a>
          <a href="#how_it_works" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">How it works</a>
          <a href="#samples-carousel" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Supported Platforms</a>
          <a href="#pricing" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">FAQ</a>
        </nav>

        {/* Right Buttons Container */}
        <div className="flex items-center gap-4">
          {/* Sign In Button */}
          <button 
            onClick={() => triggerToast('Account access is pre-activated!')}
            className="hidden sm:inline-block text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-semibold text-sm transition-colors px-3 py-1.5 cursor-pointer"
            id="sign-in"
          >
            Sign in
          </button>

          {/* Premium Get Started Call to Action */}
          <a 
            href="#features"
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold px-5 py-2.5 rounded-full flex items-center gap-1.5 hover:scale-105 active:scale-95 shadow-md shadow-violet-500/15 transition-all text-sm cursor-pointer"
            id="get-started"
          >
            <Sparkle className="w-4 h-4 fill-white" />
            <span>Get Started</span>
          </a>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="flex-grow z-10 relative">
        {/* 1ST: TITLE HERO SECTION */}
        <section className="pt-10 pb-4 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto relative animate-fade-in">
          {/* Main Title Heading */}
          <h1 className="text-3xl sm:text-4xl md:text-[46px] font-extrabold tracking-tighter text-slate-950 dark:text-white max-w-5xl mx-auto leading-[1.1] md:leading-[1.12]">
            Download Meta Ads & Social Videos <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] via-[#A855F7] to-[#EC4899]">
              Hassle-Free.
            </span>
          </h1>
        </section>

        {/* 2ND: MAIN DOWNLOAD INPUT AREA (Prominent & High-Up) */}
        <section className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 pt-2 mb-8 animate-fade-in">
          
          {/* Main Glassmorphism Paste Area */}
          <div className="bg-white dark:bg-[#110E1C] border border-violet-100 dark:border-violet-950/40 rounded-3xl p-5 md:p-6 shadow-2xl relative">
            
            {/* Ambient inner soft purple shadow rim */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-violet-600/10 to-indigo-600/10 opacity-70 blur-xl pointer-events-none -z-10" />


            {/* Paste Form Area */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50 dark:bg-[#0D0A14] border border-slate-100 dark:border-violet-950/30 p-2 rounded-2xl">
              
              {/* Chain vector key */}
              <div className="flex items-center gap-2 pl-3">
                <LinkIcon className="text-violet-500 w-5 h-5 animate-pulse" />
              </div>

              {/* Paste Text Input */}
              <input
                type="text"
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && downloadStep !== 'analyzing') {
                    e.preventDefault();
                    handleDownloadSequence(videoLink);
                  }
                }}
                placeholder="Paste your video link here..."
                className="flex-grow bg-transparent border-none text-slate-800 dark:text-slate-100 text-sm md:text-base outline-none placeholder:text-slate-400 py-3 block"
              />

              {/* Decorator Dot Indicator from Image */}
              <div className="hidden md:flex items-center gap-1.5 px-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce delay-100" />
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse delay-200" />
              </div>

              {/* Download CTA Button */}
              <button 
                onClick={() => handleDownloadSequence(videoLink)}
                disabled={downloadStep === 'analyzing'}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold px-6 py-3.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-80 disabled:cursor-not-allowed text-sm whitespace-nowrap"
              >
                {downloadStep === 'analyzing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>

            {/* INLINE DOWNLOAD OPTIONS (post-analyze) */}
            {downloadStep === 'success' && analysis && (
              <div className="mt-4 animate-mtrx-fade">
                {analysis.contentType === 'video' ? (
                  <div className="space-y-3">
                    {/* VIDEO PREVIEW CARD — hidden for TikTok Ad Library (no usable thumbnail) */}
                    {analysis.platform !== 'tiktok_ad' && (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-violet-950/40 bg-slate-100 dark:bg-purple-950/20 animate-mtrx-rise">
                      <div className="relative aspect-video bg-black">
                        {analysis.thumbnail ? (
                          <img
                            src={buildThumbnailUrl(analysis.token)}
                            alt={analysis.title}
                            loading="lazy"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10 pointer-events-none" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="w-14 h-14 rounded-full bg-white/20 border border-white/40 backdrop-blur flex items-center justify-center shadow-lg">
                            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                          </span>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2 pointer-events-none">
                          <div className="min-w-0">
                            <h4 className="text-white text-sm font-semibold truncate">{analysis.title}</h4>
                            {analysis.creator?.username && (
                              <p className="text-white/80 text-[11px] font-mono truncate">@{analysis.creator.username}</p>
                            )}
                          </div>
                          {typeof analysis.duration === 'number' && analysis.duration > 0 && (
                            <span className="text-[10px] font-mono font-bold text-white bg-black/65 px-1.5 py-0.5 rounded backdrop-blur shrink-0">
                              {`${Math.floor(analysis.duration / 60)}:${String(Math.round(analysis.duration % 60)).padStart(2, '0')}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    )}

                    {/* VIDEO / AUDIO ROWS */}
                    <div className="flex flex-col sm:flex-row gap-2.5">
                    {analysis.formats.filter(f => f.kind === 'video' || f.kind === 'audio').map((f, i) => {
                      const isVideo = f.kind === 'video';
                      const isAudio = f.kind === 'audio';
                      const accent = isVideo
                        ? 'from-[#3a78b8] to-[#2c5d96] hover:from-[#4a8ec8] hover:to-[#356da6]'
                        : 'from-[#7fa658] to-[#5d8643] hover:from-[#8fbb63] hover:to-[#6c9a4f]';
                      const ext = isVideo ? 'MP4' : 'MP3';
                      const sizeText = formatBytes((f as { size?: number | null }).size ?? null);
                      const buttonLabel = isVideo ? 'Download Video' : 'Download Audio';
                      return (
                        <button
                          key={f.id}
                          onClick={() => triggerDownload(f.id, buttonLabel)}
                          style={{ animationDelay: `${i * 120}ms` }}
                          className={`flex-1 bg-gradient-to-r ${accent} text-white font-semibold px-4 py-3 rounded-2xl flex items-center justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-violet-500/10 cursor-pointer animate-mtrx-rise`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                              {isAudio ? (
                                <AudioLines className="w-4 h-4 text-white" />
                              ) : (
                                <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                              )}
                            </span>
                            <span className="text-sm truncate">{buttonLabel}</span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
                            {sizeText && <span className="bg-white/15 px-1.5 py-0.5 rounded">{sizeText}</span>}
                            <span className="opacity-80">{ext}</span>
                          </span>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                ) : (
                  /* IMAGE / CAROUSEL GALLERY */
                  (() => {
                    const imgs = analysis.formats.filter(f => f.kind === 'image') as Array<Extract<BackendFormat, { kind: 'image' }>>;
                    const zip = analysis.formats.find(f => f.kind === 'zip') as Extract<BackendFormat, { kind: 'zip' }> | undefined;
                    return (
                      <div className="space-y-3">
                        {zip && (
                          <button
                            onClick={() => triggerDownload(zip.id, zip.label)}
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold px-4 py-3 rounded-2xl flex items-center justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md cursor-pointer animate-mtrx-rise"
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                                <Download className="w-4 h-4 text-white" />
                              </span>
                              <span className="text-sm">Download All as ZIP</span>
                            </span>
                            <span className="text-[11px] font-mono opacity-90 bg-white/15 px-1.5 py-0.5 rounded">{imgs.length} files</span>
                          </button>
                        )}
                        <div className={`grid gap-3 ${imgs.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
                          {imgs.map((img, i) => {
                            const sizeText = formatBytes(img.size ?? null);
                            return (
                              <div
                                key={img.id}
                                style={{ animationDelay: `${i * 100}ms` }}
                                className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-violet-950/40 bg-slate-100 dark:bg-purple-950/20 aspect-square animate-mtrx-rise"
                              >
                                <img
                                  src={buildPreviewUrl(analysis.token, img.id)}
                                  alt={img.label}
                                  loading="lazy"
                                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                                <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono pointer-events-none">
                                  <span className="bg-black/65 text-white px-1.5 py-0.5 rounded backdrop-blur">{img.label}</span>
                                  {sizeText && <span className="bg-black/65 text-white px-1.5 py-0.5 rounded backdrop-blur">{sizeText}</span>}
                                </div>
                                <button
                                  onClick={() => triggerDownload(img.id, img.label)}
                                  className="absolute bottom-2 left-2 right-2 bg-white/95 hover:bg-white text-slate-900 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur"
                                  title={`Download ${img.label}`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                  <span className="text-[10px] font-mono text-slate-500 ml-1">{(img.container || 'JPG').toUpperCase()}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

          </div>
        </section>

        {/* 3RD: COMPACT EXAMPLES CAROUSEL — replaced by inline loader during analysis */}
        <section id="samples-carousel" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 mb-10 overflow-visible z-10 text-center">
          {downloadStep === 'success' && (
            <div className="pointer-events-none absolute -top-6 inset-x-0 h-24 bg-gradient-to-b from-black/55 via-black/25 to-transparent z-20 animate-mtrx-fade" />
          )}

          {downloadStep === 'analyzing' ? (() => {
            const R = 52;
            const C = 2 * Math.PI * R;
            const pct = Math.max(0, Math.min(100, analyzeProgress));
            const offset = C * (1 - pct / 100);
            return (
              <div className="flex items-center justify-center animate-mtrx-fade">
                <div className="relative w-full max-w-[12rem] animate-mtrx-rise">
                  <div className="absolute -inset-3 rounded-2xl bg-gradient-to-tr from-violet-600/20 via-fuchsia-500/10 to-indigo-600/20 blur-xl pointer-events-none" />
                  <div className="relative rounded-2xl bg-white/95 dark:bg-[#0E0A1A]/95 border border-violet-200/40 dark:border-violet-900/40 shadow-2xl p-4 text-center">
                    <div className="relative mx-auto w-16 h-16 mb-3">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <defs>
                          <linearGradient id="mtrx-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#6366f1" />
                          </linearGradient>
                        </defs>
                        <circle cx="60" cy="60" r={R} stroke="currentColor" strokeWidth="8" fill="none" className="text-slate-200 dark:text-violet-950/60" />
                        <circle
                          cx="60"
                          cy="60"
                          r={R}
                          stroke="url(#mtrx-ring)"
                          strokeWidth="8"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={C}
                          strokeDashoffset={offset}
                          style={{ transition: 'stroke-dashoffset 120ms linear' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {analyzeReady ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/30 animate-mtrx-scale">
                            <Check className="w-4 h-4 text-white stroke-[3.5]" />
                          </div>
                        ) : (
                          <>
                            <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">{Math.round(pct)}</span>
                            <span className="text-[7px] font-bold text-slate-400 tracking-widest mt-0.5">PERCENT</span>
                          </>
                        )}
                      </div>
                    </div>
                    <h4 className="text-[11px] font-bold text-slate-900 dark:text-white tracking-tight">
                      {analyzeReady ? 'Video Ready' : analyzeStage}
                    </h4>
                    <p className="text-[8px] text-slate-400 mt-0.5 font-mono uppercase tracking-widest">
                      {analyzeReady ? 'Opening download…' : 'Please wait'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })() : (
          <>
          {/* Cards Flex Container (Compact dimensions for high-fold visibility) */}
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="flex md:grid md:grid-cols-6 gap-3 sm:gap-4 pb-4 overflow-x-auto snap-x md:overflow-visible scrollbar-none scroll-smooth animate-fade-in max-w-5xl mx-auto"
          >

            {SUPPORTED_PLATFORMS.map((card, idx) => {
              // Rotation values to replicate the arched 3D wave but tighter and smaller
              const rotationClasses = [
                'md:rotate-[-2deg] md:translate-y-2',
                'md:rotate-[-1deg] md:translate-y-0.5',
                'md:rotate-[0deg] md:-translate-y-1',
                'md:rotate-[1deg] md:-translate-y-1.5',
                'md:rotate-[0deg] md:translate-y-0',
                'md:rotate-[2deg] md:translate-y-1.5',
              ];

              return (
                <div
                  key={card.id}
                  ref={(el) => { cardRefs.current[card.id] = el; }}
                  className={`min-w-[125px] w-[130px] md:w-auto snap-center flex-shrink-0 transition-transform duration-300 hover:scale-[1.05] hover:z-20 md:hover:rotate-0 hover:-translate-y-2 ${rotationClasses[idx]}`}
                >
                  {/* Inside Device Bezel Content */}
                  <div className="relative rounded-xl overflow-hidden shadow-lg border border-slate-200/50 dark:border-violet-950/40 bg-slate-100 dark:bg-purple-950/20 aspect-[9/16] group/item">
                    {/* CDN Stock Image */}
                    <img
                      src={card.imgUrl}
                      alt={card.name}
                      className="absolute inset-0 w-full h-full object-cover select-none group-hover/item:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />

                    {/* Platform Marker at the Top */}
                    <div className="absolute top-2 left-2 right-2 flex items-center z-10">
                      <div className="bg-white text-slate-900 border border-slate-200/60 shadow-md px-2 py-1 rounded font-black tracking-wider uppercase flex items-center gap-1.5 max-w-[82%] text-[9px]">
                        {getPlatformLogo(card.id)}
                        <span className="truncate leading-none">{card.id.toUpperCase().replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>

          {/* MOBILE HELPER INDICATOR */}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 block md:hidden">
            Swipe left/right to browse sample social videos ✦
          </p>
          </>
          )}
        </section>

        {/* 4TH: NARRATIVE DESCRIPTION AND FEATURES CHECKLIST */}
        <section className="pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto relative">
          
          {/* Short Narrative Sub-Header */}
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base md:text-[17px] leading-relaxed">
            Download videos from <span className="font-semibold text-slate-700 dark:text-slate-200">TikTok</span>, <span className="font-semibold text-slate-700 dark:text-slate-200">Instagram</span>, <span className="font-semibold text-slate-700 dark:text-slate-200">Facebook</span>, <span className="font-semibold text-slate-700 dark:text-slate-200">Pinterest</span>, <span className="font-semibold text-slate-700 dark:text-slate-200">Meta Ad Library</span>, <span className="font-semibold text-slate-700 dark:text-slate-200">TikTok Ad Library</span> & more. Unlimited downloads, one simple tool.
          </p>

          {/* Features Checklist Badges */}
          <div className="flex flex-wrap justify-center items-center gap-3 mt-6">
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100/60 dark:bg-purple-950/10 border border-slate-200/30 dark:border-violet-900/20 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Zap className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 fill-violet-600/10" />
              <span>Fast & Easy</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100/60 dark:bg-purple-950/10 border border-slate-200/30 dark:border-violet-900/20 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 fill-violet-600/10" />
              <span>HD Quality</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100/60 dark:bg-purple-950/10 border border-slate-200/30 dark:border-violet-900/20 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
              <UserCheck className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 fill-violet-600/10" />
              <span>Secure & Private</span>
            </div>
          </div>
        </section>

        {/* STEP-BY-STEP WORKFLOW SCHEME */}
        <section className="py-16 bg-slate-100/50 dark:bg-[#0C0A15]/65 border-y border-slate-200/30 dark:border-violet-950/20" id="how_it_works">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-sm font-bold tracking-widest text-violet-600 dark:text-violet-400 uppercase text-center mb-2">
              Three Step Extraction
            </h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight text-center mb-12">
              How MtrxSave Works
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="text-center md:text-left bg-white dark:bg-[#110E1C] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-violet-950/10">
                <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 font-extrabold text-lg flex items-center justify-center mb-4 mx-auto md:mx-0 shadow-inner">
                  1
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Copy Video Link</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Go to your social application or creative center, find the reel, video, or ad, and click "Copy Link" from the dialog drawer.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center md:text-left bg-white dark:bg-[#110E1C] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-violet-950/10">
                <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 font-extrabold text-lg flex items-center justify-center mb-4 mx-auto md:mx-0 shadow-inner">
                  2
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Paste and Analyze</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Insert the URL in the downloader input bar above. MtrxSave system scripts query direct file source variables instantly.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center md:text-left bg-white dark:bg-[#110E1C] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-violet-950/10">
                <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 font-extrabold text-lg flex items-center justify-center mb-4 mx-auto md:mx-0 shadow-inner">
                  3
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Download Media</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Choose your preferred file resolution and download. Files save straight onto your local device memory safely.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID SECTION */}
        <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6" id="features">
          <h2 className="text-sm font-bold tracking-widest text-violet-600 dark:text-violet-400 uppercase text-center mb-2">
            Engine Capabilities
          </h2>
          <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight text-center mb-12">
            Why Select MtrxSave?
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, idx) => (
              <div 
                key={idx}
                className="bg-white dark:bg-[#110E1C] p-6 rounded-2xl shadow-sm border border-slate-200/20 dark:border-violet-950/10 hover:shadow-md transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-100/60 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4 shrink-0">
                  {feature.icon === 'Zap' && <Zap className="w-5 h-5" />}
                  {feature.icon === 'ShieldCheck' && <ShieldCheck className="w-5 h-5" />}
                  {feature.icon === 'Tv' && <Tv className="w-5 h-5" />}
                  {feature.icon === 'Smartphone' && <Smartphone className="w-5 h-5" />}
                  {feature.icon === 'UserCheck' && <UserCheck className="w-5 h-5" />}
                  {feature.icon === 'Sparkles' && <Sparkles className="w-5 h-5" />}
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING PLANS COMPONENT */}
        <section className="py-16 bg-slate-100/40 dark:bg-[#0C0A15]/45 border-t border-slate-200/20 dark:border-violet-950/10" id="pricing">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-sm font-bold tracking-widest text-violet-600 dark:text-violet-400 uppercase mb-2">
              Simple Pricing
            </h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              100% Free Forever
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-10">
              Enjoy unlimited file downloads, instant connection handshakes, and absolute HD quality at zero cost. Supported by creators.
            </p>

            <div className="bg-white dark:bg-[#110E1C] border border-violet-100 dark:border-violet-950/30 rounded-3xl p-8 max-w-md mx-auto shadow-xl relative overflow-hidden">
              {/* Corner ribbon */}
              <div className="absolute top-0 right-0 bg-violet-600 text-white text-[10px] font-extrabold tracking-widest uppercase py-1.5 px-8 transform rotate-45 translate-x-3 translate-y-3 shadow">
                ACTIVE
              </div>

              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Unlimited Creator</h4>
              <div className="flex items-baseline justify-center gap-1.5 my-4">
                <span className="text-5xl font-extrabold text-slate-900 dark:text-white">$0</span>
                <span className="text-slate-400 dark:text-slate-500 text-sm font-semibold">/ lifetime</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 font-medium">Free for marketing specialists, designers, and creators.</p>

              <div className="space-y-3.5 mb-8 text-left max-w-[280px] mx-auto text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Unlimited standard & HD video saves</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Meta & TikTok Ad Library integration</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Stereo MP3 audio file extractor</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Cross-device compatibility</span>
                </div>
              </div>

              <button 
                onClick={() => triggerToast('Your free lifetime membership is pre-active!')}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-3 px-5 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-md shadow-violet-500/10 cursor-pointer"
              >
                Access Dashboard
              </button>
            </div>
          </div>
        </section>

        {/* ACCORDION FAQS SECTION */}
        <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6" id="faq">
          <h2 className="text-sm font-bold tracking-widest text-violet-600 dark:text-violet-400 uppercase text-center mb-2">
            Got Questions?
          </h2>
          <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight text-center mb-12">
            Frequently Answered Questions
          </h3>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-white dark:bg-[#110E1C] border border-slate-200/50 dark:border-violet-950/30 rounded-2xl overflow-hidden transition-all text-left"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-slate-800 dark:text-white font-bold text-sm sm:text-base cursor-pointer hover:bg-slate-50 dark:hover:bg-purple-950/10 text-left"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`w-4 h-4 text-violet-500 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
                  </button>

                  <div className={`transition-all duration-300 ${isOpen ? 'max-h-[300px] border-t border-slate-100 dark:border-violet-950/20' : 'max-h-0'}`}>
                    <div className="p-5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900 z-10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600">
            <p>© {new Date().getFullYear()} MtrxSave. All rights reserved.</p>
            <div className="flex gap-4 mt-4 sm:mt-0">
              <a onClick={() => triggerToast('Privacy parameters active!')} className="hover:text-slate-400 cursor-pointer">Privacy Policy</a>
              <a onClick={() => triggerToast('Terms of use verified!')} className="hover:text-slate-400 cursor-pointer">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

