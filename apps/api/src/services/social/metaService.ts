/**
 * Meta Graph API v22 service
 * Handles Instagram + Facebook data fetching.
 * NEVER called directly from user requests — only from BullMQ jobs.
 */

import { cacheGet, cacheSet } from '../../lib/redis'

const GRAPH_BASE = 'https://graph.facebook.com/v22.0'
const CACHE_TTL = 3600 // 1 hour

// ── Types ─────────────────────────────────────────────────────

export interface InstagramProfile {
  id: string
  username: string
  name: string
  biography: string
  followers_count: number
  follows_count: number
  media_count: number
  profile_picture_url: string
  website: string
}

export interface InstagramInsights {
  follower_count: number
  reach: number
  impressions: number
  profile_views: number
  date: string
}

export interface InstagramMedia {
  id: string
  caption: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url: string
  thumbnail_url: string
  permalink: string
  timestamp: string
  like_count: number
  comments_count: number
}

export interface FacebookPageInsights {
  page_fans: number
  page_fan_adds: number
  page_fan_removes: number
  page_impressions: number
  page_reach: number
  page_engaged_users: number
  page_post_engagements: number
  date: string
}

export interface FacebookPost {
  id: string
  message: string
  created_time: string
  likes: { summary: { total_count: number } }
  comments: { summary: { total_count: number } }
  shares: { count: number }
  reach: number
}

// ── Helpers ───────────────────────────────────────────────────

async function graphGet<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`)
  url.searchParams.set('access_token', accessToken)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString())
  const json = await res.json() as { error?: { message: string; code: number }; data?: unknown } & T

  if (!res.ok || json.error) {
    throw new Error(`Meta API error: ${json.error?.message ?? res.statusText} (${json.error?.code ?? res.status})`)
  }

  return json
}

// ── Instagram ─────────────────────────────────────────────────

export async function getInstagramProfile(igUserId: string, accessToken: string): Promise<InstagramProfile> {
  const cacheKey = `ig:profile:${igUserId}`
  const cached = await cacheGet<InstagramProfile>(cacheKey)
  if (cached) return cached

  const data = await graphGet<InstagramProfile>(`/${igUserId}`, accessToken, {
    fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website',
  })

  await cacheSet(cacheKey, data, CACHE_TTL)
  return data
}

export async function getInstagramInsights(igUserId: string, accessToken: string, period = 'day'): Promise<InstagramInsights[]> {
  const cacheKey = `ig:insights:${igUserId}:${period}`
  const cached = await cacheGet<InstagramInsights[]>(cacheKey)
  if (cached) return cached

  const data = await graphGet<{ data: Array<{ name: string; values: Array<{ value: number; end_time: string }> }> }>(
    `/${igUserId}/insights`,
    accessToken,
    {
      metric: 'follower_count,reach,impressions,profile_views',
      period,
    },
  )

  // Pivot metric arrays into date-keyed objects
  const byDate: Record<string, Partial<InstagramInsights>> = {}
  for (const metric of data.data) {
    for (const point of metric.values) {
      const date = point.end_time.split('T')[0] ?? point.end_time
      if (!byDate[date]) byDate[date] = { date }
      ;(byDate[date] as Record<string, unknown>)[metric.name] = point.value
    }
  }

  const result = Object.values(byDate) as InstagramInsights[]
  await cacheSet(cacheKey, result, CACHE_TTL)
  return result
}

export async function getInstagramMedia(igUserId: string, accessToken: string, limit = 30): Promise<InstagramMedia[]> {
  const cacheKey = `ig:media:${igUserId}:${limit}`
  const cached = await cacheGet<InstagramMedia[]>(cacheKey)
  if (cached) return cached

  const data = await graphGet<{ data: InstagramMedia[] }>(`/${igUserId}/media`, accessToken, {
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: String(limit),
  })

  await cacheSet(cacheKey, data.data, CACHE_TTL)
  return data.data
}

// ── Facebook ──────────────────────────────────────────────────

export async function getFacebookPageInsights(pageId: string, accessToken: string): Promise<FacebookPageInsights[]> {
  const cacheKey = `fb:insights:${pageId}`
  const cached = await cacheGet<FacebookPageInsights[]>(cacheKey)
  if (cached) return cached

  const data = await graphGet<{ data: Array<{ name: string; values: Array<{ value: number; end_time: string }> }> }>(
    `/${pageId}/insights`,
    accessToken,
    {
      metric: 'page_fans,page_fan_adds,page_fan_removes,page_impressions,page_reach,page_engaged_users,page_post_engagements',
      period: 'day',
    },
  )

  const byDate: Record<string, Partial<FacebookPageInsights>> = {}
  for (const metric of data.data) {
    for (const point of metric.values) {
      const date = point.end_time.split('T')[0] ?? point.end_time
      if (!byDate[date]) byDate[date] = { date }
      ;(byDate[date] as Record<string, unknown>)[metric.name] = point.value
    }
  }

  const result = Object.values(byDate) as FacebookPageInsights[]
  await cacheSet(cacheKey, result, CACHE_TTL)
  return result
}

export async function getFacebookPosts(pageId: string, accessToken: string, limit = 20): Promise<FacebookPost[]> {
  const cacheKey = `fb:posts:${pageId}:${limit}`
  const cached = await cacheGet<FacebookPost[]>(cacheKey)
  if (cached) return cached

  const data = await graphGet<{ data: FacebookPost[] }>(`/${pageId}/posts`, accessToken, {
    fields: 'id,message,created_time,likes.summary(true),comments.summary(true),shares',
    limit: String(limit),
  })

  await cacheSet(cacheKey, data.data, CACHE_TTL)
  return data.data
}

// ── Long-lived token exchange ─────────────────────────────────

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ access_token: string; expires_in: number }> {
  const appId = process.env.META_APP_ID!
  const appSecret = process.env.META_APP_SECRET!

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('fb_exchange_token', shortLivedToken)

  const res = await fetch(url.toString())
  const json = await res.json() as { access_token: string; expires_in: number; error?: { message: string } }

  if (!res.ok || json.error) {
    throw new Error(`Token exchange failed: ${json.error?.message ?? res.statusText}`)
  }

  return json
}
