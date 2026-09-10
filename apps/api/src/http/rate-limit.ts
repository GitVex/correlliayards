import type { FastifyInstance, FastifyRequest } from 'fastify'
import { HttpError } from './errors.js'

/* A rate limit for the public routes, which are the only unauthenticated
   surface this service has. Everything else costs an attacker a login first.
 *
 * Deliberately small and in-process. It is a fixed window over a Map keyed by
 * client address, which means: it does not survive a restart, and two instances
 * behind a load balancer each allow the full budget. Both are acceptable for
 * what this is actually defending — a published card being scraped in a tight
 * loop — and neither is worth a Redis dependency in a service that does not
 * otherwise have one.
 *
 * If the public surface ever needs a limit that is a real security control
 * rather than a courtesy, the thing to reach for is @fastify/rate-limit with a
 * shared store, and this goes away. */

interface Window {
  count: number
  /** Epoch milliseconds at which the count resets. */
  resetAt: number
}

export interface RateLimitOptions {
  /** Requests allowed per window, per client. */
  max: number
  windowMs: number
}

export function createRateLimiter(options: RateLimitOptions) {
  const windows = new Map<string, Window>()

  /* Sweep on write rather than on a timer: an interval would keep the event
     loop alive and has to be cleaned up on shutdown, and the map only grows
     when requests arrive anyway. */
  function sweep(now: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key)
    }
  }

  return function check(request: FastifyRequest): void {
    /* request.ip, which is request.socket's address unless trustProxy is set —
       and it is, in production, which is the only place this matters. Behind
       Coolify's proxy an untrusting server sees the proxy as every caller, so
       this map would hold one window for the whole internet and the budget
       below would be shared by everyone rather than held per client. See
       `trustProxy` in config.ts for why that is a deployment fact rather than a
       setting anyone should be choosing per environment. */
    const key = request.ip
    const now = Date.now()

    const existing = windows.get(key)
    if (!existing || existing.resetAt <= now) {
      if (windows.size > 10_000) sweep(now)
      windows.set(key, { count: 1, resetAt: now + options.windowMs })
      return
    }

    existing.count += 1
    if (existing.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
      const error = new HttpError(
        429,
        'rate_limited',
        `Too many requests. Try again in ${retryAfter}s.`,
      )
      /* Retry-After is what makes a 429 actionable rather than a wall: a
         well-behaved client backs off by exactly this much instead of guessing
         or hammering. */
      throw Object.assign(error, { retryAfter })
    }
  }
}

/** Apply a limiter to every route in one Fastify scope.
 *
 *  onRequest, the earliest hook there is: a limited request should cost this
 *  service a Map lookup, not a body parse and a database round trip. */
export function registerRateLimit(scope: FastifyInstance, options: RateLimitOptions): void {
  const check = createRateLimiter(options)

  scope.addHook('onRequest', async (request, reply) => {
    try {
      check(request)
    } catch (error) {
      if (error instanceof HttpError && 'retryAfter' in error) {
        reply.header('retry-after', String(error.retryAfter))
      }
      throw error
    }
  })
}
