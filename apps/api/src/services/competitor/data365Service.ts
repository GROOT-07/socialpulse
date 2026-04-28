/**
 * Competitor data service
 *
 * Currently returns empty stubs when no provider API key is configured.
 * To enable real data, set one of:
 *   DATA365_API_KEY   — data365.co (enterprise, requires sales process)
 *   RAPIDAPI_KEY      — rapidapi.com (instant signup, pay-per-use)
 *
 * The service interface is stable — swap the implementation without touching
 * any callers (competitorSyncService, competitor.controller).
 *
 * NEVER called directly from user requests — only from BullMQ workers.
 */

import { cacheGet, cacheSet } from '../../lib/redis'

const CACHE_TTL = 3600 // 1 hour

// ── Shared types ─────────────────────────────────────────────

export interface Data365Profile {
  id: string
  handle: string
  name: string
  bio: string
  followers: number
  following: number
  postsCount: number
  profilePicUrl: string
  isVerified: boolean
  platform: 'instagram' | 'facebook' | 'youtube'
}

export interface Data365Post {
  id: string
  handle: string
  url: string
  thumbnailUrl: string
  text: string
  publishedAt: string
  likesCount: number
  commentsCount: number
  sharesCount: number
  viewsCount: number
  engagementRate: number
  type: string
}

// ── Provider detection ────────────────────────────────────────

function getProvider(): 'data365' | 'rapidapi' | 'none' {
  if (process.env['DATA365_API_KEY']) return 'data365'
  if (process.env['RAPIDAPI_KEY']) return 'rapidapi'
  return 'none'
}

function warnNoProvider(handle: string): void {
  console.warn(
    `[competitor] No API provider configured — skipping sync for @${handle}. ` +
    'Set DATA365_API_KEY or RAPIDAPI_KEY in .env to enable competitor data.',
  )
}

// ── Empty stub ────────────────────────────────────────────────

function emptyProfile(handle: string, platform: Data365Profile['platform']): Data365Profile {
  return {
    id: handle,
    handle,
    name: handle,
    bio: '',
    followers: 0,
    following: 0,
    postsCount: 0,
    profilePicUrl: '',
    isVerified: false,
    platform,
  }
}

// ── Data365 implementation ────────────────────────────────────

const DATA365_BASE = 'https://api.data365.co/v1.1'

async function d365Get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env['DATA365_API_KEY']!
  const url = new URL(`${DATA365_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  url.searchParams.set('access_token', apiKey)

  const res = await fetch(url.toString())
  const json = await res.json() as { error?: string; message?: string } & T
  if (!res.ok) throw new Error(`Data365 error: ${json.error ?? json.message ?? res.statusText}`)
  return json
}

async function d365InstagramProfile(handle: string): Promise<Data365Profile> {
  const raw = await d365Get<{ data: { id: string; username: string; full_name: string; biography: string; followers_count: number; following_count: number; posts_count: number; profile_pic_url: string; is_verified: boolean } }>(`/instagram/profile/${handle}/update`)
  return { id: raw.data.id, handle: raw.data.username, name: raw.data.full_name, bio: raw.data.biography, followers: raw.data.followers_count, following: raw.data.following_count, postsCount: raw.data.posts_count, profilePicUrl: raw.data.profile_pic_url, isVerified: raw.data.is_verified, platform: 'instagram' }
}

async function d365InstagramPosts(handle: string, limit: number): Promise<Data365Post[]> {
  const raw = await d365Get<{ data: { items: Array<{ id: string; shortcode: string; display_url: string; edge_media_to_caption?: { edges: Array<{ node: { text: string } }> }; taken_at_timestamp: number; edge_liked_by?: { count: number }; edge_media_to_comment?: { count: number }; video_view_count?: number; typename: string }> } }>(`/instagram/profile/${handle}/posts/update`, { count: String(limit) })
  return (raw.data.items ?? []).map((item) => {
    const likes = item.edge_liked_by?.count ?? 0
    const comments = item.edge_media_to_comment?.count ?? 0
    const views = item.video_view_count ?? 0
    return { id: item.id, handle, url: `https://www.instagram.com/p/${item.shortcode}/`, thumbnailUrl: item.display_url, text: item.edge_media_to_caption?.edges[0]?.node.text ?? '', publishedAt: new Date(item.taken_at_timestamp * 1000).toISOString(), likesCount: likes, commentsCount: comments, sharesCount: 0, viewsCount: views, engagementRate: views > 0 ? Math.round(((likes + comments) / views) * 10000) / 100 : 0, type: item.typename }
  })
}

async function d365FacebookProfile(handle: string): Promise<Data365Profile> {
  const raw = await d365Get<{ data: { id: string; username: string; name: string; about: string; fan_count: number; posts_count: number; picture: string; verification_status: string } }>(`/facebook/page/${handle}/update`)
  return { id: raw.data.id, handle: raw.data.username ?? handle, name: raw.data.name, bio: raw.data.about ?? '', followers: raw.data.fan_count, following: 0, postsCount: raw.data.posts_count, profilePicUrl: raw.data.picture, isVerified: raw.data.verification_status === 'verified', platform: 'facebook' }
}

async function d365FacebookPosts(handle: string, limit: number): Promise<Data365Post[]> {
  const raw = await d365Get<{ data: { items: Array<{ id: string; permalink_url: string; full_picture?: string; message?: string; created_time: string; likes: number; comments: number; shares: number }> } }>(`/facebook/page/${handle}/posts/update`, { count: String(limit) })
  return (raw.data.items ?? []).map((item) => ({ id: item.id, handle, url: item.permalink_url, thumbnailUrl: item.full_picture ?? '', text: item.message ?? '', publishedAt: item.created_time, likesCount: item.likes ?? 0, commentsCount: item.comments ?? 0, sharesCount: item.shares ?? 0, viewsCount: 0, engagementRate: 0, type: 'post' }))
}

async function d365YouTubeProfile(channelId: string): Promise<Data365Profile> {
  const raw = await d365Get<{ data: { id: string; title: string; description: string; subscriber_count: number; video_count: number; thumbnail_url: string; custom_url: string } }>(`/youtube/channel/${channelId}/update`)
  return { id: raw.data.id, handle: raw.data.custom_url ?? channelId, name: raw.data.title, bio: raw.data.description, followers: raw.data.subscriber_count, following: 0, postsCount: raw.data.video_count, profilePicUrl: raw.data.thumbnail_url, isVerified: false, platform: 'youtube' }
}

async function d365YouTubePosts(channelId: string, limit: number): Promise<Data365Post[]> {
  const raw = await d365Get<{ data: { items: Array<{ id: string; title: string; published_at: string; view_count: number; like_count: number; comment_count: number; thumbnail_url: string; url: string }> } }>(`/youtube/channel/${channelId}/videos/update`, { count: String(limit) })
  return (raw.data.items ?? []).map((item) => ({ id: item.id, handle: channelId, url: item.url, thumbnailUrl: item.thumbnail_url, text: item.title, publishedAt: item.published_at, likesCount: item.like_count, commentsCount: item.comment_count, sharesCount: 0, viewsCount: item.view_count, engagementRate: item.view_count > 0 ? Math.round(((item.like_count + item.comment_count) / item.view_count) * 10000) / 100 : 0, type: 'video' }))
}

// ── Public API (router) ───────────────────────────────────────

async function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached) return cached
  const result = await fn()
  await cacheSet(key, result, CACHE_TTL)
  return result
}

export async function getInstagramCompetitorProfile(handle: string): Promise<Data365Profile> {
  const provider = getProvider()
  if (provider === 'none') { warnNoProvider(handle); return emptyProfile(handle, 'instagram') }
  return withCache(`competitor:ig:profile:${handle}`, () => d365InstagramProfile(handle))
}

export async function getInstagramCompetitorPosts(handle: string, limit = 20): Promise<Data365Post[]> {
  const provider = getProvider()
  if (provider === 'none') { warnNoProvider(handle); return [] }
  return withCache(`competitor:ig:posts:${handle}:${limit}`, () => d365InstagramPosts(handle, limit))
}

export async function getFacebookCompetitorProfile(handle: string): Promise<Data365Profile> {
  const provider = getProvider()
  if (provider === 'none') { warnNoProvider(handle); return emptyProfile(handle, 'facebook') }
  return withCache(`competitor:fb:profile:${handle}`, () => d365FacebookProfile(handle))
}

export async function getFacebookCompetitorPosts(handle: string, limit = 20): Promise<Data365Post[]> {
  const provider = getProvider()
  if (provider === 'none') { warnNoProvider(handle); return [] }
  return withCache(`competitor:fb:posts:${handle}:${limit}`, () => d365FacebookPosts(handle, limit))
}

export async function getYouTubeCompetitorProfile(channelId: string): Promise<Data365Profile> {
  const provider = getProvider()
  if (provider === 'none') { warnNoProvider(channelId); return emptyProfile(channelId, 'youtube') }
  return withCache(`competitor:yt:profile:${channelId}`, () => d365YouTubeProfile(channelId))
}

export async function getYouTubeCompetitorPosts(channelId: string, limit = 20): Promise<Data365Post[]> {
  const provider = getProvider()
  if (provider === 'none') { warnNoProvider(channelId); return [] }
  return withCache(`competitor:yt:posts:${channelId}:${limit}`, () => d365YouTubePosts(channelId, limit))
}
