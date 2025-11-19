package middleware

import (
	"net/http"
	"sync"
	"time"
)

type rateLimiter struct {
	visitors map[string]*visitor
	mu       sync.RWMutex
	rate     int
	burst    int
}

type visitor struct {
	limiter  *tokenBucket
	lastSeen time.Time
}

type tokenBucket struct {
	tokens     int
	maxTokens  int
	refillRate int
	lastRefill time.Time
	mu         sync.Mutex
}

func NewRateLimiter(requestsPerMinute, burst int) *rateLimiter {
	rl := &rateLimiter{
		visitors: make(map[string]*visitor),
		rate:     requestsPerMinute,
		burst:    burst,
	}

	// Cleanup old visitors every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			rl.cleanup()
		}
	}()

	return rl
}

func (rl *rateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			ip = xff
		}

		rl.mu.Lock()
		v, exists := rl.visitors[ip]
		if !exists {
			v = &visitor{
				limiter: &tokenBucket{
					tokens:     rl.burst,
					maxTokens:  rl.burst,
					refillRate: rl.rate,
					lastRefill: time.Now(),
				},
				lastSeen: time.Now(),
			}
			rl.visitors[ip] = v
		}
		v.lastSeen = time.Now()
		rl.mu.Unlock()

		if !v.limiter.allow() {
			http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (tb *tokenBucket) allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	// Refill tokens
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill)
	newTokens := int(elapsed.Minutes() * float64(tb.refillRate))
	if newTokens > 0 {
		tb.tokens += newTokens
		if tb.tokens > tb.maxTokens {
			tb.tokens = tb.maxTokens
		}
		tb.lastRefill = now
	}

	if tb.tokens > 0 {
		tb.tokens--
		return true
	}

	return false
}

func (rl *rateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	for ip, v := range rl.visitors {
		if time.Since(v.lastSeen) > 5*time.Minute {
			delete(rl.visitors, ip)
		}
	}
}
