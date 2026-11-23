# Makefile for cdn.mikeodnis.dev (Cloudflare Worker + R2 + optional imgproxy)

.PHONY: help deps typecheck test dev deploy imgproxy-up imgproxy-down health-check clean

WORKER_DIR := cloudflare-worker

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

deps: ## Install Worker dependencies with Bun
	cd $(WORKER_DIR) && bun install

typecheck: ## Strict TypeScript typecheck
	cd $(WORKER_DIR) && bun run typecheck

test: ## Run unit tests and Hexagonal import-boundary checks
	cd $(WORKER_DIR) && bun test

dev: ## Start local Wrangler dev server
	cd $(WORKER_DIR) && bunx wrangler dev

deploy: typecheck test ## Typecheck, test, and deploy Cloudflare Worker
	cd $(WORKER_DIR) && bunx wrangler deploy

imgproxy-up: ## Start optional local imgproxy container
	docker compose up -d imgproxy

imgproxy-down: ## Stop optional local imgproxy container
	docker compose down

health-check: ## Verify live cdn.mikeodnis.dev health
	@curl -fsS https://cdn.mikeodnis.dev/health && echo ""

clean: ## Remove local build/cache artifacts
	rm -rf $(WORKER_DIR)/.wrangler
