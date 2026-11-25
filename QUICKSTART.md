# CDN Edge (`cdn.mikeodnis.dev`) — Quick Start Guide

Get the Cloudflare Edge CDN Worker, Upload Studio PWA, and Desktop CLI running locally in minutes.

> Media upload, signing, and cache-purge APIs live in [`WomB0ComB0/api`](https://github.com/WomB0ComB0/api) (`https://api.mikeodnis.dev/v1/media`). This repository (`WomB0ComB0/cdn`) owns the Cloudflare Edge Worker, Upload Studio PWA (`/upload`), Desktop CLI (`desktop/`), and Android TWA (`android-twa/`).

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- Cloudflare account with R2 + Workers (for live deployment)

## Local Development

```bash
# 1. Clone and install Worker dependencies
git clone https://github.com/WomB0ComB0/cdn.git
cd cdn/cloudflare-worker
bun install --frozen-lockfile

# 2. Run typecheck + hexagonal architecture & edge security tests
bunx tsc --noEmit
bun test

# 3. Start local Wrangler dev server
bunx wrangler dev
```

Open:
- Live Console: `http://localhost:8787/`
- Upload Studio PWA: `http://localhost:8787/upload`
- Health Probe: `http://localhost:8787/health`
- OpenAPI 3.1 Spec: `http://localhost:8787/openapi.yaml`
- LLM Reference: `http://localhost:8787/llms.txt` & `http://localhost:8787/llms-full.txt`

## Production Deployment

See [docs/SETUP.md](docs/SETUP.md) for full R2, `imgproxy`, and Railway Gateway integration details.

```bash
cd cloudflare-worker

# Provision shared secrets (must match api.mikeodnis.dev media-service & gateway)
printf '%s' "$SIGNING_SECRET" | bunx wrangler secret put SIGNING_SECRET
printf '%s' "$GATEWAY_PROXY_SECRET" | bunx wrangler secret put GATEWAY_PROXY_SECRET

# Verify & deploy to Cloudflare Edge
bunx tsc --noEmit && bun test
bunx wrangler deploy

# Verify live edge health
curl -fsS https://cdn.mikeodnis.dev/health
```

## Desktop CLI (`desktop/`)

```bash
cd desktop
bun install --frozen-lockfile

# Authenticate against api.mikeodnis.dev and upload an asset
bun run src/index.ts login
bun run src/index.ts upload ./photo.png --visibility public
```

## Next Steps

- [README.md](README.md) — Architecture, security controls, and route reference
- [docs/SETUP.md](docs/SETUP.md) — End-to-end Cloudflare R2, Worker, and Gateway setup
- [openapi.yaml](openapi.yaml) — OpenAPI 3.1 edge specification
