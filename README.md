# Edge CDN — `cdn.mikeodnis.dev`

Production Edge CDN for `mikeodnis.dev` powered by **Cloudflare Workers** + **Cloudflare R2**, architected with **Hexagonal Architecture (Ports & Adapters)** in strict TypeScript (`~8.7 KiB` gzipped), using [`@resq-systems/types`](https://github.com/resq-software/npm) & [`@resq-systems/logger`](https://github.com/resq-software/npm), and paired with the backend control plane [`WomB0ComB0/api`](https://github.com/WomB0ComB0/api) (`api.mikeodnis.dev`).

> **Single Source of Truth**: Core Auth (`core-service`), Go Hexagonal Media uploads & HMAC signing (`media-service`), Hasura GraphQL, and the Caddy TLS/routing gateway (`gateway`) live in [`WomB0ComB0/api`](https://github.com/WomB0ComB0/api). This repository is focused exclusively on the **Edge CDN Worker**, R2 static asset scripts, and the optional `imgproxy` transform container.

---

## System Topology (Edge + Control Plane)

```mermaid
flowchart LR
    Client["Browser / App Client"]
    DNS["Vercel DNS\ncdn.mikeodnis.dev"]

    subgraph GatewayLayer["Railway Edge Gateway"]
        GW["Caddy 2.9\nTLS · HSTS · Keepalive · 3s Retry"]
    end

    subgraph Edge["Cloudflare Edge (WomB0ComB0/cdn)"]
        Worker["cdn-worker\nHexagonal TS Worker (8.7 KiB gzip)"]
        Cache["Cloudflare Edge Cache\n(caches.default)"]
        R2[("Cloudflare R2\nBucket: cdn")]
        ImgProxy["imgproxy (optional)\n/img/* · 10s AbortSignal timeout"]
    end

    subgraph ControlPlane["api.mikeodnis.dev (WomB0ComB0/api)"]
        Media["Go 1.26 Hexagonal Media Service\n/v1/media/upload · /presign · /sign"]
    end

    Client -->|"GET / HEAD / OPTIONS"| DNS --> GW --> Worker
    Worker <-->|"Public /assets/* immutable cache"| Cache
    Worker -->|"Native R2_BUCKET binding"| R2
    Worker -.->|"On-the-fly resize / WebP / AVIF"| ImgProxy
    ImgProxy -.-> R2
    Client -->|"Upload / Presign / Sign URL"| Media
    Media -->|"S3 API write · shared SIGNING_SECRET"| R2
```

---

## Worker Hexagonal Architecture (Ports & Adapters)

Mirrors [`WomB0ComB0/go-hexagonal`](https://github.com/WomB0ComB0/go-hexagonal) and `api/services/media`. Layer dependency boundaries are enforced automatically on every test run via [`cloudflare-worker/src/__tests__/architecture.test.ts`](./cloudflare-worker/src/__tests__/architecture.test.ts):

- `src/domain/*` has **zero** imports from `application/`, `adapters/`, `api/`, `node:*`, or `@cloudflare/*`.
- `src/application/*` depends **only** on `domain/` models & ports — never on concrete adapters or HTTP routing.

```mermaid
flowchart TB
    Entry["src/index.ts\nComposition Root (WorkerEnv + ExecutionContext)"]

    subgraph Primary["Primary / Driving Adapter"]
        Router["src/api/router.ts\nHTTP Dispatch · Method Guard · CORS · @resq-systems/logger"]
    end

    subgraph App["Application Layer (Use Cases)"]
        Service["src/application/cdnService.ts\nservePublicAsset · servePrivateAsset · serveTransformedImage\nSVG/XML CSP Sandbox · nosniff · Range/206 · ETag/304"]
    end

    subgraph Domain["Domain Core (Pure TS — Zero Runtime / SDK Imports)"]
        Models["src/domain/asset.ts\nBranded ObjectKey · Pathname · UnixSeconds (@resq-systems/types)\nAssetPath · SignedRequest · ImageTransform · CdnError"]
        Ports["src/domain/ports.ts\nObjectStorePort · EdgeCachePort · SignatureVerifierPort · ImageProxyPort · ClockPort"]
    end

    subgraph Secondary["Secondary / Driven Adapters"]
        R2Adapter["src/adapters/r2ObjectStore.ts\nCloudflare R2Bucket (Range + onlyIf)"]
        CacheAdapter["src/adapters/cfEdgeCache.ts\ncaches.default + ctx.waitUntil()"]
        HmacAdapter["src/adapters/hmacSignatureVerifier.ts\nIsolate-cached CryptoKey · Timing-Safe HMAC-SHA256"]
        ImgAdapter["src/adapters/imgproxyClient.ts\nHTTP fetch · 10s AbortSignal timeout -> 504/502"]
    end

    Entry --> Router & Service & R2Adapter & CacheAdapter & HmacAdapter & ImgAdapter
    Router --> Service
    Service --> Models & Ports
    R2Adapter -.->|"implements"| Ports
    CacheAdapter -.->|"implements"| Ports
    HmacAdapter -.->|"implements"| Ports
    ImgAdapter -.->|"implements"| Ports
```

---

## Request Flows (Public Edge Cache vs. Signed Private Assets)

```mermaid
sequenceDiagram
    participant Client
    participant MediaAPI as api.mikeodnis.dev<br/>(Go media-service)
    participant Worker as cdn.mikeodnis.dev<br/>(cdn-worker)
    participant Cache as Edge Cache<br/>(caches.default)
    participant R2 as Cloudflare R2 (cdn)

    rect rgba(37, 198, 138, 0.08)
        Note over Client,R2: Public Asset Flow (/assets/*)
        Client->>Worker: GET /assets/<uid>/<hash>.png
        Worker->>Cache: caches.default.match(request)
        alt Edge Cache Hit
            Cache-->>Worker: Cached immutable Response
            Worker-->>Client: 200 OK (public, max-age=31536000, immutable)
        else Edge Cache Miss
            Worker->>R2: R2_BUCKET.get("assets/<uid>/<hash>.png", { range, onlyIf })
            R2-->>Worker: Object stream + ETag + metadata
            Worker->>Cache: ctx.waitUntil(cache.put(...))
            Worker-->>Client: 200 / 206 / 304 + nosniff (+ CSP sandbox if SVG/XML)
        end
    end

    rect rgba(56, 142, 235, 0.08)
        Note over Client,R2: Private Asset Flow (/private/*)
        Client->>MediaAPI: POST /v1/media/sign { key: "private/<uid>/<file>", ttl_seconds: 120 }
        Note over MediaAPI: HMAC-SHA256(SIGNING_SECRET, "/private/<uid>/<file>:<exp>")<br/>unpadded Base64URL
        MediaAPI-->>Client: { url: "https://cdn.mikeodnis.dev/private/...?exp=...&sig=..." }

        Client->>Worker: GET /private/<uid>/<file>?exp=...&sig=...
        Worker->>Worker: parseSignedRequest() + cached CryptoKey timingSafeEqual()
        alt Missing, expired, or invalid signature
            Worker-->>Client: 403 Forbidden
        else Valid signature
            Worker->>R2: R2_BUCKET.get("private/<uid>/<file>", { range })
            R2-->>Worker: Object stream + ETag
            Worker-->>Client: 200 / 206 (Cache-Control: private, max-age=3600)
        end
    end
```

---

## Automated CI/CD Pipeline

```mermaid
flowchart LR
    Push["Push / PR to main"]

    subgraph TestWF["CI & Security Checks (.github/workflows/test.yml)"]
        WCI["worker-ci\nBun typecheck · unit & Hexagonal tests\nwrangler deploy --dry-run (bundle size)"]
        SA["security-audit\nbun audit --audit-level=high\ncommitted .env / key guard"]
        VC["validate-compose\ndocker compose config -q"]
    end

    subgraph DeployWF["Deploy CDN Worker (.github/workflows/deploy.yml)"]
        Dep["Test & Deploy\nbunx wrangler deploy\n(CLOUDFLARE_API_TOKEN)"]
        Smoke["Post-Deploy Live Smoke Check\n/health -> 200\nunsigned /private/* -> 403\nHSTS & nosniff verified"]
    end

    Push --> WCI & SA & VC
    Push -->|"cloudflare-worker/** on main"| Dep --> Smoke
```

Weekly grouped dependency PRs are managed automatically via [`.github/dependabot.yml`](./.github/dependabot.yml).

---

## Security & Performance Controls

| Control | Implementation | Protection / Benefit |
| :--- | :--- | :--- |
| **SVG / XML Stored XSS Sandboxing** | [`cdnService.ts`](./cloudflare-worker/src/application/cdnService.ts) | Emits `Content-Security-Policy: default-src 'none'; sandbox` on SVG/XML/HTML objects + `X-Content-Type-Options: nosniff` on every response |
| **Isolate-Cached HMAC Verification** | [`hmacSignatureVerifier.ts`](./cloudflare-worker/src/adapters/hmacSignatureVerifier.ts) | Caches WebCrypto `CryptoKey` per Worker isolate + verifies signatures with `crypto.subtle.timingSafeEqual` (zero timing leak, low CPU) |
| **Path Traversal & Prefix Isolation** | [`asset.ts`](./cloudflare-worker/src/domain/asset.ts) | Rejects malformed percent-encoding, `..`, and `\` (`400`); blocks `/img/private/*` (`403`); clamps dimensions (`0–4096`) and quality (`10–100`) |
| **Branded Domain Types** | [`@resq-systems/types`](https://github.com/resq-software/npm) | Nominal `ObjectKey`, `Pathname`, `UnixSeconds` brands + curried range guards (`isInRange`, `isNonEmptyString`) |
| **Bounded Upstream Timeout** | [`imgproxyClient.ts`](./cloudflare-worker/src/adapters/imgproxyClient.ts) | `AbortSignal.timeout(10_000)` prevents hung Worker isolates, mapping cleanly to `504 Gateway Timeout` / `502 Bad Gateway` |
| **O(1) Edge Delivery** | [`cfEdgeCache.ts`](./cloudflare-worker/src/adapters/cfEdgeCache.ts) + [`r2ObjectStore.ts`](./cloudflare-worker/src/adapters/r2ObjectStore.ts) | Non-blocking `ctx.waitUntil(cache.put(...))`, full `Range`/`206` streaming, `HEAD` without body reads, `ETag`/`304` conditional caching |
| **Zero-Vulnerability Bundle** | [`test.yml`](./.github/workflows/test.yml) | Verified by `bun audit --audit-level=high` (`0` vulnerabilities) and compiled to `~8.7 KiB` gzipped |

---

## Routes

| Route | Methods | Behavior |
| :--- | :--- | :--- |
| `/health` | `GET` | Worker liveness check (`{"status":"healthy","service":"cdn-worker"}`) |
| `/assets/<key>` | `GET`, `HEAD`, `OPTIONS` | Public immutable R2 delivery (`public, max-age=31536000, immutable`), Edge Cache, `ETag`/`304`, `Range`/`206`, SVG CSP sandbox |
| `/private/<key>?exp=&sig=` | `GET`, `HEAD`, `OPTIONS` | Timing-safe HMAC-SHA256 signed private R2 delivery (compatible with `api.mikeodnis.dev` `POST /v1/media/sign`), bypasses shared edge cache |
| `/img/<key>?w=&h=&q=&f=` | `GET`, `HEAD`, `OPTIONS` | On-the-fly image transforms via `imgproxy` (blocks `private/*`, clamps `w`/`h`/`q`, allow-lists `webp`/`avif`/`jpg`/`jpeg`/`png`) |

---

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) `1.4+`
- Cloudflare account with R2 bucket `cdn`

```bash
cd cloudflare-worker
bun install
bun run typecheck                  # Strict TypeScript check
bun test                           # Unit tests + Hexagonal boundary checks
bunx wrangler deploy --dry-run     # Verify Worker bundle size
bun run dev                        # Local Wrangler dev server
```

### Production Deployment

```bash
cd cloudflare-worker
bunx wrangler secret put SIGNING_SECRET   # Must match api.mikeodnis.dev SIGNING_SECRET
bunx wrangler deploy
```

Pushes to `main` touching `cloudflare-worker/**` automatically run typecheck, unit + Hexagonal tests, `wrangler deploy`, and live smoke verification via GitHub Actions (`CLOUDFLARE_API_TOKEN`).

---

## Directory Layout

```text
cdn/
├── .github/
│   ├── dependabot.yml                        # Weekly grouped updates (npm + actions)
│   └── workflows/
│       ├── test.yml                          # Typecheck, tests, dry-run bundle, bun audit
│       ├── deploy.yml                        # Production Worker deploy + live smoke test
│       └── upload-assets.yml                 # Bulk static R2 upload + manifest artifact
├── cloudflare-worker/
│   ├── src/
│   │   ├── domain/
│   │   │   ├── asset.ts                      # Branded value objects, sanitization, CdnError
│   │   │   └── ports.ts                      # Outbound port interfaces
│   │   ├── application/
│   │   │   └── cdnService.ts                 # Use cases + SVG CSP sandbox + CORS
│   │   ├── adapters/
│   │   │   ├── r2ObjectStore.ts              # Cloudflare R2Bucket adapter
│   │   │   ├── cfEdgeCache.ts                # Cloudflare caches.default adapter
│   │   │   ├── hmacSignatureVerifier.ts      # Isolate-cached timing-safe HMAC-SHA256
│   │   │   └── imgproxyClient.ts             # Bounded-timeout HTTP imgproxy adapter
│   │   ├── api/
│   │   │   └── router.ts                     # Primary HTTP adapter + @resq-systems/logger
│   │   ├── __tests__/
│   │   │   ├── cdn.test.ts                   # End-to-end Worker & security tests
│   │   │   └── architecture.test.ts          # Hexagonal import-boundary enforcement
│   │   └── index.ts                          # Composition root
│   ├── wrangler.jsonc
│   ├── tsconfig.json
│   └── package.json
├── scripts/
│   ├── generate-asset-manifest.ts            # Content-hash manifest generator (strict TS)
│   ├── upload-to-r2.ts                       # Bulk static R2 uploader (strict TS)
│   └── tsconfig.json                         # Maximum-strict TypeScript config
├── docker-compose.yml                        # Optional local/self-hosted imgproxy
├── Makefile
└── .env.example
```

## License

Apache-2.0
