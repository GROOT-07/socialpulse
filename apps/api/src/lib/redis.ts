import Redis, { type RedisOptions } from 'ioredis'

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined
  // eslint-disable-next-line no-var
  var __redisWorker: Redis | undefined
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

function makeRedis(opts: RedisOptions): Redis {
  const client = new Redis(REDIS_URL, opts)
  // Prevent unhandled 'error' events from crashing the process.
  // Connection failures are expected when Redis is temporarily unavailable.
  client.on('error', (err: Error) => {
    console.error('[redis] connection error:', err.message)
  })
  return client
}

// Standard connection — used by Queues and general cache ops
export const redis =
  global.__redis ??
  makeRedis({
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  })

// Worker connection — BullMQ Workers require maxRetriesPerRequest: null
export const redisWorker =
  global.__redisWorker ??
  makeRedis({
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  })

if (process.env.NODE_ENV !== 'production') {
  global.__redis = redis
  global.__redisWorker = redisWorker
}

// Cache helpers
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const value = await redis.get(key)
  if (!value) return null
  return JSON.parse(value) as T
}

export const cacheSet = async (key: string, value: unknown, ttlSeconds = 3600): Promise<void> => {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
}

export const cacheDel = async (key: string): Promise<void> => {
  await redis.del(key)
}
