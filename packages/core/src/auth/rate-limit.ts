import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyFn?: (req: Request) => string;
}

/**
 * In-memory sliding-window rate limiter.
 * Uses a Map with periodic cleanup to avoid unbounded memory growth.
 */
export function rateLimiter(options: RateLimiterOptions) {
  const { windowMs, maxRequests, keyFn } = options;
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup every 60 seconds
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000);

  // Allow the timer to not prevent Node from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn ? keyFn(req) : req.ip ?? 'unknown';
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Set rate-limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'too_many_requests',
        message: 'Rate limit exceeded. Try again later.',
        retryAfter,
      });
      return;
    }

    next();
  };
}

// ─── Pre-configured limiters ───

/** 10 attempts per minute per IP — for login routes */
export const loginRateLimiter = rateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});

/** 1000 requests per minute per token/IP — for general CMA API */
export const apiRateLimiter = rateLimiter({
  windowMs: 60_000,
  maxRequests: 1000,
  keyFn: (req) => {
    // Use the auth token (if present) as key, else fall back to IP
    const auth = req.headers.authorization;
    if (auth) return auth;
    return req.ip ?? 'unknown';
  },
});

/** 20 uploads per minute per token — for upload routes */
export const uploadRateLimiter = rateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  keyFn: (req) => {
    const auth = req.headers.authorization;
    if (auth) return `upload:${auth}`;
    return `upload:${req.ip ?? 'unknown'}`;
  },
});
