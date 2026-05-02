/**
 * Startup validation — runs once before the server begins listening.
 *
 * Required vars   → throw (server cannot function without them)
 * Optional vars   → warn (feature degrades gracefully, server still starts)
 */

interface EnvCheck {
  key: string
  required: boolean
  feature?: string // human label shown in the warning
}

const ENV_CHECKS: EnvCheck[] = [
  // ── Hard requirements ─────────────────────────────────────
  { key: 'DATABASE_URL',        required: true },
  { key: 'JWT_SECRET',          required: true },
  { key: 'JWT_REFRESH_SECRET',  required: true },
  { key: 'ENCRYPTION_KEY',      required: true },
  { key: 'REDIS_URL',           required: true },

  // ── Social OAuth (features degrade if absent) ─────────────
  { key: 'META_APP_ID',         required: false, feature: 'Instagram / Facebook OAuth' },
  { key: 'META_APP_SECRET',     required: false, feature: 'Instagram / Facebook OAuth' },
  { key: 'GOOGLE_CLIENT_ID',    required: false, feature: 'YouTube OAuth' },
  { key: 'GOOGLE_CLIENT_SECRET',required: false, feature: 'YouTube OAuth' },

  // ── AI ────────────────────────────────────────────────────
  { key: 'GEMINI_API_KEY',      required: false, feature: 'Gemini AI (strategy, ideas, brief)' },

  // ── Competitor data ───────────────────────────────────────
  { key: 'DATA365_API_KEY',     required: false, feature: 'Competitor intelligence (Data365)' },

  // ── Email / SMTP ──────────────────────────────────────────
  { key: 'SMTP_HOST',           required: false, feature: 'Email (password reset)' },
  { key: 'SMTP_USER',           required: false, feature: 'Email (password reset)' },
  { key: 'SMTP_PASS',           required: false, feature: 'Email (password reset)' },
]

export function validateEnv(): void {
  const missing: string[] = []
  const warnings: string[] = []

  for (const check of ENV_CHECKS) {
    const val = process.env[check.key]
    if (!val || val.trim() === '') {
      if (check.required) {
        missing.push(check.key)
      } else {
        warnings.push(
          `  ⚠  ${check.key} not set — ${check.feature ?? check.key} will be unavailable`,
        )
      }
    }
  }

  if (warnings.length) {
    console.warn('\n[startup] Optional env vars missing — some features will be disabled:')
    warnings.forEach((w) => console.warn(w))
    console.warn('')
  }

  if (missing.length) {
    console.error('\n[startup] FATAL — required env vars are not set:')
    missing.forEach((k) => console.error(`  ✗  ${k}`))
    console.error('\nSet these variables and restart the server.\n')
    process.exit(1)
  }

  // Validate ENCRYPTION_KEY length (must be exactly 32 chars for AES-256)
  const encKey = process.env.ENCRYPTION_KEY ?? ''
  if (encKey.length !== 32) {
    console.error(`[startup] FATAL — ENCRYPTION_KEY must be exactly 32 characters (got ${encKey.length})`)
    process.exit(1)
  }
}

/** Starts workers in a try/catch so a Redis outage doesn't kill the HTTP server. */
export async function startWorkersSafely(
  starters: Array<{ name: string; start: () => void }>,
): Promise<void> {
  for (const { name, start } of starters) {
    try {
      start()
      console.info(`[startup] ✅ ${name} started`)
    } catch (err) {
      console.error(
        `[startup] ❌ ${name} failed to start — HTTP API will still serve requests:`,
        (err as Error).message,
      )
    }
  }
}
