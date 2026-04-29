/**
 * YouTube Data API v3 service
 * Handles YouTube channel + video data fetching.
 * NEVER called directly from user requests — only from BullMQ jobs.
 */

import { cacheGet, cacheSet } from '../../lib/redis'

const YT_BASE = 'https://www.googleapis.com/youtube/v3'
const CACHE_TTL = 3600 // 1 hour

// ── Types ─────────────────────────────────────────────────────

export interface YouTubeChannel {
  id: string
  title: string
  description: string
  customUrl: string
  thumbnailUrl: string
  country: string
  subscriberCount: number
  videoCount: number
  viewCount: number
  publishedAt: string
}

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  publishedAt: string
  viewCount: number
  likeCount: number
  commentCount: number
  duration: string
  channelId: string
}

export interface YouTubeChannelInsights {
  date: string
  views: number
  estimatedMinutesWatched: number
  averageViewDuration: number
  subscribersGained: number
  subscribersLost: number
  likes: number
  comments: number
  shares: number
  annotationClickThroughRate: number
}

export interface YouTubeTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

// ── Helpers ───────────────────────────────────────────────────

async function ytGet<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const url = new URL(`${YT_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString())
  const json = await res.json() as { error?: { message: string; code: number } } & T

  if (!res.ok || json.error) {
    throw new Error(
      `YouTube API error: ${json.error?.message ?? res.statusText} (${json.error?.code ?? res.status})`,
    )
  }

  return json
}

// ── Channel ───────────────────────────────────────────────────

export async function getYouTubeChannel(
  accessToken: string,
  channelId?: string,
): Promise<YouTubeChannel> {
  const idParam = channelId ?? 'mine'
  const cacheKey = `yt:channel:${idParam}`
  const cached = await cacheGet<YouTubeChannel>(cacheKey)
  if (cached) return cached

  const data = await ytGet<{
    items: Array<{
      id: string
      snippet: {
        title: string
        description: string
        customUrl: string
        publishedAt: string
        country: string
        thumbnails: { default: { url: string } }
      }
      statistics: {
        viewCount: string
        subscriberCount: string
        videoCount: string
      }
    }>
  }>(
    '/channels',
    {
      part: 'snippet,statistics',
      ...(channelId ? { id: channelId } : { mine: 'true' }),
      maxResults: '1',
    },
    accessToken,
  )

  const item = data.items?.[0]
  if (!item) throw new Error('YouTube channel not found')

  const channel: YouTubeChannel = {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    customUrl: item.snippet.customUrl ?? '',
    thumbnailUrl: item.snippet.thumbnails.default.url,
    country: item.snippet.country ?? '',
    subscriberCount: Number(item.statistics.subscriberCount ?? 0),
    videoCount: Number(item.statistics.videoCount ?? 0),
    viewCount: Number(item.statistics.viewCount ?? 0),
    publishedAt: item.snippet.publishedAt,
  }

  await cacheSet(cacheKey, channel, CACHE_TTL)
  return channel
}

// ── Videos ────────────────────────────────────────────────────

export async function getYouTubeVideos(
  accessToken: string,
  channelId: string,
  limit = 20,
): Promise<YouTubeVideo[]> {
  const cacheKey = `yt:videos:${channelId}:${limit}`
  const cached = await cacheGet<YouTubeVideo[]>(cacheKey)
  if (cached) return cached

  // Step 1 — get video IDs from channel's uploads playlist
  const channelData = await ytGet<{
    items: Array<{
      contentDetails: { relatedPlaylists: { uploads: string } }
    }>
  }>(
    '/channels',
    { part: 'contentDetails', id: channelId },
    accessToken,
  )

  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails.relatedPlaylists.uploads
  if (!uploadsPlaylistId) throw new Error('Could not get uploads playlist')

  const playlistItems = await ytGet<{
    items: Array<{ contentDetails: { videoId: string } }>
  }>(
    '/playlistItems',
    {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: String(limit),
    },
    accessToken,
  )

  const videoIds = playlistItems.items.map((i) => i.contentDetails.videoId).join(',')
  if (!videoIds) return []

  // Step 2 — get stats for those video IDs
  const videosData = await ytGet<{
    items: Array<{
      id: string
      snippet: {
        title: string
        description: string
        publishedAt: string
        channelId: string
        thumbnails: { medium: { url: string } }
      }
      statistics: {
        viewCount: string
        likeCount: string
        commentCount: string
      }
      contentDetails: { duration: string }
    }>
  }>(
    '/videos',
    {
      part: 'snippet,statistics,contentDetails',
      id: videoIds,
    },
    accessToken,
  )

  const videos: YouTubeVideo[] = videosData.items.map((item) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: item.snippet.thumbnails.medium.url,
    publishedAt: item.snippet.publishedAt,
    viewCount: Number(item.statistics.viewCount ?? 0),
    likeCount: Number(item.statistics.likeCount ?? 0),
    commentCount: Number(item.statistics.commentCount ?? 0),
    duration: item.contentDetails.duration,
    channelId: item.snippet.channelId,
  }))

  await cacheSet(cacheKey, videos, CACHE_TTL)
  return videos
}

// ── Analytics (YouTube Analytics API) ────────────────────────

export async function getYouTubeAnalytics(
  accessToken: string,
  channelId: string,
  startDate: string,
  endDate: string,
): Promise<YouTubeChannelInsights[]> {
  const cacheKey = `yt:analytics:${channelId}:${startDate}:${endDate}`
  const cached = await cacheGet<YouTubeChannelInsights[]>(cacheKey)
  if (cached) return cached

  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
  url.searchParams.set('ids', `channel==${channelId}`)
  url.searchParams.set('startDate', startDate)
  url.searchParams.set('endDate', endDate)
  url.searchParams.set(
    'metrics',
    'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares,annotationClickThroughRate',
  )
  url.searchParams.set('dimensions', 'day')
  url.searchParams.set('sort', 'day')
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString())
  const json = await res.json() as {
    error?: { message: string; code: number }
    columnHeaders?: Array<{ name: string }>
    rows?: Array<Array<string | number>>
  }

  if (!res.ok || json.error) {
    throw new Error(
      `YouTube Analytics error: ${json.error?.message ?? res.statusText} (${json.error?.code ?? res.status})`,
    )
  }

  const headers = json.columnHeaders?.map((h) => h.name) ?? []
  const rows = json.rows ?? []

  const result: YouTubeChannelInsights[] = rows.map((row) => {
    const obj: Record<string, string | number> = {}
    headers.forEach((h, i) => { obj[h] = row[i] as string | number })
    return {
      date: String(obj['day'] ?? ''),
      views: Number(obj['views'] ?? 0),
      estimatedMinutesWatched: Number(obj['estimatedMinutesWatched'] ?? 0),
      averageViewDuration: Number(obj['averageViewDuration'] ?? 0),
      subscribersGained: Number(obj['subscribersGained'] ?? 0),
      subscribersLost: Number(obj['subscribersLost'] ?? 0),
      likes: Number(obj['likes'] ?? 0),
      comments: Number(obj['comments'] ?? 0),
      shares: Number(obj['shares'] ?? 0),
      annotationClickThroughRate: Number(obj['annotationClickThroughRate'] ?? 0),
    }
  })

  await cacheSet(cacheKey, result, CACHE_TTL)
  return result
}

// ── OAuth token exchange ──────────────────────────────────────

export async function exchangeYouTubeCode(code: string, redirectUri: string): Promise<YouTubeTokens> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const json = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
    error?: string
    error_description?: string
  }

  if (!res.ok || json.error) {
    throw new Error(`YouTube token exchange failed: ${json.error_description ?? json.error ?? res.statusText}`)
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    tokenType: json.token_type,
  }
}

export async function refreshYouTubeToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: 'refresh_token',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const json = await res.json() as {
    access_token: string
    expires_in: number
    error?: string
    error_description?: string
  }

  if (!res.ok || json.error) {
    throw new Error(`YouTube token refresh failed: ${json.error_description ?? json.error ?? res.statusText}`)
  }

  return { accessToken: json.access_token, expiresIn: json.expires_in }
}

// ── Public channel lookup (API key only — no OAuth) ───────────
// Works for any public YouTube channel. Requires YOUTUBE_API_KEY env var.

interface YTPublicChannelResponse {
  items?: Array<{
    id: string
    snippet: {
      title: string
      description: string
      customUrl?: string
      publishedAt: string
      country?: string
      thumbnails?: { default?: { url: string } }
    }
    statistics: {
      subscriberCount?: string
      videoCount?: string
      viewCount?: string
      hiddenSubscriberCount?: boolean
    }
  }>
}

export async function getYouTubeChannelPublic(
  handleOrId: string,
): Promise<YouTubeChannel | null> {
  const apiKey = process.env['YOUTUBE_API_KEY']
  if (!apiKey) {
    console.warn('[youtube] YOUTUBE_API_KEY not set — cannot fetch public channel data')
    return null
  }

  const cleanHandle = handleOrId.replace('@', '').trim()
  const cacheKey = `yt:public:${cleanHandle}`
  const cached = await cacheGet<YouTubeChannel>(cacheKey)
  if (cached) return cached

  // Try three lookup strategies: @handle, legacy username, direct channel ID
  const strategies: Array<[string, string]> = [
    ['forHandle', `@${cleanHandle}`],
    ['forUsername', cleanHandle],
    ...(cleanHandle.startsWith('UC') ? [['id', cleanHandle] as [string, string]] : []),
  ]

  for (const [param, value] of strategies) {
    try {
      const url = new URL(`${YT_BASE}/channels`)
      url.searchParams.set('part', 'snippet,statistics')
      url.searchParams.set(param, value)
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString())
      if (!res.ok) continue

      const data = (await res.json()) as YTPublicChannelResponse
      const item = data.items?.[0]
      if (!item) continue

      const channel: YouTubeChannel = {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        customUrl: item.snippet.customUrl ?? cleanHandle,
        thumbnailUrl: item.snippet.thumbnails?.default?.url ?? '',
        country: item.snippet.country ?? '',
        subscriberCount: item.statistics.hiddenSubscriberCount
          ? 0
          : parseInt(item.statistics.subscriberCount ?? '0', 10),
        videoCount: parseInt(item.statistics.videoCount ?? '0', 10),
        viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
        publishedAt: item.snippet.publishedAt,
      }

      await cacheSet(cacheKey, channel, 3600)
      return channel
    } catch {
      // try next strategy
    }
  }

  console.warn(`[youtube] Could not find public channel for: ${handleOrId}`)
  return null
}
