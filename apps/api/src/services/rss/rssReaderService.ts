/**
 * rssReaderService.ts
 *
 * Fetches and parses RSS/Atom feeds for the Trending Now page.
 * Uses the rss-feeds-by-industry.json config to pick relevant feeds.
 * No external library required — pure XML parsing via regex.
 */

import { redis } from '../../lib/redis'
import rssFeedConfig from '../../lib/rss-feeds-by-industry.json'

// ── Types ─────────────────────────────────────────────────────

export interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string | null
  sourceName: string
}

interface FeedConfig {
  name: string
  url: string
  lang: string
}

type IndustryFeeds = Record<string, FeedConfig[]>

// ── Helpers ───────────────────────────────────────────────────

const FEEDS = rssFeedConfig as IndustryFeeds

const CACHE_TTL = 3600 // 1 hour

/** Extract text content between XML tags (simple, no full parse) */
function extractTag(xml: string, tag: string): string {
  const patterns = [
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
    new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'),
  ]
  for (const re of patterns) {
    const m = re.exec(xml)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

/** Parse <item> or <entry> blocks from feed XML */
function parseItems(xml: string, sourceName: string): RSSItem[] {
  const items: RSSItem[] = []
  const itemRe = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi
  let match: RegExpExecArray | null

  while ((match = itemRe.exec(xml)) !== null && items.length < 10) {
    const block = match[1]
    const title = extractTag(block, 'title')
    const link =
      extractTag(block, 'link') ||
      (block.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? '')
    const description =
      extractTag(block, 'description') ||
      extractTag(block, 'summary') ||
      extractTag(block, 'content')
    const pubDate =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated') ||
      null

    if (title && link) {
      items.push({
        title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
        link,
        description: description.replace(/<[^>]+>/g, '').slice(0, 200),
        pubDate,
        sourceName,
      })
    }
  }

  return items
}

/** Fetch a single RSS URL with a timeout */
async function fetchFeed(feedConfig: FeedConfig): Promise<RSSItem[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(feedConfig.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SocialPulse/1.0 (+https://socialpulse.app/bot)' },
    })

    clearTimeout(timeout)

    if (!res.ok) return []
    const xml = await res.text()
    return parseItems(xml, feedConfig.name)
  } catch {
    return []
  }
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Get RSS feed items for a given industry.
 * Results are cached in Redis for 1 hour.
 */
export async function getIndustryFeedItems(industry: string, maxItems = 20): Promise<RSSItem[]> {
  const cacheKey = `rss:${industry}`

  // Try Redis cache first
  try {
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached) as RSSItem[]
  } catch {
    // Redis unavailable — proceed without cache
  }

  // Pick feeds for this industry, fall back to _default
  const feeds: FeedConfig[] = FEEDS[industry] ?? FEEDS['_default'] ?? []

  if (feeds.length === 0) return []

  // Fetch up to 3 feeds in parallel to stay fast
  const feedsToFetch = feeds.slice(0, 3)
  const results = await Promise.all(feedsToFetch.map(fetchFeed))
  const items = results.flat().slice(0, maxItems)

  // Cache result
  try {
    await redis.set(cacheKey, JSON.stringify(items), 'EX', CACHE_TTL)
  } catch {
    // Non-fatal
  }

  return items
}

/**
 * Get trending topics from RSS feeds by counting title word frequency.
 * Returns top N topics with their source count.
 */
export async function extractTrendingTopics(industry: string, topN = 10): Promise<
  Array<{ topic: string; count: number; relatedArticles: string[] }>
> {
  const items = await getIndustryFeedItems(industry, 30)

  // Build word frequency map from titles
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to',
    'for', 'of', 'and', 'or', 'but', 'not', 'with', 'as', 'by', 'it',
    'its', 'this', 'that', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'new', 'more',
    'how', 'why', 'what', 'when', 'who', 'your', 'from', 'about', 'after',
  ])

  const wordMap = new Map<string, { count: number; links: string[] }>()

  for (const item of items) {
    const words = item.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !stopWords.has(w))

    for (const word of words) {
      const existing = wordMap.get(word) ?? { count: 0, links: [] }
      existing.count++
      if (item.link && !existing.links.includes(item.link)) {
        existing.links.push(item.link)
      }
      wordMap.set(word, existing)
    }
  }

  return Array.from(wordMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topN)
    .map(([topic, { count, links }]) => ({
      topic: topic.charAt(0).toUpperCase() + topic.slice(1),
      count,
      relatedArticles: links.slice(0, 3),
    }))
}
