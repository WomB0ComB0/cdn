# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive code review document (REVIEW.md)
- Rate limiting middleware for upload endpoints
- Deep health check with R2 connectivity verification
- Unit tests for handlers and middleware
- Makefile for common development tasks
- CI/CD workflow for tests and quality checks
- Security scanning with Trivy and gosec
- Input validation for file uploads
- File type restrictions (whitelist-based)
- File size limits (100MB max)
- Path traversal protection
- Cloudflare cache purge implementation
- CORS preflight handling in Worker
- Structured logging support
- Quick start guide (QUICKSTART.md)

### Changed
- Improved error messages with more context
- Enhanced upload handler with better validation
- Updated health check to include dependency status
- Improved README with feature list
- Better documentation structure

### Security
- Added request size limits to prevent memory exhaustion
- Implemented file type validation
- Added filename sanitization
- Fixed CORS preflight handling
- Added rate limiting on sensitive endpoints

### Fixed
- Cloudflare cache purge now properly calls API
- Worker OPTIONS handler now correctly called
- Upload endpoint no longer vulnerable to large file attacks
- CORS preflight requests now properly handled

## [1.0.0] - 2024-11-18

### Added
- Initial release
- Go media service with R2 integration
- ETag support with SHA-256 content hashing
- Range request support for streaming
- HMAC-based signed URLs
- Cloudflare Worker for CDN
- imgproxy integration for image transformations
- Traefik API gateway
- Docker Compose infrastructure
- Hasura GraphQL integration
- GitHub Actions workflows
- OpenAPI specification
- Comprehensive documentation
- Setup guide

### Infrastructure
- Docker containerization
- Multi-service orchestration
- Health checks for all services
- Graceful shutdown handling
- TLS with Let's Encrypt
- HSTS with preload
- CSP headers
- CORS configuration
- Compression (Brotli + Gzip)

### Features
- Public asset serving
- Private asset access with signatures
- Image transformation pipeline
- Content-hash based caching
- Edge caching via Cloudflare
- Multipart upload support (stub)
- Asset listing
- Asset deletion
- Cache purging

[Unreleased]: https://github.com/WomB0ComB0/cdn/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/WomB0ComB0/cdn/releases/tag/v1.0.0
