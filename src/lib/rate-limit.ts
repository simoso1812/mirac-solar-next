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

/**
 * Best-effort client IP. Assumes deployment behind Vercel's trusted edge:
 * prefer x-real-ip (set by Vercel, not client-settable through the edge) and
 * fall back to the RIGHTMOST x-forwarded-for entry — the one appended by the
 * trusted proxy. The leftmost entries are client-supplied and trivially
 * spoofable, which would let an attacker rotate rate-limit buckets at will.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return last
  }
  return 'unknown'
}
