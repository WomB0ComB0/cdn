package handlers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/WomB0ComB0/cdn/services/go-media/storage"
	"github.com/gorilla/mux"
)

type MediaHandler struct {
	r2Client      *storage.R2Client
	signingSecret string
}

type SignedURLRequest struct {
	Path      string `json:"path"`
	ExpiresIn int64  `json:"expires_in"` // seconds
}

type SignedURLResponse struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
}

type UploadResponse struct {
	URL  string `json:"url"`
	Key  string `json:"key"`
	ETag string `json:"etag,omitempty"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func NewMediaHandler(r2Client *storage.R2Client, signingSecret string) *MediaHandler {
	return &MediaHandler{
		r2Client:      r2Client,
		signingSecret: signingSecret,
	}
}

// HealthCheck endpoint
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

// ServeAsset serves public assets with ETag and Range support
func (h *MediaHandler) ServeAsset(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	key := vars["path"]

	ctx := r.Context()

	// HEAD request - only return headers
	if r.Method == http.MethodHead {
		head, err := h.r2Client.HeadObject(ctx, key)
		if err != nil {
			http.Error(w, "Object not found", http.StatusNotFound)
			return
		}

		h.setObjectHeaders(w, head.ETag, head.ContentType, head.ContentLength, head.LastModified)
		w.WriteHeader(http.StatusOK)
		return
	}

	// Handle Range requests
	rangeHeader := r.Header.Get("Range")
	if rangeHeader != "" {
		h.serveRange(w, r, key, rangeHeader)
		return
	}

	// Regular GET request
	obj, err := h.r2Client.GetObject(ctx, key)
	if err != nil {
		http.Error(w, "Object not found", http.StatusNotFound)
		return
	}
	defer obj.Body.Close()

	// Check If-None-Match (ETag)
	if h.checkETag(w, r, obj.ETag) {
		return
	}

	h.setObjectHeaders(w, obj.ETag, obj.ContentType, obj.ContentLength, obj.LastModified)
	
	// Immutable cache for assets
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	
	io.Copy(w, obj.Body)
}

// ServePrivateAsset serves private assets with signature validation
func (h *MediaHandler) ServePrivateAsset(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	key := vars["path"]

	// Validate signature
	signature := r.URL.Query().Get("sig")
	expires := r.URL.Query().Get("exp")

	if !h.validateSignature(key, expires, signature) {
		http.Error(w, "Invalid or expired signature", http.StatusForbidden)
		return
	}

	// Check expiration
	expTime, err := strconv.ParseInt(expires, 10, 64)
	if err != nil || time.Now().Unix() > expTime {
		http.Error(w, "Signature expired", http.StatusForbidden)
		return
	}

	// Serve the asset (similar to ServeAsset)
	ctx := r.Context()
	obj, err := h.r2Client.GetObject(ctx, key)
	if err != nil {
		http.Error(w, "Object not found", http.StatusNotFound)
		return
	}
	defer obj.Body.Close()

	h.setObjectHeaders(w, obj.ETag, obj.ContentType, obj.ContentLength, obj.LastModified)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	
	io.Copy(w, obj.Body)
}

// Upload handles single file upload
func (h *MediaHandler) Upload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (100MB max)
	maxUploadSize := int64(100 << 20) // 100MB
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{Error: "Failed to parse form or file too large"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{Error: "No file provided"})
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > maxUploadSize {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{Error: "File too large (max 100MB)"})
		return
	}

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
		".pdf": true, ".svg": true, ".mp4": true, ".webm": true, ".mp3": true,
		".zip": true, ".json": true, ".txt": true, ".csv": true,
	}
	if !allowedExts[ext] {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{Error: "File type not allowed"})
		return
	}

	// Sanitize filename to prevent path traversal
	filename := filepath.Base(header.Filename)
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{Error: "Invalid filename"})
		return
	}

	// Generate content hash for filename
	hash := sha256.New()
	fileBytes, err := io.ReadAll(io.LimitReader(file, maxUploadSize))
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to read file"})
		return
	}
	hash.Write(fileBytes)
	contentHash := hex.EncodeToString(hash.Sum(nil))[:16]

	// Create key with content hash
	ext := filepath.Ext(header.Filename)
	key := fmt.Sprintf("assets/%s%s", contentHash, ext)

	// Detect content type
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(fileBytes)
	}

	// Upload to R2
	ctx := context.Background()
	err = h.r2Client.PutObject(ctx, key, bytes.NewReader(fileBytes), contentType, nil)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to upload"})
		return
	}

	respondJSON(w, http.StatusOK, UploadResponse{
		URL: fmt.Sprintf("https://cdn.mikeodnis.dev/%s", key),
		Key: key,
	})
}

// MultipartUpload handles large file uploads
func (h *MediaHandler) MultipartUpload(w http.ResponseWriter, r *http.Request) {
	// Implementation for multipart upload would go here
	// This is a placeholder for the complete implementation
	respondJSON(w, http.StatusNotImplemented, ErrorResponse{Error: "Multipart upload not yet implemented"})
}

// GenerateSignedURL creates a signed URL for private access
func (h *MediaHandler) GenerateSignedURL(w http.ResponseWriter, r *http.Request) {
	var req SignedURLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{Error: "Invalid request"})
		return
	}

	if req.ExpiresIn == 0 {
		req.ExpiresIn = 3600 // Default 1 hour
	}

	expiresAt := time.Now().Add(time.Duration(req.ExpiresIn) * time.Second)
	expires := strconv.FormatInt(expiresAt.Unix(), 10)

	signature := h.generateSignature(req.Path, expires)

	url := fmt.Sprintf("https://cdn.mikeodnis.dev/v1/media/private/%s?exp=%s&sig=%s",
		req.Path, expires, signature)

	respondJSON(w, http.StatusOK, SignedURLResponse{
		URL:       url,
		ExpiresAt: expiresAt,
	})
}

// PurgeCache triggers Cloudflare cache purge
func (h *MediaHandler) PurgeCache(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Files []string `json:"files"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{Error: "Invalid request"})
		return
	}

	// Purge Cloudflare cache
	err := h.purgeCloudflareCache(req.Files)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to purge cache"})
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "purged"})
}

// ListAssets lists objects in R2
func (h *MediaHandler) ListAssets(w http.ResponseWriter, r *http.Request) {
	prefix := r.URL.Query().Get("prefix")
	
	ctx := r.Context()
	objects, err := h.r2Client.ListObjects(ctx, prefix, 100)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to list objects"})
		return
	}

	respondJSON(w, http.StatusOK, objects)
}

// DeleteAsset deletes an object from R2
func (h *MediaHandler) DeleteAsset(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	key := vars["path"]

	ctx := r.Context()
	err := h.r2Client.DeleteObject(ctx, key)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "Failed to delete"})
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// Helper functions

func (h *MediaHandler) serveRange(w http.ResponseWriter, r *http.Request, key string, rangeHeader string) {
	ctx := r.Context()
	
	// Get object metadata first
	head, err := h.r2Client.HeadObject(ctx, key)
	if err != nil {
		http.Error(w, "Object not found", http.StatusNotFound)
		return
	}

	// Parse range header
	ranges, err := parseRange(rangeHeader, *head.ContentLength)
	if err != nil || len(ranges) == 0 {
		http.Error(w, "Invalid range", http.StatusRequestedRangeNotSatisfiable)
		return
	}

	// Get object with range
	obj, err := h.r2Client.GetObjectWithRange(ctx, key, rangeHeader)
	if err != nil {
		http.Error(w, "Failed to get range", http.StatusInternalServerError)
		return
	}
	defer obj.Body.Close()

	h.setObjectHeaders(w, obj.ETag, obj.ContentType, obj.ContentLength, obj.LastModified)
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", ranges[0].start, ranges[0].end, *head.ContentLength))
	w.WriteHeader(http.StatusPartialContent)
	
	io.Copy(w, obj.Body)
}

func (h *MediaHandler) checkETag(w http.ResponseWriter, r *http.Request, etag *string) bool {
	if etag == nil {
		return false
	}

	ifNoneMatch := r.Header.Get("If-None-Match")
	if ifNoneMatch != "" && ifNoneMatch == *etag {
		w.WriteHeader(http.StatusNotModified)
		return true
	}

	return false
}

func (h *MediaHandler) setObjectHeaders(w http.ResponseWriter, etag *string, contentType *string, contentLength *int64, lastModified *time.Time) {
	if etag != nil {
		w.Header().Set("ETag", *etag)
	}
	if contentType != nil {
		w.Header().Set("Content-Type", *contentType)
	}
	if contentLength != nil {
		w.Header().Set("Content-Length", strconv.FormatInt(*contentLength, 10))
	}
	if lastModified != nil {
		w.Header().Set("Last-Modified", lastModified.UTC().Format(http.TimeFormat))
	}
	w.Header().Set("Accept-Ranges", "bytes")
}

func (h *MediaHandler) generateSignature(path string, expires string) string {
	message := fmt.Sprintf("%s:%s", path, expires)
	mac := hmac.New(sha256.New, []byte(h.signingSecret))
	mac.Write([]byte(message))
	return base64.URLEncoding.EncodeToString(mac.Sum(nil))
}

func (h *MediaHandler) validateSignature(path string, expires string, signature string) bool {
	expected := h.generateSignature(path, expires)
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (h *MediaHandler) purgeCloudflareCache(files []string) error {
	zoneID := os.Getenv("CLOUDFLARE_ZONE_ID")
	apiToken := os.Getenv("CLOUDFLARE_API_TOKEN")

	if zoneID == "" || apiToken == "" {
		return fmt.Errorf("cloudflare credentials not configured")
	}

	reqBody := map[string]interface{}{
		"files": files,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/purge_cache", zoneID)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to purge cache: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("cloudflare API error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

type httpRange struct {
	start, end int64
}

func parseRange(s string, size int64) ([]httpRange, error) {
	if !strings.HasPrefix(s, "bytes=") {
		return nil, fmt.Errorf("invalid range")
	}
	
	ranges := []httpRange{}
	for _, ra := range strings.Split(s[6:], ",") {
		ra = strings.TrimSpace(ra)
		if ra == "" {
			continue
		}
		
		i := strings.Index(ra, "-")
		if i < 0 {
			return nil, fmt.Errorf("invalid range")
		}
		
		start, end := strings.TrimSpace(ra[:i]), strings.TrimSpace(ra[i+1:])
		var r httpRange
		
		if start == "" {
			// suffix range
			i, err := strconv.ParseInt(end, 10, 64)
			if err != nil {
				return nil, err
			}
			if i > size {
				i = size
			}
			r.start = size - i
			r.end = size - 1
		} else {
			i, err := strconv.ParseInt(start, 10, 64)
			if err != nil || i >= size || i < 0 {
				return nil, err
			}
			r.start = i
			if end == "" {
				r.end = size - 1
			} else {
				i, err := strconv.ParseInt(end, 10, 64)
				if err != nil || r.start > i {
					return nil, err
				}
				if i >= size {
					i = size - 1
				}
				r.end = i
			}
		}
		ranges = append(ranges, r)
	}
	return ranges, nil
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
