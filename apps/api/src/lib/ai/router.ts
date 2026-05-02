/**
 * Centralized OpenAI AI Router
 *
 * Single entry-point for ALL AI calls across the platform.
 * Never call OpenAI directly from services — always use this module.
 *
 * Models (configurable via env):
 *   PRIMARY → OPENAI_PRIMARY_MODEL (default: gpt-4.5)
 *   FAST    → OPENAI_FAST_MODEL    (default: gpt-4.5-mini)
 *
 * Features:
 *   • Exponential-backoff retry (3 attempts)
 *   • Per-minute rate limiting (60 rpm by default)
 *   • Redis response caching (opt-in, 6-hour TTL)
 *   • JSON extraction helper
 *   • Streaming support (AsyncGenerator)
 *   • Feature→model routing table
 */

import OpenAI from 'openai'
import { redis } from '../redis'

// ── Model registry ────────────────────────────────────────────

export const AI_MODELS = {
  PRIMARY: process.env.OPENAI_PRIMARY_MODEL ?? 'gpt-4.5',
  FAST:    process.env.OPENAI_FAST_MODEL    ?? 'gpt-4.5-mini',
} as const

export type AIModelKey = keyof typeof AI_MODELS

// Feature → model routing
const FEATURE_MODEL_MAP: Record<string, AIModelKey> = {
  // Heavy reasoning → PRIMARY
  'gap-analysis':      'PRIMARY',
  'playbook-section':  'PRIMARY',
  'blog-draft':        'PRIMARY',
  'platform-audit':    'PRIMARY',
  'brand-voice':       'PRIMARY',
  'seo-brief':         'PRIMARY',
  'smart-calendar':    'PRIMARY',
  'video-script':      'PRIMARY',
  'social-posts':      'PRIMARY',
  'reputation-report': 'PRIMARY',
  'deep-research':     'PRIMARY',
  'sprint-plan':       'PRIMARY',
  'sprint-week':       'PRIMARY',
  'meeting-analysis':  'PRIMARY',
  'blog-outline':      'PRIMARY',
  // Fast tasks → FAST
  'daily-brief':       'FAST',
  'content-ideas':     'FAST',
  'persona':           'FAST',
  'trending-ideas':    'FAST',
  'whatsapp-message':  'FAST',
  'outreach-message':  'FAST',
  'web-intelligence':  'FAST',
  'trend-discovery':   'FAST',
  'note-enhance':      'FAST',
}

export function modelForFeature(feature: string): string {
  const key = FEATURE_MODEL_MAP[feature] ?? 'PRIMARY'
  return AI_MODELS[key]
}

// ── Error class ───────────────────────────────────────────────

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

// ── Rate limiter (token bucket) ───────────────────────────────

class RateLimiter {
  private queue: Array<() => void> = []
  private readonly max: number
  private readonly windowMs: number
  private timestamps: number[] = []

  constructor(requestsPerMinute = 60) {
    this.max = requestsPerMinute
    this.windowMs = 60_000
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve)
      this.tick()
    })
  }

  private tick() {
    const now = Date.now()
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs)

    if (this.timestamps.length < this.max && this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) {
        this.timestamps.push(now)
        next()
      }
    } else if (this.queue.length > 0) {
      const wait = this.windowMs - (now - (this.timestamps[0] ?? now))
      setTimeout(() => this.tick(), Math.max(0, wait))
    }
  }
}

const rateLimiter = new RateLimiter(
  Number(process.env.OPENAI_RPM ?? 60),
)

// ── OpenAI client factory ─────────────────────────────────────

let _openai: OpenAI | null = null

function getClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new AIServiceError('OPENAI_API_KEY is not configured', 'NO_API_KEY')
    _openai = new OpenAI({
      apiKey,
      organization: process.env.OPENAI_ORG_ID,
    })
  }
  return _openai
}

// ── Retry wrapper ─────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      await rateLimiter.acquire()
      return await fn()
    } catch (err) {
      lastError = err
      const isRetryable =
        err instanceof Error &&
        (err.message.includes('429') ||
          err.message.includes('503') ||
          err.message.includes('overloaded') ||
          err.message.includes('rate_limit'))

      if (!isRetryable || i === attempts - 1) break

      const delay = Math.pow(2, i) * 1000 + Math.random() * 500
      console.warn(`[AI Router] Attempt ${i + 1} failed, retrying in ${Math.round(delay)}ms…`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError instanceof AIServiceError
    ? lastError
    : new AIServiceError(
        (lastError as Error)?.message ?? 'AI call failed',
        'COMPLETION_FAILED',
        false,
        lastError,
      )
}

// ── Redis cache helpers ───────────────────────────────────────

const CACHE_TTL_SECONDS = 60 * 60 * 6 // 6 hours

async function getCached(key: string): Promise<string | null> {
  try {
    return await redis.get(`ai:cache:${key}`)
  } catch {
    return null // never block a real call on cache failure
  }
}

async function setCached(key: string, value: string): Promise<void> {
  try {
    await redis.set(`ai:cache:${key}`, value, 'EX', CACHE_TTL_SECONDS)
  } catch {
    // non-fatal
  }
}

function makeCacheKey(prompt: string, model: string, temperature: number): string {
  const raw = `${model}:${temperature}:${prompt.slice(0, 200)}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  return `${Math.abs(hash)}`
}

// ── Public options interfaces ─────────────────────────────────

export interface AiCompleteOptions {
  /** Exact model name (overrides feature routing) */
  model?: string
  /** Feature key for automatic model routing */
  feature?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  /** Cache deterministic responses in Redis for 6 hours */
  cache?: boolean
  /** Reserved for future token-usage tracking */
  orgId?: string
}

// ── Core completion ───────────────────────────────────────────

/**
 * Single-turn text completion — the primary function used by all services.
 */
export async function aiComplete(prompt: string, options: AiCompleteOptions = {}): Promise<string> {
  const {
    feature,
    maxTokens = 2048,
    temperature = 0.7,
    systemPrompt,
    cache = false,
  } = options

  const model = options.model ?? (feature ? modelForFeature(feature) : AI_MODELS.PRIMARY)

  if (cache) {
    const cached = await getCached(makeCacheKey(prompt, model, temperature))
    if (cached) return cached
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const text = await withRetry(async () => {
    const client = getClient()
    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    })
    const content = response.choices[0]?.message?.content ?? ''
    if (!content) throw new AIServiceError('Empty response from OpenAI', 'EMPTY_RESPONSE')
    return content.trim()
  })

  if (cache) await setCached(makeCacheKey(prompt, model, temperature), text)
  return text
}

/**
 * Streaming completion — yields text chunks as they arrive.
 * Use in Express routes that support SSE / chunked transfer.
 */
export async function* aiStream(
  prompt: string,
  options: AiCompleteOptions = {},
): AsyncGenerator<string> {
  const {
    feature,
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt,
  } = options

  const model = options.model ?? (feature ? modelForFeature(feature) : AI_MODELS.PRIMARY)

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  await rateLimiter.acquire()
  const client = getClient()
  const streamed = await client.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  })

  for await (const chunk of streamed) {
    const text = chunk.choices[0]?.delta?.content ?? ''
    if (text) yield text
  }
}

// ── JSON extraction helper ────────────────────────────────────

export function extractJSON<T>(text: string): T {
  // Try markdown fence first
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence?.[1]) return JSON.parse(fence[1].trim()) as T

  // Try bare object / array
  const obj = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (obj?.[0]) return JSON.parse(obj[0].trim()) as T

  throw new AIServiceError('No JSON found in AI response', 'JSON_PARSE_ERROR')
}

// ── Backward-compatible interface (mirrors original AI client API) ─────────
// All services that currently import ask/askJSON/flash/stream keep working
// without any changes to their import paths or call sites.

export interface AskOptions {
  model?: 'pro' | 'flash'
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

function resolveModel(model?: 'pro' | 'flash'): string {
  return model === 'flash' ? AI_MODELS.FAST : AI_MODELS.PRIMARY
}

/**
 * Single-turn text completion (compat wrapper).
 * 'pro'   → AI_MODELS.PRIMARY
 * 'flash' → AI_MODELS.FAST
 */
export async function ask(prompt: string, options: AskOptions = {}): Promise<string> {
  return aiComplete(prompt, {
    model: resolveModel(options.model),
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    systemPrompt: options.systemPrompt,
  })
}

/**
 * ask() variant that auto-extracts and parses JSON (compat wrapper).
 */
export async function askJSON<T>(prompt: string, options: AskOptions = {}): Promise<T> {
  const jsonOptions: AskOptions = {
    ...options,
    systemPrompt: options.systemPrompt
      ? `${options.systemPrompt}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown fences, no explanation.`
      : 'You are a helpful assistant. Respond with ONLY valid JSON. No markdown fences, no explanation.',
    temperature: options.temperature ?? 0.3,
  }
  const text = await ask(prompt, jsonOptions)
  return extractJSON<T>(text)
}

/**
 * Fast FAST-model completion for short tasks (compat wrapper).
 */
export async function flash(prompt: string, maxTokens = 512): Promise<string> {
  return aiComplete(prompt, { model: AI_MODELS.FAST, maxTokens, temperature: 0.5 })
}

/**
 * Streaming generator (compat wrapper).
 */
export async function* stream(
  prompt: string,
  options: AskOptions = {},
): AsyncGenerator<string> {
  yield* aiStream(prompt, {
    model: resolveModel(options.model),
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    systemPrompt: options.systemPrompt,
  })
}

/**
 * Health check — returns true if OPENAI_API_KEY is set and reachable.
 */
export async function ping(): Promise<boolean> {
  try {
    await flash('Say "ok"', 10)
    return true
  } catch {
    return false
  }
}

export const isConfigured = (): boolean => !!process.env.OPENAI_API_KEY
