package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiter(t *testing.T) {
	rl := NewRateLimiter(2, 2) // 2 requests per minute, burst of 2

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := rl.Middleware(handler)

	// First two requests should succeed (burst)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:1234"
		w := httptest.NewRecorder()

		middleware.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Request %d: expected status 200, got %d", i+1, w.Code)
		}
	}

	// Third request should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:1234"
	w := httptest.NewRecorder()

	middleware.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("Expected status 429, got %d", w.Code)
	}
}

func TestRateLimiterDifferentIPs(t *testing.T) {
	rl := NewRateLimiter(1, 1)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := rl.Middleware(handler)

	ips := []string{"192.168.1.1:1234", "192.168.1.2:1234", "192.168.1.3:1234"}

	// Each IP should get one request
	for _, ip := range ips {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = ip
		w := httptest.NewRecorder()

		middleware.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("IP %s: expected status 200, got %d", ip, w.Code)
		}
	}
}

func TestRateLimiterXForwardedFor(t *testing.T) {
	rl := NewRateLimiter(1, 1)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := rl.Middleware(handler)

	// First request
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.1")
	w := httptest.NewRecorder()

	middleware.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("First request: expected status 200, got %d", w.Code)
	}

	// Second request with same X-Forwarded-For should be rate limited
	req = httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "10.0.0.2:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.1")
	w = httptest.NewRecorder()

	middleware.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("Second request: expected status 429, got %d", w.Code)
	}
}

func TestTokenBucketRefill(t *testing.T) {
	tb := &tokenBucket{
		tokens:     0,
		maxTokens:  10,
		refillRate: 60, // 60 per minute = 1 per second
		lastRefill: time.Now().Add(-2 * time.Second),
	}

	// After 2 seconds, should have ~2 tokens
	allowed := tb.allow()
	if !allowed {
		t.Error("Expected to allow request after refill")
	}

	if tb.tokens < 0 {
		t.Errorf("Tokens should be >= 0, got %d", tb.tokens)
	}
}

func TestRateLimiterCleanup(t *testing.T) {
	rl := &rateLimiter{
		visitors: make(map[string]*visitor),
		rate:     10,
		burst:    10,
	}

	// Add old visitor
	rl.visitors["old-ip"] = &visitor{
		limiter:  &tokenBucket{},
		lastSeen: time.Now().Add(-10 * time.Minute),
	}

	// Add recent visitor
	rl.visitors["new-ip"] = &visitor{
		limiter:  &tokenBucket{},
		lastSeen: time.Now(),
	}

	rl.cleanup()

	if _, exists := rl.visitors["old-ip"]; exists {
		t.Error("Old visitor should have been cleaned up")
	}

	if _, exists := rl.visitors["new-ip"]; !exists {
		t.Error("Recent visitor should not have been cleaned up")
	}
}
