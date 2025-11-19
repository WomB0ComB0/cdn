package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/WomB0ComB0/cdn/services/go-media/handlers"
	"github.com/WomB0ComB0/cdn/services/go-media/middleware"
	"github.com/WomB0ComB0/cdn/services/go-media/storage"
	"github.com/gorilla/mux"
)

func main() {
	port := getEnv("PORT", "8080")

	// Initialize R2 storage client
	r2Client, err := storage.NewR2Client(storage.R2Config{
		AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		BucketName:      os.Getenv("R2_BUCKET_NAME"),
		Endpoint:        os.Getenv("R2_ENDPOINT"),
	})
	if err != nil {
		log.Fatalf("Failed to initialize R2 client: %v", err)
	}

	// Initialize handlers
	mediaHandler := handlers.NewMediaHandler(r2Client, os.Getenv("SIGNING_SECRET"))

	// Setup router
	router := mux.NewRouter()

	// Apply middleware
	router.Use(middleware.Logger)
	router.Use(middleware.Recovery)
	router.Use(middleware.SecurityHeaders)

	// Health check
	router.HandleFunc("/health", handlers.HealthCheck).Methods("GET")

	// Media routes (under /v1/media)
	api := router.PathPrefix("/v1/media").Subrouter()

	// Upload endpoints
	api.HandleFunc("/upload", mediaHandler.Upload).Methods("POST")
	api.HandleFunc("/upload/multipart", mediaHandler.MultipartUpload).Methods("POST")

	// Asset serving with ETag and Range support
	api.HandleFunc("/assets/{path:.+}", mediaHandler.ServeAsset).Methods("GET", "HEAD")

	// Signed URL generation
	api.HandleFunc("/sign", mediaHandler.GenerateSignedURL).Methods("POST")

	// Private asset serving (requires signature validation)
	api.HandleFunc("/private/{path:.+}", mediaHandler.ServePrivateAsset).Methods("GET", "HEAD")

	// Cache purge endpoint
	api.HandleFunc("/purge", mediaHandler.PurgeCache).Methods("POST")

	// List assets
	api.HandleFunc("/list", mediaHandler.ListAssets).Methods("GET")

	// Delete asset
	api.HandleFunc("/delete/{path:.+}", mediaHandler.DeleteAsset).Methods("DELETE")

	// Create server
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Starting server on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
