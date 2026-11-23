# Makefile for cdn.mikeodnis.dev (Cloudflare Worker + R2 + optional imgproxy)

.PHONY: help deps typecheck test audit dev deploy imgproxy-up imgproxy-down health-check clean

WORKER_DIR := cloudflare-worker
SCRIPTS_DIR := scripts

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

deps: ## Install Worker and Scripts dependencies with Bun
	cd $(WORKER_DIR) && bun install --frozen-lockfile
	cd $(SCRIPTS_DIR) && bun install --frozen-lockfile

typecheck: ## Strict TypeScript typecheck (Worker + Scripts)
	cd $(WORKER_DIR) && bun run typecheck
	cd $(SCRIPTS_DIR) && bun run typecheck

test: ## Run unit tests and Hexagonal import-boundary checks
	cd $(WORKER_DIR) && bun test

audit: ## Run dependency security audit (high+) across Worker and Scripts
	cd $(WORKER_DIR) && bun audit --audit-level=high
	cd $(SCRIPTS_DIR) && bun audit --audit-level=high

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
