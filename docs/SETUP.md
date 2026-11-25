# CDN Setup Guide (`cdn.mikeodnis.dev`)

This guide walks through provisioning and deploying the **Cloudflare Edge CDN Worker**, **Cloudflare R2** storage, optional **imgproxy** image transform sidecar, and **Desktop CLI / Upload Studio PWA** for `cdn.mikeodnis.dev`.

> All write/control-plane endpoints (`POST /v1/media/upload`, `/presign`, `/assets/confirm`, `/sign`, `/purge`, `DELETE /assets/{id}`) live in the companion repository [`WomB0ComB0/api`](https://github.com/WomB0ComB0/api). This repository (`WomB0ComB0/cdn`) owns the edge Worker, Upload Studio PWA, Desktop CLI, and Android TWA.

## Prerequisites

- [ ] Cloudflare account with **R2** and **Workers** enabled
- [ ] [Bun](https://bun.sh) 1.3+ installed locally (used for Wrangler, tests, and builds)
- [ ] Git installed
- [ ] Companion `api.mikeodnis.dev` deployed (see `api/docs/DEPLOYMENT.md`) with matching `SIGNING_SECRET` and `GATEWAY_PROXY_SECRET`

---

## Step 1: Clone & Generate Shared Secrets

```bash
git clone https://github.com/WomB0ComB0/cdn.git
cd cdn

# Must match media-service SIGNING_SECRET (>=32 bytes)
SIGNING_SECRET=$(openssl rand -hex 32)

# Must match Railway gateway GATEWAY_PROXY_SECRET (32 bytes)
GATEWAY_PROXY_SECRET=$(openssl rand -hex 32)
```

---

## Step 2: Provision Cloudflare R2

```bash
cd cloudflare-worker

# 1. Authenticate Wrangler
bunx wrangler login

# 2. Create the R2 bucket matching wrangler.jsonc
bunx wrangler r2 bucket create cdn
```

In the Cloudflare Dashboard → **R2 → Manage R2 API Tokens**, create a Read & Write token scoped to `cdn` and supply its credentials (`CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`) to `media-service` in `WomB0ComB0/api`.

For edge cache invalidation (`POST /v1/media/purge`), create a Cloudflare API Token with **Zone → Cache Purge → Purge** on `mikeodnis.dev` and configure `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` in `media-service`.

---

## Step 3: Configure & Deploy the Edge Worker

Inspect [`cloudflare-worker/wrangler.jsonc`](../cloudflare-worker/wrangler.jsonc) to verify:
- R2 binding (`R2_BUCKET` → `cdn`)
- Native Cloudflare `ratelimit` bindings (`RATE_LIMIT_ASSETS` 300/60s, `RATE_LIMIT_PRIVATE` 120/60s, `RATE_LIMIT_IMG` 60/60s)
- Optional `IMGPROXY_URL` var if running an imgproxy instance

Upload secrets via stdin (never pass secrets as command-line arguments):

```bash
printf '%s' "$SIGNING_SECRET" | bunx wrangler secret put SIGNING_SECRET
printf '%s' "$GATEWAY_PROXY_SECRET" | bunx wrangler secret put GATEWAY_PROXY_SECRET
```

Typecheck, test, and deploy:

```bash
bun install --frozen-lockfile
bunx tsc --noEmit
bun test
bunx wrangler deploy
```

### Routing `cdn.mikeodnis.dev`

- **Option A — Cloudflare Custom Domain:** Attach `cdn.mikeodnis.dev` directly as a Worker Custom Domain in `wrangler.jsonc` / Cloudflare Dashboard (`CF-Connecting-IP` keys per-visitor rate limits automatically).
- **Option B — Behind Railway Caddy Gateway:** Point `cdn.mikeodnis.dev` CNAME to the Railway `gateway` service and set `CDN_UPSTREAM=<worker>.workers.dev` + `GATEWAY_PROXY_SECRET` on Railway `gateway`. Caddy injects `X-Gateway-Proxy-Secret` and `X-Gateway-Client-IP`, which the Worker verifies in constant time to preserve per-visitor rate-limit isolation.

---

## Step 4: Optional `imgproxy` Sidecar (On-the-Fly `/img/assets/*` Transforms)

If you enable `/img/assets/*` image transforms (`w` 1–4096, `h` 1–4096, `q` 1–100, `f=webp|avif|jpg|jpeg|png`):
- Bind `imgproxy` to loopback (`127.0.0.1:8080`) or private mesh only — never expose it directly to the public internet.
- Restrict `IMGPROXY_ALLOWED_SOURCES=s3://cdn/assets/` so `private/*` and `staging/*` objects can never be read through `imgproxy`.
- The Worker enforces canonical `Accept` headers derived from explicit `f=` format and rejects upstream SVG responses with `502 Bad Gateway`.

---

## Step 5: Verification

### 5.1 Edge Health & Discovery

```bash
curl -fsS https://cdn.mikeodnis.dev/health
# Expect: 200 OK with Cache-Control: no-store and X-Content-Type-Options: nosniff

curl -fsS https://cdn.mikeodnis.dev/llms.txt | head -n 10
curl -fsS https://cdn.mikeodnis.dev/openapi.yaml | head -n 10
```

### 5.2 Authenticated Public Asset Flow

```bash
# 1. Authenticate against api.mikeodnis.dev
TOKEN=$(curl -fsS -X POST https://api.mikeodnis.dev/v1/core/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@mikeodnis.dev","password":"your-password"}' | jq -r '.access_token')

# 2. Upload public image
UPLOAD_URL=$(curl -fsS -X POST https://api.mikeodnis.dev/v1/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F 'visibility=public' \
  -F 'file=@test.png' | jq -r '.url')

# 3. Verify immutable edge caching
curl -fsSI "$UPLOAD_URL"
# Expect: 200 OK, Cache-Control: public, max-age=31536000, immutable, ETag
```

### 5.3 Signed Private Asset Flow

```bash
# 1. Upload private file
ASSET_ID=$(curl -fsS -X POST https://api.mikeodnis.dev/v1/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F 'visibility=private' \
  -F 'file=@secret.pdf' | jq -r '.id')

# 2. Mint 120s HMAC-SHA256 signed URL
SIGNED_URL=$(curl -fsS -X POST https://api.mikeodnis.dev/v1/media/sign \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"asset_id\":\"$ASSET_ID\",\"expires_in\":120}" | jq -r '.url')

# 3. Verify strict privacy headers
curl -fsSI "$SIGNED_URL"
# Expect: 200 OK, Cache-Control: private, no-store, CDN-Cache-Control: no-store,
#         Referrer-Policy: no-referrer, X-Robots-Tag: noindex, nofollow

# 4. Verify unsigned access is denied (401/403)
curl -sSI "${SIGNED_URL%%\?*}" | head -n 1
```

### 5.4 Upload Studio PWA & Desktop CLI

- **Upload Studio PWA:** Open [`https://cdn.mikeodnis.dev/upload`](https://cdn.mikeodnis.dev/upload) — supports drag-and-drop, paste, Web Share Target, and logout-safe `sessionEpoch` token refresh.
- **Desktop CLI (`desktop/`):**
  ```bash
  cd desktop && bun install --frozen-lockfile
  bun run src/index.ts login
  bun run src/index.ts upload ./photo.png --visibility public
  ```

---

## Troubleshooting

- **`401 Unauthorized` on `/private/*`:** Confirm `SIGNING_SECRET` matches identically between `media-service` and `cdn-worker`, and verify system clock skew against `exp`.
- **`429 Too Many Requests` shared across visitors:** Confirm `GATEWAY_PROXY_SECRET` matches identically between Railway `gateway` and `cdn-worker` (or route `cdn.mikeodnis.dev` directly through Cloudflare DNS).
- **`502` / `504` on `/img/assets/*`:** Check `IMGPROXY_URL` reachability, verify the object lives under `assets/*` (never `private/*` or `staging/*`), and ensure the source is a supported raster format (SVG is intentionally rejected).
