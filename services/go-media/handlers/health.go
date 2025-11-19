package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/WomB0ComB0/cdn/services/go-media/storage"
)

type HealthStatus struct {
	Status      string            `json:"status"`
	Timestamp   time.Time         `json:"timestamp"`
	Version     string            `json:"version"`
	Dependencies map[string]string `json:"dependencies"`
}

// HealthCheckDetailed performs a deep health check
func HealthCheckDetailed(r2Client *storage.R2Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := HealthStatus{
			Status:       "healthy",
			Timestamp:    time.Now(),
			Version:      getEnv("APP_VERSION", "1.0.0"),
			Dependencies: make(map[string]string),
		}

		// Check R2 connectivity
		ctx := r.Context()
		_, err := r2Client.ListObjects(ctx, "", 1)
		if err != nil {
			status.Status = "unhealthy"
			status.Dependencies["r2"] = "unhealthy: " + err.Error()
			w.WriteHeader(http.StatusServiceUnavailable)
		} else {
			status.Dependencies["r2"] = "healthy"
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
