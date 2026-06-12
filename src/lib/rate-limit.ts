import type { Redis } from '@upstash/redis'

/**
 * Fixed-window rate limiter backed by Redis INCR + EXPIRE.
 *
 * Returns true when the request is allowed, false when the limit is exceeded.
 * Fails OPEN: if Redis errors, the request is allowed rather than blocked.
 */
export async function rateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }
    return count <= limit
  } catch {
    // Fail open: a Redis outage should not take down the endpoint.
    return true
  }
}

/** Best-effort client IP from the first x-forwarded-for entry (Vercel sets it). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return 'unknown'
}
