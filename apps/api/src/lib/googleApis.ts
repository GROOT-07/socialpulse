/**
 * Google APIs client
 * Covers: Knowledge Graph Search API + Places API (New)
 *
 * Returns empty/null when keys are not configured.
 * Never throws — callers receive graceful empty results.
 */

// ── Types ─────────────────────────────────────────────────────

export interface KnowledgeGraphResult {
  name: string
  description: string
  detailedDescription: string
  url: string | null
  category: string | null
  imageUrl: string | null
}

export interface PlaceDetails {
  name: string
  formattedAddress: string
  city: string
  country: string
  rating: number | null
  userRatingsTotal: number | null
  openingHours: string[] | null
  website: string | null
  phoneNumber: string | null
  businessStatus: string | null
  placeId: string
  lat: number | null
  lng: number | null
}

export interface PlaceAutocomplete {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

// ── Knowledge Graph API ───────────────────────────────────────

interface KGItem {
  result?: {
    name?: string
    description?: string
    detailedDescription?: { articleBody?: string; url?: string }
    '@type'?: string[]
    url?: string
    image?: { contentUrl?: string }
  }
}

interface KGResponse {
  itemListElement?: KGItem[]
}

/**
 * Search Google Knowledge Graph for an entity (org name + industry).
 * Returns best match or null.
 */
export async function searchKnowledgeGraph(
  query: string,
  limit = 3,
): Promise<KnowledgeGraphResult | null> {
  const key = process.env['GOOGLE_KNOWLEDGE_GRAPH_API_KEY']
  if (!key) {
    console.warn('[googleKG] GOOGLE_KNOWLEDGE_GRAPH_API_KEY not set')
    return null
  }

  try {
    const url = new URL('https://kgsearch.googleapis.com/v1/entities:search')
    url.searchParams.set('query', query)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('indent', 'true')
    url.searchParams.set('key', key)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = (await res.json()) as KGResponse
    const item = data.itemListElement?.[0]?.result
    if (!item) return null

    return {
      name: item.name ?? query,
      description: item.description ?? '',
      detailedDescription: item.detailedDescription?.articleBody ?? '',
      url: item.url ?? item.detailedDescription?.url ?? null,
      category: item['@type']?.[0] ?? null,
      imageUrl: item.image?.contentUrl ?? null,
    }
  } catch (err) {
    console.warn(`[googleKG] searchKnowledgeGraph failed: ${String(err)}`)
    return null
  }
}

// ── Places API (New) ──────────────────────────────────────────

interface PlacesSearchCandidate {
  place_id?: string
  name?: string
  formatted_address?: string
  geometry?: { location?: { lat?: number; lng?: number } }
  rating?: number
  user_ratings_total?: number
  website?: string
  formatted_phone_number?: string
  business_status?: string
  opening_hours?: { weekday_text?: string[] }
}

interface PlacesSearchResponse {
  candidates?: PlacesSearchCandidate[]
  status?: string
}

interface PlacesDetailsResponse {
  result?: PlacesSearchCandidate
  status?: string
}

interface PlacesAutocompleteResponse {
  predictions?: Array<{
    place_id?: string
    description?: string
    structured_formatting?: {
      main_text?: string
      secondary_text?: string
    }
  }>
  status?: string
}

/**
 * Find a business via Google Places text search.
 */
export async function findPlace(query: string, city: string): Promise<PlaceDetails | null> {
  const key = process.env['GOOGLE_PLACES_API_KEY']
  if (!key) {
    console.warn('[places] GOOGLE_PLACES_API_KEY not set')
    return null
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json')
    url.searchParams.set('input', `${query} ${city}`)
    url.searchParams.set('inputtype', 'textquery')
    url.searchParams.set(
      'fields',
      'place_id,name,formatted_address,geometry,rating,user_ratings_total,business_status',
    )
    url.searchParams.set('key', key)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = (await res.json()) as PlacesSearchResponse
    const candidate = data.candidates?.[0]
    if (!candidate?.place_id) return null

    return getPlaceDetails(candidate.place_id)
  } catch (err) {
    console.warn(`[places] findPlace failed: ${String(err)}`)
    return null
  }
}

/**
 * Get full details for a place by ID.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = process.env['GOOGLE_PLACES_API_KEY']
  if (!key) return null

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set(
      'fields',
      'place_id,name,formatted_address,geometry,rating,user_ratings_total,website,formatted_phone_number,business_status,opening_hours,address_components',
    )
    url.searchParams.set('key', key)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = (await res.json()) as PlacesDetailsResponse
    const r = data.result
    if (!r) return null

    // Extract city from address_components
    const cityName = ''

    return {
      name: r.name ?? '',
      formattedAddress: r.formatted_address ?? '',
      city: cityName,
      country: '',
      rating: r.rating ?? null,
      userRatingsTotal: r.user_ratings_total ?? null,
      openingHours: r.opening_hours?.weekday_text ?? null,
      website: r.website ?? null,
      phoneNumber: r.formatted_phone_number ?? null,
      businessStatus: r.business_status ?? null,
      placeId: r.place_id ?? placeId,
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
    }
  } catch (err) {
    console.warn(`[places] getPlaceDetails failed: ${String(err)}`)
    return null
  }
}

/**
 * Autocomplete location search (for onboarding city field).
 */
export async function autocompleteLocation(input: string): Promise<PlaceAutocomplete[]> {
  const key = process.env['GOOGLE_PLACES_API_KEY']
  if (!key) return []

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
    url.searchParams.set('input', input)
    url.searchParams.set('types', '(cities)')
    url.searchParams.set('key', key)

    const res = await fetch(url.toString())
    if (!res.ok) return []

    const data = (await res.json()) as PlacesAutocompleteResponse
    return (data.predictions ?? []).map((p) => ({
      placeId: p.place_id ?? '',
      description: p.description ?? '',
      mainText: p.structured_formatting?.main_text ?? '',
      secondaryText: p.structured_formatting?.secondary_text ?? '',
    }))
  } catch (err) {
    console.warn(`[places] autocompleteLocation failed: ${String(err)}`)
    return []
  }
}

/**
 * Search for businesses near a location (competitor discovery).
 */
export async function searchNearbyBusinesses(
  industry: string,
  lat: number,
  lng: number,
  radiusMeters = 15000,
  limit = 10,
): Promise<PlaceDetails[]> {
  const key = process.env['GOOGLE_PLACES_API_KEY']
  if (!key) return []

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
    url.searchParams.set('location', `${lat},${lng}`)
    url.searchParams.set('radius', String(radiusMeters))
    url.searchParams.set('keyword', industry)
    url.searchParams.set('key', key)

    const res = await fetch(url.toString())
    if (!res.ok) return []

    const data = (await res.json()) as { results?: PlacesSearchCandidate[] }
    const places = (data.results ?? []).slice(0, limit)

    return places.map((r) => ({
      name: r.name ?? '',
      formattedAddress: r.formatted_address ?? '',
      city: '',
      country: '',
      rating: r.rating ?? null,
      userRatingsTotal: r.user_ratings_total ?? null,
      openingHours: null,
      website: r.website ?? null,
      phoneNumber: null,
      businessStatus: r.business_status ?? null,
      placeId: r.place_id ?? '',
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
    }))
  } catch (err) {
    console.warn(`[places] searchNearbyBusinesses failed: ${String(err)}`)
    return []
  }
}
