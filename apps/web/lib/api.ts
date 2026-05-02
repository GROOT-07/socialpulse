/**
 * API client — all requests go through here.
 * Handles auth header injection, x-org-id header, and token refresh.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
  orgId?: string
  /** Internal flag — prevents infinite refresh loops */
  _retry?: boolean
}

async function getAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('sp_access_token')
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('sp-auth')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { refreshToken?: string | null } }
    return parsed?.state?.refreshToken ?? null
  } catch {
    return null
  }
}

function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('sp-org')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { activeOrg?: { id?: string } } }
    return parsed?.state?.activeOrg?.id ?? null
  } catch {
    return null
  }
}

/** Attempt a silent token refresh. Returns the new access token, or null on failure. */
async function attemptRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const json = await res.json() as { data?: { accessToken?: string } }
    const newToken = json?.data?.accessToken
    if (!newToken) return null
    // Persist new token the same way the auth store does
    sessionStorage.setItem('sp_access_token', newToken)
    // Also update Zustand persist store so it stays coherent
    try {
      const raw = localStorage.getItem('sp-auth')
      if (raw) {
        const store = JSON.parse(raw) as { state?: Record<string, unknown> }
        if (store.state) {
          store.state['accessToken'] = newToken
          localStorage.setItem('sp-auth', JSON.stringify(store))
        }
      }
    } catch { /* best-effort */ }
    return newToken
  } catch {
    return null
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, orgId, _retry = false, ...init } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }

  if (!skipAuth) {
    const token = await getAccessToken()
    if (token) headers['Authorization'] = `Bearer ${token}`

    const activeOrgId = orgId ?? getActiveOrgId()
    if (activeOrgId) headers['x-org-id'] = activeOrgId
  }

  // 60-second timeout — Render free-tier cold-starts can take ~50 s
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000)
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal })
  } catch (err) {
    clearTimeout(timeoutId)
    const isTimeout = err instanceof DOMException && err.name === 'AbortError'
    throw new ApiError(
      0,
      isTimeout
        ? 'Server is starting up — this takes ~30 s on first load. Please refresh in a moment.'
        : 'Cannot reach the server. Check your connection and retry.',
    )
  }
  clearTimeout(timeoutId)

  // ── 401 → silent refresh → retry once ────────────────────────
  if (res.status === 401 && !skipAuth && !_retry) {
    const newToken = await attemptRefresh()
    if (newToken) {
      return request<T>(path, { ...options, _retry: true })
    }
    // Refresh failed — clear auth state and redirect to login
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('sp_access_token')
      // Clear persisted auth so store re-hydrates as logged-out
      try {
        const raw = localStorage.getItem('sp-auth')
        if (raw) {
          const store = JSON.parse(raw) as { state?: Record<string, unknown> }
          if (store.state) {
            store.state['refreshToken'] = null
            store.state['isAuthenticated'] = false
            store.state['user'] = null
            localStorage.setItem('sp-auth', JSON.stringify(store))
          }
        }
      } catch { /* best-effort */ }
      window.location.href = '/login'
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, body.message ?? 'Request failed', body)
  }

  const json = await res.json() as { data?: T } & T
  // Some endpoints return { data: ... } wrapper; others return the object directly
  return (json.data !== undefined ? json.data : json) as T
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Auth ──────────────────────────────────────────────────────

export const authApi = {
  register: (body: { email: string; password: string; orgName: string; industry: string }) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify(body), skipAuth: true }),

  login: (body: { email: string; password: string; rememberMe?: boolean }) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify(body), skipAuth: true }),

  logout: (refreshToken: string) =>
    request('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  refresh: (refreshToken: string) =>
    request('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }), skipAuth: true }),

  forgotPassword: (email: string) =>
    request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }), skipAuth: true }),

  resetPassword: (body: { token: string; password: string }) =>
    request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body), skipAuth: true }),

  me: () => request('/api/auth/me'),
}

// ── Orgs ──────────────────────────────────────────────────────

export const orgsApi = {
  list: () => request('/api/orgs'),
  get: (id: string) => request(`/api/orgs/${id}`),
  create: (body: object) => request('/api/orgs', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/api/orgs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/api/orgs/${id}`, { method: 'DELETE' }),
  switch: (id: string) => request(`/api/orgs/${id}/switch`, { method: 'POST' }),
}

// ── Metrics ───────────────────────────────────────────────────

export const metricsApi = {
  kpis: () => request<KpiResponse>('/api/metrics/kpis'),
  overview: (days = 30) => request<OverviewResponse>(`/api/metrics/overview?days=${days}`),
  platform: (platform: 'instagram' | 'facebook' | 'youtube', days = 30) =>
    request<PlatformMetricsResponse>(`/api/metrics/${platform}?days=${days}`),
}

// ── Generic API client (for onboarding + ad-hoc calls) ───────

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: object) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: object) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// ── Social accounts ───────────────────────────────────────────

export const socialApi = {
  getAccounts: () => request<{ accounts: ConnectedAccount[] }>('/api/social/accounts'),
  disconnect: (id: string) =>
    request(`/api/social/accounts/${id}`, { method: 'DELETE' }),
  triggerSync: (id: string) =>
    request(`/api/social/accounts/${id}/sync`, { method: 'POST' }),
  getConnectUrl: (platform: 'instagram' | 'facebook' | 'youtube') =>
    request<{ url: string }>(`/api/social/auth/${platform}/connect`),
}

// ── Response types ────────────────────────────────────────────

export interface ConnectedAccount {
  id: string
  platform: 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'
  handle: string | null
  profileUrl: string | null
  tokenExpiresAt: string | null
  connectedAt: string
}

export interface KpiResponse {
  kpis: {
    totalFollowers: number
    totalReach: number
    totalImpressions: number
    avgEngagementRate: number
  }
  byPlatform: Record<string, {
    followers: number
    followersDelta: number
    engagementRate: number
    reach: number
    impressions: number
  }>
}

export interface MetricPoint {
  date: string
  followers: number
  following: number
  posts: number
  engagementRate: number
  reach: number
  impressions: number
  avgLikes: number
  avgComments: number
}

export interface PlatformSummary {
  currentFollowers: number
  followerGrowthPct: number
  avgEngagementRate: number
  totalReach: number
  totalImpressions: number
  avgLikes: number
  avgComments: number
  snapshotDate: string
}

export interface PlatformMetricsResponse {
  platform: string
  handle: string | null
  profileUrl: string | null
  connectedAt: string
  summary: PlatformSummary | null
  metrics: MetricPoint[]
  syncing?: boolean  // true when connected but no data yet — AI estimate in progress
}

export interface OverviewPlatform {
  platform: string
  handle: string | null
  profileUrl: string | null
  connectedAt: string
  latest: Omit<MetricPoint, 'date'> & { snapshotDate: string } | null
  followerGrowthPct: number
  trendData: Array<{ date: string; followers: number; reach: number; engagementRate: number }>
}

export interface OverviewResponse {
  overview: OverviewPlatform[]
}

// ── Competitors ───────────────────────────────────────────────

export interface Competitor {
  id: string
  name: string
  platform: 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'
  handle: string
  profileUrl: string | null
  avatarUrl: string | null
  isActive: boolean
  createdAt: string
  latestMetrics: CompetitorMetrics | null
}

export interface CompetitorMetrics {
  id: string
  competitorId: string
  snapshotDate: string
  followers: number | null
  following: number | null
  posts: number | null
  engagementRate: number | null
  avgLikes: number | null
  avgComments: number | null
  avgViews: number | null
}

export interface CompetitorPost {
  id: string
  externalId: string
  postedAt: string | null
  caption: string | null
  mediaType: string | null
  thumbnailUrl: string | null
  likes: number | null
  comments: number | null
  views: number | null
  engagementRate: number | null
}

export interface DiscoveryMeta {
  lastDiscoveryAt: string | null
  counts: { total: number; confirmed: number; pending: number; dismissed: number }
}

export const competitorApi = {
  list: (status?: string) =>
    request<{ competitors: Competitor[] }>(
      `/api/competitors${status ? `?status=${status}` : ''}`,
    ),
  listDiscovery: () =>
    request<Competitor[]>('/api/competitors?format=discovery'),
  get: (id: string) => request<{ competitor: Competitor }>(`/api/competitors/${id}`),
  add: (body: { name: string; platform: string; handle: string }) =>
    request<{ competitor: Competitor }>('/api/competitors', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ name: string; handle: string; isActive: boolean }>) =>
    request<{ competitor: Competitor }>(`/api/competitors/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateStatus: (id: string, status: 'CONFIRMED' | 'DISMISSED' | 'PENDING') =>
    request<{ competitor: Competitor }>(`/api/competitors/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  remove: (id: string) => request(`/api/competitors/${id}`, { method: 'DELETE' }),
  sync: (id: string) => request(`/api/competitors/${id}/sync`, { method: 'POST' }),
  rediscover: () => request<{ message: string }>('/api/competitors/rediscover', { method: 'POST' }),
  discoveryMeta: () => request<DiscoveryMeta>('/api/competitors/meta/discovery'),
  posts: (id: string, limit = 20) =>
    request<{ posts: CompetitorPost[] }>(`/api/competitors/${id}/posts?limit=${limit}`),
}

// ── AI ────────────────────────────────────────────────────────

export interface GapAnalysis {
  id: string
  sectionType: string
  content: string
  generatedAt: string
}

export const aiApi = {
  gapAnalysis: () => request<{ analysis: GapAnalysis | null }>('/api/ai/gap-analysis'),
  generateIdeas: (count = 5) =>
    request<{ ideas: ContentIdeaItem[] }>('/api/ai/ideas', { method: 'POST', body: JSON.stringify({ count }) }),
  generatePlaybookSection: (sectionType: string) =>
    request<{ section: { content: string } }>('/api/ai/playbook-section', { method: 'POST', body: JSON.stringify({ sectionType }) }),
  generatePersona: (demographics: string) =>
    request<{ persona: PersonaData }>('/api/ai/persona', { method: 'POST', body: JSON.stringify({ demographics }) }),
  generateBrandVoice: () =>
    request<{ voice: BrandVoiceData }>('/api/ai/brand-voice', { method: 'POST' }),
}

// ── Strategy ──────────────────────────────────────────────────

export interface Goal {
  id: string
  title: string
  description: string | null
  platform: string | null
  metric: string
  targetValue: number
  currentValue: number
  unit: string
  dueDate: string | null
  status: 'ACTIVE' | 'ACHIEVED' | 'MISSED'
  createdAt: string
}

export interface Persona {
  id: string
  name: string
  ageRange: string | null
  gender: string | null
  location: string | null
  interests: string[]
  platforms: string[]
  painPoints: string[]
  contentPreference: string | null
  aiGenerated: boolean
  createdAt: string
}

export interface BrandVoiceData {
  id?: string
  tone: string | null
  vocabulary: string | null
  doList: string | null
  dontList: string | null
  examplePost: string | null
  updatedAt?: string
}

export interface ContentPillar {
  id: string
  title: string
  description: string | null
  percentage: number | null
  color: string | null
  examples: string | null
  createdAt: string
}

export interface PlaybookSection {
  id: string
  sectionType: string
  content: string | null
  generatedAt: string | null
  updatedAt: string
}

export interface PersonaData {
  name?: string
  ageRange?: string
  gender?: string
  location?: string
  interests?: string[]
  painPoints?: string[]
  contentPreference?: string
}

export const strategyApi = {
  // Goals
  listGoals: () => request<{ goals: Goal[] }>('/api/strategy/goals'),
  createGoal: (body: Partial<Goal>) =>
    request<{ goal: Goal }>('/api/strategy/goals', { method: 'POST', body: JSON.stringify(body) }),
  updateGoal: (id: string, body: Partial<Goal>) =>
    request<{ goal: Goal }>(`/api/strategy/goals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteGoal: (id: string) => request(`/api/strategy/goals/${id}`, { method: 'DELETE' }),

  // Personas
  listPersonas: () => request<{ personas: Persona[] }>('/api/strategy/personas'),
  createPersona: (body: Partial<Persona>) =>
    request<{ persona: Persona }>('/api/strategy/personas', { method: 'POST', body: JSON.stringify(body) }),
  updatePersona: (id: string, body: Partial<Persona>) =>
    request<{ persona: Persona }>(`/api/strategy/personas/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePersona: (id: string) => request(`/api/strategy/personas/${id}`, { method: 'DELETE' }),

  // Brand Voice
  getVoice: () => request<{ voice: BrandVoiceData | null }>('/api/strategy/voice'),
  upsertVoice: (body: Partial<BrandVoiceData>) =>
    request<{ voice: BrandVoiceData }>('/api/strategy/voice', { method: 'PUT', body: JSON.stringify(body) }),

  // Pillars
  listPillars: () => request<{ pillars: ContentPillar[] }>('/api/strategy/pillars'),
  createPillar: (body: Partial<ContentPillar>) =>
    request<{ pillar: ContentPillar }>('/api/strategy/pillars', { method: 'POST', body: JSON.stringify(body) }),
  updatePillar: (id: string, body: Partial<ContentPillar>) =>
    request<{ pillar: ContentPillar }>(`/api/strategy/pillars/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePillar: (id: string) => request(`/api/strategy/pillars/${id}`, { method: 'DELETE' }),

  // Playbook
  getPlaybook: () => request<{ sections: PlaybookSection[]; goals: Goal[]; personas: Persona[]; pillars: ContentPillar[]; voice: BrandVoiceData | null }>('/api/strategy/playbook'),
  updateSection: (sectionType: string, content: string) =>
    request<{ section: PlaybookSection }>(`/api/strategy/playbook/${sectionType}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
}

// ── Calendar ──────────────────────────────────────────────────

export interface CalendarPost {
  id: string
  date: string          // ISO date string
  time: string | null   // "14:30" 24h
  platform: string
  topic: string
  contentPillar: string | null
  format: 'REEL' | 'CAROUSEL' | 'STORY' | 'POST' | 'SHORT' | 'VIDEO'
  caption: string | null
  notes: string | null
  status: 'PLANNED' | 'PUBLISHED' | 'SKIPPED'
  createdAt: string
}

export const calendarApi = {
  list: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return request<{ posts: CalendarPost[] }>(`/api/calendar?${params}`)
  },
  create: (body: Partial<CalendarPost>) =>
    request<{ post: CalendarPost }>('/api/calendar', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<CalendarPost>) =>
    request<{ post: CalendarPost }>(`/api/calendar/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/api/calendar/${id}`, { method: 'DELETE' }),
}

// ── Checklist ─────────────────────────────────────────────────

export interface ChecklistItem {
  id: string
  platform: string | null
  title: string
  description: string | null
  category: string | null
  isDone: boolean
  doneAt: string | null
  isCustom: boolean
  sortOrder: number
}

export const checklistApi = {
  get: () => request<{ items: ChecklistItem[] }>('/api/checklist'),
  toggle: (id: string) => request<{ item: ChecklistItem }>(`/api/checklist/${id}/toggle`, { method: 'PATCH' }),
  add: (body: { title: string; platform?: string; description?: string; category?: string }) =>
    request<{ item: ChecklistItem }>('/api/checklist', { method: 'POST', body: JSON.stringify(body) }),
  reset: () => request('/api/checklist/reset', { method: 'POST' }),
}

// ── Ideas ─────────────────────────────────────────────────────

export interface ContentIdeaItem {
  id?: string
  title: string
  description: string | null
  platform: string | null
  pillarId: string | null
  captionStarter: string | null
  status: 'BACKLOG' | 'SCHEDULED' | 'DONE'
  aiGenerated: boolean
  createdAt?: string
}

export const ideasApi = {
  list: (params?: { platform?: string; status?: string; pillarId?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>)
    return request<{ ideas: ContentIdeaItem[] }>(`/api/ideas?${q}`)
  },
  create: (body: Partial<ContentIdeaItem>) =>
    request<{ idea: ContentIdeaItem }>('/api/ideas', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<ContentIdeaItem>) =>
    request<{ idea: ContentIdeaItem }>(`/api/ideas/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/api/ideas/${id}`, { method: 'DELETE' }),
  generate: (count?: number) =>
    request<{ ideas: ContentIdeaItem[] }>('/api/ideas/generate', { method: 'POST', body: JSON.stringify({ count }) }),
}

// ── Audit ─────────────────────────────────────────────────────

export interface AuditItem {
  id: string
  platform: string | null
  category: string
  title: string
  description: string | null
  isDone: boolean
  score: number
  sortOrder: number
}

export const auditApi = {
  get: () => request<{ items: AuditItem[]; score: number }>('/api/audit'),
  toggle: (id: string) => request<{ item: AuditItem }>(`/api/audit/${id}/toggle`, { method: 'PATCH' }),
}

// ── Daily Brief ───────────────────────────────────────────────

export interface DailyBrief {
  id: string
  briefDate: string
  summary: string | null
  topPerformer: string | null
  competitorAlert: string | null
  ideaOfDay: string | null
  actionItems: string[]
  generatedAt: string
}

export const briefApi = {
  today: () => request<{ brief: DailyBrief | null }>('/api/brief/today'),
  generate: () => request<{ message: string }>('/api/brief/generate', { method: 'POST' }),
}

// ── Settings ──────────────────────────────────────────────────

export interface OrgSettings {
  id: string
  name: string
  slug: string
  industry: string | null
  brandColor: string | null
  city: string | null
  country: string | null
  timezone: string | null
  logoUrl: string | null
  activePlatforms: string[]
}

export interface TeamMember {
  id: string
  userId: string
  role: string
  joinedAt: string
  user: { id: string; email: string }
}

export const settingsApi = {
  getOrg: () => request<{ org: OrgSettings }>('/api/settings'),
  updateOrg: (body: Partial<OrgSettings>) =>
    request<{ org: OrgSettings }>('/api/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  listTeam: () => request<{ members: TeamMember[] }>('/api/settings/team'),
  inviteMember: (email: string, role: string) =>
    request<{ member: TeamMember }>('/api/settings/team/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
  updateRole: (userId: string, role: string) =>
    request<{ member: TeamMember }>(`/api/settings/team/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeMember: (userId: string) => request(`/api/settings/team/${userId}`, { method: 'DELETE' }),
}

// ── Special Days ──────────────────────────────────────────────
export interface SpecialDay {
  id: string
  name: string
  date: string
  category: string
  countries: string[]
  industries: string[]
  draftPostTemplate: string | null
}

export const specialDaysApi = {
  upcoming: (days = 30, country?: string, industry?: string) => {
    const params = new URLSearchParams({ days: String(days) })
    if (country) params.set('country', country)
    if (industry) params.set('industry', industry)
    return request<SpecialDay[]>(`/api/special-days/upcoming?${params}`)
  },
  byMonth: (month: number, year: number) =>
    request<SpecialDay[]>(`/api/special-days?month=${month}&year=${year}`),
}

// ── OPS (Online Presence Score) ───────────────────────────────

export interface OPSComponent {
  score: number
  weight: number
  label: string
  detail: string
}

export interface OPSBreakdown {
  overall: number
  components: {
    seoAuthority:       OPSComponent
    socialEngagement:   OPSComponent
    brandSentiment:     OPSComponent
    searchVisibility:   OPSComponent
    reviewReputation:   OPSComponent
    contentConsistency: OPSComponent
    websiteQuality:     OPSComponent
    trendParticipation: OPSComponent
  }
  recommendations: string[]
  tier: 'Building' | 'Developing' | 'Established' | 'Authority'
  calculatedAt: string
}

export const opsApi = {
  get: () => request<{ ops: OPSBreakdown }>('/api/ops'),
  recalc: () => request<{ ops: OPSBreakdown }>('/api/ops/recalc', { method: 'POST' }),
}

// ── Reputation ────────────────────────────────────────────────

export interface ReviewItem {
  source: string
  rating: number
  text: string
  date: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

export interface ReputationReport {
  overallRating: number
  totalReviews: number
  sentimentScore: number
  positiveCount: number
  neutralCount: number
  negativeCount: number
  ratingDistribution: Record<string, number>
  topThemes: string[]
  recentReviews: ReviewItem[]
  summary: string
  responseRecommendation: string
  sources: string[]
  fetchedAt: string
}

export const reputationApi = {
  get: () => request<{ reputation: ReputationReport }>('/api/reputation'),
  refresh: () => request<{ reputation: ReputationReport }>('/api/reputation/refresh', { method: 'POST' }),
}

// ── AI Trending Topics ────────────────────────────────────────

export interface AITrendingTopic {
  id: string
  topic: string
  category: string
  searchVolume: number
  trendDelta: number
  competitorsCovering: number
  suggestedPostDraft: string | null
  platform: string | null
  fetchedAt: string
}

export const trendsAiApi = {
  get: () => request<{ topics: AITrendingTopic[]; fromCache: boolean }>('/api/trends/ai'),
  discover: () => request<{ topics: AITrendingTopic[]; message: string }>('/api/trends/discover', { method: 'POST' }),
}

// ── Org research API ──────────────────────────────────────────

export const orgResearchApi = {
  /** Trigger a fresh deep-research scan for the active org */
  research: (orgId: string) =>
    request<{ success: boolean }>(`/api/orgs/${orgId}/research`, { method: 'POST' }),
  /** Fetch intelligence (auto-runs research if stale) */
  intelligence: (orgId: string) =>
    request<{ presenceScore: number; strengths: string[]; urgentIssues: unknown[]; quickWins: unknown[] }>(`/api/orgs/${orgId}/intelligence`),
}
// ── Saved Content Pieces ──────────────────────────────────────

export interface ContentPieceItem {
  id: string
  orgId: string
  type: string
  platform: string | null
  title: string
  content: string
  hashtags: string[]
  seoScore: number
  keywordTargeted: string | null
  status: string
  scheduledAt: string | null
  publishedAt: string | null
  externalUrl: string | null
  generatedByAI: boolean
  createdAt: string
  updatedAt: string
}

export const savedApi = {
  list: (type?: string) =>
    request<ContentPieceItem[]>(`/api/content-pieces${type ? `?type=${encodeURIComponent(type)}` : ''}`),
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/content-pieces/${id}`, { method: 'DELETE' }),
}

// ── Content Guardrails ────────────────────────────────────────

export interface ContentGuardrail {
  id: string
  orgId: string
  text: string
  category: 'VOICE' | 'LEGAL' | 'PLATFORM' | 'CONTENT' | 'CULTURAL'
  ruleType: string
  platform: string | null
  aiGenerated: boolean
  createdAt: string
  updatedAt: string
}

export const guardrailsApi = {
  list: () => request<ContentGuardrail[]>('/api/sprint/guardrails'),
  create: (data: { text: string; category: string; ruleType: string; platform?: string | null }) =>
    request<ContentGuardrail>('/api/sprint/guardrails', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { text?: string; category?: string; ruleType?: string; platform?: string | null }) =>
    request<ContentGuardrail>(`/api/sprint/guardrails/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/sprint/guardrails/${id}`, { method: 'DELETE' }),
  generate: () =>
    request<ContentGuardrail[]>('/api/sprint/guardrails/generate', { method: 'POST' }),
}

// ── Sprint Planner ────────────────────────────────────────────

export interface PlatformBrief {
  hook: string
  points: string[]
  caption: string
  hashtags: string[]
}

export interface SprintWeek {
  id: string
  sprintPlanId: string
  weekNumber: number
  theme: string
  whyNow: string
  notableDates: string[]
  platforms: Record<string, PlatformBrief>
}

export interface SprintPlan {
  id: string
  orgId: string
  startDate: string
  status: string
  weeks: SprintWeek[]
  createdAt: string
}

export const sprintApi = {
  getLatest: () => request<SprintPlan | null>('/api/sprint/latest'),
  generate: (startDate?: string) =>
    request<SprintPlan>('/api/sprint/generate', {
      method: 'POST',
      body: JSON.stringify({ startDate }),
    }),
  regenerateWeek: (sprintId: string, weekNumber: number) =>
    request<{ text: string }>('/api/sprint/regenerate-week', {
      method: 'POST',
      body: JSON.stringify({ sprintId, weekNumber }),
    }),
}
