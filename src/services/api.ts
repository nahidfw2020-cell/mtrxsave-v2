/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BackendPlatform =
  | 'youtube'
  | 'tiktok'
  | 'tiktok_ad'
  | 'instagram'
  | 'facebook'
  | 'pinterest'
  | 'meta_ad'
  | 'twitter'
  | 'reddit';

export type BackendContentType = 'video' | 'image' | 'carousel';

export type BackendFormat =
  | { id: string; kind: 'video'; container: 'mp4'; label: string; height: number | null; hasAudio: true }
  | { id: string; kind: 'audio'; container: 'mp3'; label: string; bitrate: number }
  | { id: string; kind: 'image'; container: string; label: string; width: number | null; height: number | null; size?: number | null; index: number; directUrl: string }
  | { id: string; kind: 'zip'; container: 'zip'; label: string; count: number };

export interface AnalyzeResponse {
  token: string;
  platform: BackendPlatform;
  contentType: BackendContentType;
  title: string;
  creator: { username: string; displayName?: string; avatar?: string };
  thumbnail: string;
  duration?: number | null;
  imageCount?: number;
  sourceUrl: string;
  previewUrl?: string | null;
  formats: BackendFormat[];
}

const API_BASE = ((import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE) || '';

async function jsonFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const message = err?.message || `Request failed (${res.status})`;
    const e = new Error(message) as Error & { code?: string; status?: number };
    e.code = err?.code;
    e.status = res.status;
    throw e;
  }
  return body as T;
}

export function analyzeUrl(url: string): Promise<AnalyzeResponse> {
  return jsonFetch<AnalyzeResponse>('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function buildDownloadUrl(token: string, formatId: string): string {
  const params = new URLSearchParams({ token, formatId });
  return `${API_BASE}/api/download?${params.toString()}`;
}

export function buildPreviewUrl(token: string, formatId: string): string {
  const params = new URLSearchParams({ token, formatId, inline: '1' });
  return `${API_BASE}/api/download?${params.toString()}`;
}

export function buildThumbnailUrl(token: string): string {
  const params = new URLSearchParams({ token, formatId: 'thumbnail', inline: '1' });
  return `${API_BASE}/api/download?${params.toString()}`;
}
