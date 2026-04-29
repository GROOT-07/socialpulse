/**
 * Apify service — scrapes public social media profiles without OAuth.
 *
 * Uses Apify REST API v2 synchronous run endpoint.
 * Requires APIFY_API_TOKEN env var (get one free at apify.com).
 *
 * Actors used:
 *   Instagram : apify/instagram-profile-scraper
 *   Facebook  : apify/facebook-pages-scraper
 *
 * YouTube public data uses YouTube Data API v3 with just YOUTUBE_API_KEY
 * (see youtubeService.ts — no OAuth required for public channel stats).
 *
 * When APIFY_API_TOKEN is not set, all functions return null gracefully.
 * NEVER called directly from user requests — only from BullMQ workers.
 */

const APIFY_BASE = 'https://api.apify.com/v2'
// Give actor up to 90s to run; add 20s buffer for network on our side
const ACTOR_TIMEOUT_SECS = 90
const FETCH_TIMEOUT_MS = (ACTOR_TIMEOUT_SECS + 20) * 1000

// ── Types ─────────────────────────────────────────────────────

export interface ApifyInstagramProfile {
  username: string
  fullName: string
  biography: string
  followersCount: number
  followsCount: number
  postsCount: number
  profilePicUrl: string
  isVerified: boolean
  externalUrl: string | null
  businessCategoryName: string | null
  avgLikesPerPost: number
  avgCommentsPerPost: number
}

export interface ApifyFacebookPage {
  title: string
  pageUrl: string
  likes: number
  followersCount: number
  categories: string[]
  description: string
  website: string | null
  email: string | null
  phone: string | null
}

// ── Core runner ───────────────────────────────────────────────

async function runActorSync<T>(actorId: string, input: unknown): Promise<T[]> {
  const token = process.env['APIFY_API_TOKEN']
  if (!token) {
    console.warn(`[apify] APIFY_API_TOKEN not set — skipping ${actorId}`)
    return []
  }

  const url =
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items` +
    `?token=${token}&timeout=${ACTOR_TIMEOUT_SECS}&format=json`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[apify] ${actorId} → HTTP ${res.status}: ${body.slice(0, 200)}`)
      return []
    }

    const data = (await res.json()) as T[]
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.warn(`[apify] ${actorId} fetch failed:`, String(err))
    return []
  }
}

// ── Instagram ─────────────────────────────────────────────────

export async function scrapeInstagramProfile(
  username: string,
): Promise<ApifyInstagramProfile | null> {
  const handle = username.replace('@', '').trim()
  if (!handle) return null

  const results = await runActorSync<Record<string, unknown>>(
    'apify/instagram-profile-scraper',
    { usernames: [handle], resultsLimit: 1 },
  )

  const r = results[0]
  if (!r) {
    console.warn(`[apify] No Instagram result for @${handle}`)
    return null
  }

  // Compute avg engagement from latestPosts if available
  const posts = Array.isArray(r['latestPosts']) ? (r['latestPosts'] as Record<string, unknown>[]) : []
  const avgLikes =
    posts.length > 0
      ? posts.reduce((s, p) => s + Number(p['likesCount'] ?? p['likes_count'] ?? 0), 0) / posts.length
      : 0
  const avgComments =
    posts.length > 0
      ? posts.reduce((s, p) => s + Number(p['commentsCount'] ?? p['comments_count'] ?? 0), 0) / posts.length
      : 0

  return {
    username: String(r['username'] ?? handle),
    fullName: String(r['fullName'] ?? r['full_name'] ?? ''),
    biography: String(r['biography'] ?? r['bio'] ?? ''),
    followersCount: Number(r['followersCount'] ?? r['followers_count'] ?? r['edge_followed_by']?.count ?? 0),
    followsCount: Number(r['followsCount'] ?? r['follows_count'] ?? r['edge_follow']?.count ?? 0),
    postsCount: Number(r['postsCount'] ?? r['media_count'] ?? r['edge_owner_to_timeline_media']?.count ?? 0),
    profilePicUrl: String(r['profilePicUrl'] ?? r['profile_pic_url'] ?? r['profilePicUrlHD'] ?? ''),
    isVerified: Boolean(r['verified'] ?? r['isVerified'] ?? r['is_verified'] ?? false),
    externalUrl: r['externalUrl'] ? String(r['externalUrl']) : null,
    businessCategoryName: r['businessCategoryName'] ? String(r['businessCategoryName']) : null,
    avgLikesPerPost: Math.round(avgLikes * 10) / 10,
    avgCommentsPerPost: Math.round(avgComments * 10) / 10,
  }
}

// ── Facebook ──────────────────────────────────────────────────

export async function scrapeFacebookPage(
  pageUrlOrName: string,
): Promise<ApifyFacebookPage | null> {
  const url = pageUrlOrName.startsWith('http')
    ? pageUrlOrName
    : `https://www.facebook.com/${pageUrlOrName}`

  const results = await runActorSync<Record<string, unknown>>(
    'apify/facebook-pages-scraper',
    { startUrls: [{ url }] },
  )

  const r = results[0]
  if (!r) {
    console.warn(`[apify] No Facebook result for ${url}`)
    return null
  }

  // Field names vary across Apify actor versions — handle both
  const likes = Number(r['likes'] ?? r['page_likes'] ?? r['pageLikes'] ?? 0)
  const followers = Number(
    r['followers'] ?? r['followersCount'] ?? r['page_followers'] ?? likes,
  )

  return {
    title: String(r['title'] ?? r['name'] ?? r['pageName'] ?? ''),
    pageUrl: String(r['pageUrl'] ?? r['url'] ?? url),
    likes,
    followersCount: followers,
    categories: Array.isArray(r['categories'])
      ? (r['categories'] as unknown[]).map(String)
      : r['category']
        ? [String(r['category'])]
        : [],
    description: String(r['description'] ?? r['about'] ?? r['intro'] ?? ''),
    website: r['website'] ? String(r['website']) : null,
    email: r['email'] ? String(r['email']) : null,
    phone: r['phone'] ? String(r['phone']) : null,
  }
}
