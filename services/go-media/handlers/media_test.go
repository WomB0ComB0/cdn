package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthCheck(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	HealthCheck(w, req)

	resp := w.Result()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]string
	if err := json.Unmarshal(body, &result); err != nil {
		t.Errorf("Failed to parse JSON: %v", err)
	}

	if result["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got '%s'", result["status"])
	}
}

func TestGenerateSignature(t *testing.T) {
	handler := &MediaHandler{
		signingSecret: "test-secret",
	}

	path := "private/test.pdf"
	expires := "1234567890"

	sig1 := handler.generateSignature(path, expires)
	sig2 := handler.generateSignature(path, expires)

	if sig1 != sig2 {
		t.Error("Signatures should be deterministic")
	}

	if sig1 == "" {
		t.Error("Signature should not be empty")
	}
}

func TestValidateSignature(t *testing.T) {
	handler := &MediaHandler{
		signingSecret: "test-secret",
	}

	path := "private/test.pdf"
	expires := "1234567890"

	validSig := handler.generateSignature(path, expires)

	tests := []struct {
		name      string
		path      string
		expires   string
		signature string
		want      bool
	}{
		{
			name:      "valid signature",
			path:      path,
			expires:   expires,
			signature: validSig,
			want:      true,
		},
		{
			name:      "invalid signature",
			path:      path,
			expires:   expires,
			signature: "invalid",
			want:      false,
		},
		{
			name:      "wrong path",
			path:      "different/path.pdf",
			expires:   expires,
			signature: validSig,
			want:      false,
		},
		{
			name:      "wrong expires",
			path:      path,
			expires:   "9999999999",
			signature: validSig,
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := handler.validateSignature(tt.path, tt.expires, tt.signature)
			if got != tt.want {
				t.Errorf("validateSignature() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseRange(t *testing.T) {
	tests := []struct {
		name    string
		header  string
		size    int64
		want    []httpRange
		wantErr bool
	}{
		{
			name:   "simple range",
			header: "bytes=0-499",
			size:   1000,
			want:   []httpRange{{start: 0, end: 499}},
		},
		{
			name:   "open-ended range",
			header: "bytes=500-",
			size:   1000,
			want:   []httpRange{{start: 500, end: 999}},
		},
		{
			name:   "suffix range",
			header: "bytes=-500",
			size:   1000,
			want:   []httpRange{{start: 500, end: 999}},
		},
		{
			name:    "invalid format",
			header:  "invalid",
			size:    1000,
			wantErr: true,
		},
		{
			name:    "no bytes prefix",
			header:  "0-499",
			size:    1000,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseRange(tt.header, tt.size)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseRange() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && len(got) != len(tt.want) {
				t.Errorf("parseRange() got %d ranges, want %d", len(got), len(tt.want))
			}
			if !tt.wantErr && len(got) > 0 && len(tt.want) > 0 {
				if got[0].start != tt.want[0].start || got[0].end != tt.want[0].end {
					t.Errorf("parseRange() = %+v, want %+v", got[0], tt.want[0])
				}
			}
		})
	}
}

func TestUploadFileSizeValidation(t *testing.T) {
	// This test would require mocking the R2 client
	// Skipped for brevity but should be implemented
	t.Skip("Requires R2 client mock")
}

func TestRespondJSON(t *testing.T) {
	tests := []struct {
		name   string
		status int
		data   interface{}
	}{
		{
			name:   "success response",
			status: http.StatusOK,
			data:   map[string]string{"status": "ok"},
		},
		{
			name:   "error response",
			status: http.StatusBadRequest,
			data:   ErrorResponse{Error: "test error"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			respondJSON(w, tt.status, tt.data)

			if w.Code != tt.status {
				t.Errorf("respondJSON() status = %d, want %d", w.Code, tt.status)
			}

			contentType := w.Header().Get("Content-Type")
			if contentType != "application/json" {
				t.Errorf("respondJSON() content-type = %s, want application/json", contentType)
			}
		})
	}
}
