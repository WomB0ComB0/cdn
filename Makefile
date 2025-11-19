# Makefile for CDN Infrastructure

.PHONY: help build test lint clean dev deploy docker-build docker-push

# Variables
GO_SERVICE := services/go-media
NODE_SERVICE := services/node-core
WORKER_DIR := cloudflare-worker

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development
dev: ## Start development environment
	docker-compose up

dev-build: ## Build and start development environment
	docker-compose up --build

stop: ## Stop all services
	docker-compose down

logs: ## View logs from all services
	docker-compose logs -f

# Testing
test: test-go test-node ## Run all tests

test-go: ## Run Go tests
	cd $(GO_SERVICE) && go test -v -race -coverprofile=coverage.out ./...

test-go-coverage: ## Run Go tests with coverage report
	cd $(GO_SERVICE) && go test -v -race -coverprofile=coverage.out ./... && go tool cover -html=coverage.out

test-node: ## Run Node.js tests
	cd $(NODE_SERVICE) && npm test

# Linting
lint: lint-go lint-node lint-yaml ## Run all linters

lint-go: ## Lint Go code
	cd $(GO_SERVICE) && golangci-lint run

lint-node: ## Lint Node.js code
	cd $(NODE_SERVICE) && npm run lint

lint-yaml: ## Lint YAML files
	yamllint .

# Building
build: build-go build-node ## Build all services

build-go: ## Build Go service
	cd $(GO_SERVICE) && go build -o bin/media-service .

build-node: ## Build Node service
	cd $(NODE_SERVICE) && npm ci

# Docker
docker-build: ## Build all Docker images
	docker-compose build

docker-build-go: ## Build Go service Docker image
	docker build -t cdn-go-media:latest $(GO_SERVICE)

docker-build-node: ## Build Node service Docker image
	docker build -t cdn-node-core:latest $(NODE_SERVICE)

docker-push: ## Push Docker images to registry
	docker-compose push

# Deployment
deploy-worker: ## Deploy Cloudflare Worker
	cd $(WORKER_DIR) && wrangler deploy

deploy-production: ## Deploy to production
	@echo "Deploying to production..."
	docker-compose -f docker-compose.yml pull
	docker-compose -f docker-compose.yml up -d

# Utilities
clean: ## Clean build artifacts
	rm -rf $(GO_SERVICE)/bin
	rm -rf $(GO_SERVICE)/coverage.out
	rm -rf $(NODE_SERVICE)/node_modules
	rm -rf $(NODE_SERVICE)/dist
	docker-compose down -v

fmt: ## Format code
	cd $(GO_SERVICE) && go fmt ./...
	cd $(NODE_SERVICE) && npm run format

deps: ## Install dependencies
	cd $(GO_SERVICE) && go mod download
	cd $(NODE_SERVICE) && npm install
	cd $(WORKER_DIR) && npm install

deps-update: ## Update dependencies
	cd $(GO_SERVICE) && go get -u ./... && go mod tidy
	cd $(NODE_SERVICE) && npm update
	cd $(WORKER_DIR) && npm update

# Health checks
health-check: ## Check service health
	@echo "Checking Go Media Service..."
	@curl -f http://localhost:8080/health || echo "Go Media Service is down"
	@echo "\nChecking Node Core Service..."
	@curl -f http://localhost:3000/health || echo "Node Core Service is down"

# Security
security-scan: ## Run security scans
	cd $(GO_SERVICE) && gosec ./...
	cd $(NODE_SERVICE) && npm audit
	trivy image cdn-go-media:latest

# Benchmarks
benchmark: ## Run Go benchmarks
	cd $(GO_SERVICE) && go test -bench=. -benchmem ./...

# Generate
generate: ## Generate code
	cd $(GO_SERVICE) && go generate ./...

# Database migrations (if using)
migrate-up: ## Run database migrations
	@echo "Running migrations..."
	# Add migration command here

migrate-down: ## Rollback database migrations
	@echo "Rolling back migrations..."
	# Add rollback command here

# Monitoring
metrics: ## View Prometheus metrics
	@echo "Metrics available at:"
	@echo "  Traefik: http://localhost:8080/metrics"

# Documentation
docs: ## Generate API documentation
	@echo "Generating documentation..."
	cd $(GO_SERVICE) && godoc -http=:6060

# Quick actions
quick-test: ## Quick test (no coverage)
	cd $(GO_SERVICE) && go test ./...

watch-test: ## Watch and run tests on file changes
	cd $(GO_SERVICE) && watchexec -e go -r "go test ./..."

# Environment
env-setup: ## Setup environment file
	cp .env.example .env
	@echo "Please edit .env with your configuration"

secrets-generate: ## Generate secure secrets
	@echo "SIGNING_SECRET=$$(openssl rand -hex 32)"
	@echo "IMGPROXY_KEY=$$(openssl rand -hex 32)"
	@echo "IMGPROXY_SALT=$$(openssl rand -hex 32)"
	@echo "HASURA_ADMIN_SECRET=$$(openssl rand -hex 32)"

# Install tools
install-tools: ## Install development tools
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/securego/gosec/v2/cmd/gosec@latest
	npm install -g wrangler
	npm install -g yaml-lint

.DEFAULT_GOAL := help
