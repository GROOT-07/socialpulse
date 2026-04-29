/**
 * SerpAPI client
 * Handles: Google Search, Google Local, Google Maps, Google Trends
 * Docs: https://serpapi.com/search-api
 *
 * All functions return typed results or throw with a descriptive message.
 * Returns empty results (not throws) when SERPAPI_KEY is not configured.
 */

const SERPAPI_BASE = 'https://serpapi.com/search'

function getKey(): string | null {
  return process.env['SERPAPI_KEY'] ?? null
}

function warn(msg: string): void {
  console.warn(`[serpapi] ${msg}`)
}

// ── Shared fetch helper ───────────────────────────────────────

async function serpGet<T>(params: Record<string, string>): Promise<T> {
  const key = getKey()
  if (!key) {
    warn('SERPAPI_KEY not set — returning empty result')
    return {} as T
  }

  const url = new URL(SERPAPI_BASE)
  Object.entries({ ...params, api_key: key, output: 'json' }).forEach(
    ([k, v]) => url.searchParams.set(k, v),
  )

  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SerpAPI error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Types ─────────────────────────────────────────────────────

export interface LocalSearchResult {
  title: string
  address: string
  website: string | null
  rating: number | null
  reviews: number | null
  phone: string | null
  placeId: string | null
}

export interface OrganicSearchResult {
  title: string
  link: string
  snippet: string
  domain: string
  position: number
}

export interface KeywordRankResult {
  keyword: string
  position: number | null
  url: string | null
}

export interface TrendingSearchResult {
  query: string
  value: number
  delta: number
}

// ── Raw SerpAPI response shapes ───────────────────────────────

interface SerpLocalResult {
  title?: string
  address?: string
  website?: string
  rating?: number
  reviews?: number
  phone?: string
  place_id?: string
}

interface SerpOrganicResult {
  title?: string
  link?: string
  snippet?: string
  position?: number
}

interface SerpTrendingSearch {
  query?: { query?: string }
  extracted_value?: number
  increase_percentage_str?: string
  increase_percentage?: number
}

// ── Public API ────────────────────────────────────────────────

/**
 * Search Google Local (Maps pack) for businesses in a category + city.
 * Used for competitor discovery.
 */
export async function searchLocalBusinesses(
  industry: string,
  city: string,
  limit = 10,
): Promise<LocalSearchResult[]> {
  if (!getKey()) return []

  try {
    const data = await serpGet<{ local_results?: SerpLocalResult[] }>({
      engine: 'google',
      q: `${industry} in ${city}`,
      location: city,
      gl: 'in',
      hl: 'en',
      num: String(limit),
    })

    return (data.local_results ?? []).slice(0, limit).map((r) => ({
      title: r.title ?? '',
      address: r.address ?? '',
      website: r.website ?? null,
      rating: r.rating ?? null,
      reviews: r.reviews ?? null,
      phone: r.phone ?? null,
      placeId: r.place_id ?? null,
    }))
  } catch (err) {
    warn(`searchLocalBusinesses failed: ${String(err)}`)
    return []
  }
}

/**
 * Search organic Google results to find SEO competitors for a keyword.
 */
export async function searchOrganicResults(
  query: string,
  limit = 10,
): Promise<OrganicSearchResult[]> {
  if (!getKey()) return []

  try {
    const data = await serpGet<{ organic_results?: SerpOrganicResult[] }>({
      engine: 'google',
      q: query,
      num: String(Math.min(limit, 10)),
      gl: 'in',
      hl: 'en',
    })

    return (data.organic_results ?? []).slice(0, limit).map((r) => ({
      title: r.title ?? '',
      link: r.link ?? '',
      snippet: r.snippet ?? '',
      domain: r.link ? new URL(r.link).hostname.replace('www.', '') : '',
      position: r.position ?? 0,
    }))
  } catch (err) {
    warn(`searchOrganicResults failed: ${String(err)}`)
    return []
  }
}

/**
 * Check where a domain ranks for a specific keyword.
 * Returns null position if not found in top 100.
 */
export async function checkKeywordRank(
  keyword: string,
  domain: string,
): Promise<KeywordRankResult> {
  if (!getKey()) return { keyword, position: null, url: null }

  try {
    const data = await serpGet<{ organic_results?: SerpOrganicResult[] }>({
      engine: 'google',
      q: keyword,
      num: '100',
      gl: 'in',
      hl: 'en',
    })

    const results = data.organic_results ?? []
    const match = results.find((r) => r.link?.includes(domain))

    return {
      keyword,
      position: match?.position ?? null,
      url: match?.link ?? null,
    }
  } catch (err) {
    warn(`checkKeywordRank failed: ${String(err)}`)
    return { keyword, position: null, url: null }
  }
}

/**
 * Get trending searches for a category via Google Trends (SerpAPI).
 */
export async function getTrendingSearches(
  category: string,
  country = 'IN',
  limit = 10,
): Promise<TrendingSearchResult[]> {
  if (!getKey()) return []

  try {
    const data = await serpGet<{ trending_searches?: SerpTrendingSearch[] }>({
      engine: 'google_trends_trending_now',
      geo: country,
    })

    const all = (data.trending_searches ?? []).filter((t) => {
      const q = t.query?.query?.toLowerCase() ?? ''
      return q.includes(category.toLowerCase()) || category === ''
    })

    return all.slice(0, limit).map((t) => ({
      query: t.query?.query ?? '',
      value: t.extracted_value ?? 0,
      delta: t.increase_percentage ?? 0,
    }))
  } catch (err) {
    warn(`getTrendingSearches failed: ${String(err)}`)
    return []
  }
}

/**
 * Get competitor keyword rankings — returns top keywords a domain ranks for.
 */
export async function getCompetitorKeywords(
  domain: string,
  industry: string,
  city: string,
  limit = 20,
): Promise<Array<{ keyword: string; position: number }>> {
  if (!getKey()) return []

  // Build a set of seed keywords to check competitor ranking for
  const seedKeywords = [
    `${industry} in ${city}`,
    `best ${industry} in ${city}`,
    `${industry} near me`,
    `top ${industry} ${city}`,
    `${industry} services ${city}`,
  ]

  const results: Array<{ keyword: string; position: number }> = []

  for (const kw of seedKeywords.slice(0, limit)) {
    try {
      const data = await serpGet<{ organic_results?: SerpOrganicResult[] }>({
        engine: 'google',
        q: kw,
        num: '20',
        gl: 'in',
        hl: 'en',
      })
      const match = (data.organic_results ?? []).find((r) => r.link?.includes(domain))
      if (match?.position) {
        results.push({ keyword: kw, position: match.position })
      }
    } catch {
      // Continue on individual keyword errors
    }
  }

  return results
}
