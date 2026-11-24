export type CdnRateLimitTier = 'assets' | 'img' | 'private';

export interface CdnRateLimitPolicy {
  readonly tier: CdnRateLimitTier;
  readonly limit: number;
  readonly periodSeconds: 10 | 60;
}

export const CDN_RATE_LIMIT_POLICIES: Record<CdnRateLimitTier, CdnRateLimitPolicy> = {
  assets: { tier: 'assets', limit: 300, periodSeconds: 60 },
  img: { tier: 'img', limit: 60, periodSeconds: 60 },
  private: { tier: 'private', limit: 120, periodSeconds: 60 },
};

/**
 * Select the CDN rate-limit policy for an incoming request, or `null` if exempt.
 *
 * - `OPTIONS` and `/health` probes are exempt.
 * - `/img/*` (CPU-intensive on-the-fly imgproxy transforms) gets the tightest tier (60/60s).
 * - `/private/*` (HMAC-signed URLs) gets a mid tier (120/60s) to deter signature probing.
 * - `/assets/*` (edge-cached public objects) gets a generous burst tier (300/60s).
 */
export function classifyCdnRateLimitPolicy(
  method: string,
  pathname: string
): CdnRateLimitPolicy | null {
  if (method.toUpperCase() === 'OPTIONS') return null;
  if (pathname === '/health' || pathname === '/health/metrics') return null;
  if (pathname.startsWith('/img/')) return CDN_RATE_LIMIT_POLICIES.img;
  if (pathname.startsWith('/private/')) return CDN_RATE_LIMIT_POLICIES.private;
  if (pathname.startsWith('/assets/')) return CDN_RATE_LIMIT_POLICIES.assets;
  return null;
}

export interface CdnRateLimitDecision {
  readonly allowed: boolean;
  readonly policy: CdnRateLimitPolicy;
  readonly remaining: number;
  readonly resetDeltaSeconds: number;
  readonly mode: 'cf-binding' | 'isolate-fallback' | 'fail-open';
}

/**
 * Apply standard IETF draft `RateLimit-*` + `RateLimit-Policy`, legacy `X-RateLimit-*`,
 * and RFC 9110 `Retry-After` (when 429) to a `Headers` instance.
 */
export function applyCdnRateLimitHeaders(
  headers: Headers,
  decision: CdnRateLimitDecision
): void {
  const remaining = Math.max(0, decision.remaining);
  const reset = Math.max(1, decision.resetDeltaSeconds);

  headers.set('RateLimit-Limit', String(decision.policy.limit));
  headers.set('RateLimit-Remaining', String(remaining));
  headers.set('RateLimit-Reset', String(reset));
  headers.set('RateLimit-Policy', `${decision.policy.limit};w=${decision.policy.periodSeconds}`);
  headers.set('X-RateLimit-Limit', String(decision.policy.limit));
  headers.set('X-RateLimit-Remaining', String(remaining));
  headers.set('X-RateLimit-Reset', String(reset));

  if (!decision.allowed) {
    headers.set('Retry-After', String(reset));
  }
}
