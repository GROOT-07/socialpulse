/**
 * Centralized Google Gemini AI Router
 *
 * Single entry-point for ALL AI calls across the platform.
 * Never call Gemini directly from services — always use this module.
 *
 * Models (configurable via env):
 *   PRO   → GEMINI_PRO_MODEL   (default: gemini-2.5-pro)
 *   FLASH → GEMINI_FLASH_MODEL (default: gemini-2.5-flash)
 *
 * Features:
 *   • Exponential-backoff retry (3 attempts)
 *   • Per-minute rate limiting (60 rpm by default)
 *   • JSON extraction helper
 *   • Streaming support
 *   • Flash vs Pro routing
 */

import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type GenerationConfig,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai'

// ── Model names ───────────────────────────────────────────────

export const GEMINI_PRO_MODEL =
  process.env.GEMINI_PRO_MODEL ?? 'gemini-2.5-pro'

export const GEMINI_FLASH_MODEL =
  process.env.GEMINI_FLASH_MODEL ?? 'gemini-2.5-flash'

// ── Safety settings — keep permissive for business content ────

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
]

// ── Rate limiter (simple token bucket) ───────────────────────

class RateLimiter {
  private queue: Array<() => void> = []
  private running = 0
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
  Number(process.env.GEMINI_RPM ?? 60),
)

// ── Client factory ────────────────────────────────────────────

let _genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
    _genAI = new GoogleGenerativeAI(apiKey)
  }
  return _genAI
}

function getModel(modelName: string, config?: GenerationConfig): GenerativeModel {
  return getGenAI().getGenerativeModel({
    model: modelName,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: config,
  })
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
          err.message.includes('RESOURCE_EXHAUSTED') ||
          err.message.includes('overloaded'))

      if (!isRetryable || i === attempts - 1) break

      const delay = Math.pow(2, i) * 1000 + Math.random() * 500
      console.warn(`[Gemini] Attempt ${i + 1} failed, retrying in ${Math.round(delay)}ms…`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

// ── Text extraction ───────────────────────────────────────────

function extractText(result: { response: { text: () => string } }): string {
  return result.response.text().trim()
}

// ── JSON extraction helper ────────────────────────────────────

export function extractJSON<T>(text: string): T {
  // Try markdown fence first
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence?.[1]) return JSON.parse(fence[1].trim()) as T

  // Try bare object / array
  const obj = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (obj?.[0]) return JSON.parse(obj[0].trim()) as T

  throw new Error('No JSON found in Gemini response')
}

// ── Public API ────────────────────────────────────────────────

export interface AskOptions {
  model?: 'pro' | 'flash'
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

/**
 * Single-turn text completion — the main function used by all services.
 */
export async function ask(prompt: string, options: AskOptions = {}): Promise<string> {
  const {
    model = 'pro',
    maxTokens = 2048,
    temperature = 0.7,
    systemPrompt,
  } = options

  const modelName = model === 'flash' ? GEMINI_FLASH_MODEL : GEMINI_PRO_MODEL

  const genConfig: GenerationConfig = {
    maxOutputTokens: maxTokens,
    temperature,
  }

  const geminiModel = getModel(modelName, genConfig)

  const parts: string[] = []
  if (systemPrompt) parts.push(`${systemPrompt}\n\n`)
  parts.push(prompt)

  return withRetry(async () => {
    const result = await geminiModel.generateContent(parts.join(''))
    return extractText(result)
  })
}

/**
 * ask() variant that automatically extracts and parses JSON.
 */
export async function askJSON<T>(prompt: string, options: AskOptions = {}): Promise<T> {
  const jsonOptions = {
    ...options,
    systemPrompt: options.systemPrompt
      ? `${options.systemPrompt}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown fences, no explanation.`
      : 'You are a helpful assistant. Respond with ONLY valid JSON. No markdown fences, no explanation.',
    temperature: options.temperature ?? 0.3,  // lower temp = more deterministic JSON
  }
  const text = await ask(prompt, jsonOptions)
  return extractJSON<T>(text)
}

/**
 * Fast Flash completion — for short summaries, quick classifications, etc.
 */
export async function flash(prompt: string, maxTokens = 512): Promise<string> {
  return ask(prompt, { model: 'flash', maxTokens, temperature: 0.5 })
}

/**
 * Streaming response — yields text chunks as they arrive.
 * Use in Express routes that support SSE / chunked transfer.
 */
export async function* stream(
  prompt: string,
  options: AskOptions = {},
): AsyncGenerator<string> {
  const modelName = options.model === 'flash' ? GEMINI_FLASH_MODEL : GEMINI_PRO_MODEL
  const geminiModel = getModel(modelName, {
    maxOutputTokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
  })

  const parts: string[] = []
  if (options.systemPrompt) parts.push(`${options.systemPrompt}\n\n`)
  parts.push(prompt)

  await rateLimiter.acquire()
  const result = await geminiModel.generateContentStream(parts.join(''))
  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) yield text
  }
}

/**
 * Health check — returns true if GEMINI_API_KEY is set and reachable.
 */
export async function ping(): Promise<boolean> {
  try {
    await flash('Say "ok"', 10)
    return true
  } catch {
    return false
  }
}

export const isConfigured = (): boolean => !!process.env.GEMINI_API_KEY
