import type { RateLimiterMetrics, RateLimiterPort } from '../domain/ports.js';
import type { CdnRateLimitDecision, CdnRateLimitPolicy, CdnRateLimitTier } from '../domain/rateLimit.js';

/** Cloudflare Workers Rate Limiting API binding contract (`ratelimits` in wrangler.jsonc). */
export interface CfRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type CfRateLimitBindings = Partial<Record<CdnRateLimitTier, CfRateLimitBinding | undefined>>;

interface IsolateWindow {
  windowStartMs: number;
  prevCount: number;
  currCount: number;
}

/**
 * Bounded weighted sliding-window counter used as an automatic in-isolate fallback
 * when Cloudflare native `ratelimits` bindings are not configured (e.g. local dev / tests)
 * or fail transiently.
 */
export class IsolateSlidingWindowCounter {
  private readonly buckets = new Map<string, IsolateWindow>();

  constructor(private readonly maxEntries = 4096) {}

  consume(
    key: string,
    limit: number,
    periodSeconds: number,
    nowMs: number
  ): { allowed: boolean; remaining: number; resetDeltaSeconds: number } {
    const windowMs = periodSeconds * 1000;
    const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
    const resetDeltaSeconds = Math.max(1, Math.ceil((windowStartMs + windowMs - nowMs) / 1000));

    const existing = this.buckets.get(key);
    let entry: IsolateWindow;
    if (!existing) {
      entry = { windowStartMs, prevCount: 0, currCount: 0 };
    } else if (existing.windowStartMs === windowStartMs) {
      entry = existing;
      this.buckets.delete(key);
    } else if (existing.windowStartMs === windowStartMs - windowMs) {
      entry = { windowStartMs, prevCount: existing.currCount, currCount: 0 };
      this.buckets.delete(key);
    } else {
      entry = { windowStartMs, prevCount: 0, currCount: 0 };
      this.buckets.delete(key);
    }

    const elapsed = Math.max(0, nowMs - windowStartMs);
    const weight = Math.max(0, 1 - elapsed / windowMs);
    const est = entry.prevCount * weight + entry.currCount;

    if (est + 1 > limit) {
      this.insertBounded(key, entry);
      return { allowed: false, remaining: 0, resetDeltaSeconds };
    }

    entry.currCount += 1;
    this.insertBounded(key, entry);
    const remaining = Math.max(0, Math.floor(limit - (entry.prevCount * weight + entry.currCount)));
    return { allowed: true, remaining, resetDeltaSeconds };
  }

  private insertBounded(key: string, entry: IsolateWindow): void {
    if (this.buckets.size >= this.maxEntries) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }
    this.buckets.set(key, entry);
  }
}

export class CloudflareRateLimiter implements RateLimiterPort {
  private evaluated = 0;
  private allowed = 0;
  private limited429 = 0;
  private bindingErrors = 0;
  private isolateFallbackHits = 0;
  private readonly limitedByTier = new Map<string, number>();

  constructor(
    private readonly bindings: CfRateLimitBindings = {},
    private readonly fallback = new IsolateSlidingWindowCounter(),
    private readonly nowMs: () => number = () => Date.now()
  ) {}

  async check(key: string, policy: CdnRateLimitPolicy): Promise<CdnRateLimitDecision> {
    this.evaluated += 1;
    const now = this.nowMs();
    const scopedKey = `${policy.tier}:${key}`;
    const binding = this.bindings[policy.tier];

    if (binding) {
      try {
        const outcome = await binding.limit({ key: scopedKey });
        const windowMs = policy.periodSeconds * 1000;
        const windowEnd = (Math.floor(now / windowMs) + 1) * windowMs;
        const resetDeltaSeconds = Math.max(1, Math.ceil((windowEnd - now) / 1000));

        if (!outcome.success) {
          this.limited429 += 1;
          this.limitedByTier.set(policy.tier, (this.limitedByTier.get(policy.tier) ?? 0) + 1);
          return {
            allowed: false,
            policy,
            remaining: 0,
            resetDeltaSeconds,
            mode: 'cf-binding',
          };
        }

        this.allowed += 1;
        return {
          allowed: true,
          policy,
          remaining: Math.max(1, policy.limit - 1),
          resetDeltaSeconds,
          mode: 'cf-binding',
        };
      } catch {
        this.bindingErrors += 1;
        // Fall through cleanly to bounded in-isolate sliding-window fallback
      }
    }

    this.isolateFallbackHits += 1;
    const local = this.fallback.consume(scopedKey, policy.limit, policy.periodSeconds, now);
    if (!local.allowed) {
      this.limited429 += 1;
      this.limitedByTier.set(policy.tier, (this.limitedByTier.get(policy.tier) ?? 0) + 1);
    } else {
      this.allowed += 1;
    }

    return {
      allowed: local.allowed,
      policy,
      remaining: local.remaining,
      resetDeltaSeconds: local.resetDeltaSeconds,
      mode: 'isolate-fallback',
    };
  }

  metrics(): RateLimiterMetrics {
    const limitedByTier: Record<string, number> = {};
    for (const [tier, count] of this.limitedByTier.entries()) {
      limitedByTier[tier] = count;
    }
    return {
      evaluated: this.evaluated,
      allowed: this.allowed,
      limited429: this.limited429,
      limitedByTier,
      bindingErrors: this.bindingErrors,
      isolateFallbackHits: this.isolateFallbackHits,
    };
  }
}

const ENCODER = new TextEncoder();

type SubtleWithTimingSafe = SubtleCrypto & {
  timingSafeEqual?: (a: ArrayBufferView | ArrayBuffer, b: ArrayBufferView | ArrayBuffer) => boolean;
};

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = ENCODER.encode(a);
  const bufB = ENCODER.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  const subtle = crypto.subtle as SubtleWithTimingSafe;
  if (typeof subtle.timingSafeEqual === 'function') {
    return subtle.timingSafeEqual(bufA, bufB);
  }
  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i]! ^ bufB[i]!;
  }
  return diff === 0;
}

/**
 * Extract the non-spoofable client IP on Cloudflare Workers:
 * - When proxied through our trusted Railway Caddy gateway with a valid shared
 *   `X-Gateway-Proxy-Secret` (constant-time verified), trust `X-Gateway-Client-IP` so
 *   every visitor gets their own rate-limit bucket instead of sharing Caddy's egress IP.
 * - Otherwise (direct Cloudflare Custom Domain or direct `*.workers.dev`), ignore
 *   `X-Gateway-Client-IP` and prioritize `CF-Connecting-IP` (overwritten by Cloudflare edge).
 */
export function extractCdnClientKey(request: Request, gatewayProxySecret?: string): string {
  if (gatewayProxySecret && gatewayProxySecret.length >= 16) {
    const presented = request.headers.get('x-gateway-proxy-secret') || '';
    if (presented && timingSafeEqualString(presented, gatewayProxySecret)) {
      const gwIp = request.headers.get('x-gateway-client-ip')?.trim();
      if (gwIp) return `ip:${gwIp.slice(0, 64)}`;
    }
  }

  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return `ip:${cfIp.slice(0, 64)}`;

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return `ip:${realIp.slice(0, 64)}`;

  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xff) return `ip:${xff.slice(0, 64)}`;

  return 'ip:unknown';
}
