export const CDN_ORIGIN = 'https://cdn.mikeodnis.dev';
export const API_ORIGIN = 'https://api.mikeodnis.dev';

export const CDN_LINK_HEADER = [
  `<${CDN_ORIGIN}/llms.txt>; rel="describedby"; type="text/markdown"`,
  `<${CDN_ORIGIN}/openapi.yaml>; rel="service-desc"; type="application/yaml"`,
  `<${CDN_ORIGIN}/.well-known/security.txt>; rel="security"`,
].join(', ');

export const CDN_SECURITY_TXT = `Contact: mailto:mike@mikeodnis.dev
Contact: https://github.com/WomB0ComB0/cdn/security/advisories/new
Expires: 2027-11-24T00:00:00.000Z
Preferred-Languages: en
Canonical: ${CDN_ORIGIN}/.well-known/security.txt
`;

export const CDN_ASSETLINKS_JSON = JSON.stringify(
  [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'dev.mikeodnis.cdn',
        sha256_cert_fingerprints: [
          '0A:E3:12:B7:5D:D1:C8:EA:24:F4:F0:57:D3:5E:6C:EA:26:EF:D9:A4:8A:1F:1E:BC:2C:2A:39:F9:34:8F:0C:12',
        ],
      },
    },
  ],
  null,
  2
);

export const CDN_ROBOTS_TXT = `# cdn.mikeodnis.dev — Edge Media Delivery & Asset CDN
# Machine-readable LLM guides:
#   ${CDN_ORIGIN}/llms.txt
#   ${CDN_ORIGIN}/llms-full.txt

User-agent: *
Allow: /
Allow: /docs
Allow: /upload
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /openapi.yaml
Allow: /assets/
Disallow: /private/

User-agent: GPTBot
Allow: /
Disallow: /private/

User-agent: OAI-SearchBot
Allow: /
Disallow: /private/

User-agent: ClaudeBot
Allow: /
Disallow: /private/

User-agent: PerplexityBot
Allow: /
Disallow: /private/

Sitemap: ${CDN_ORIGIN}/sitemap.xml
`;

export const CDN_SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${CDN_ORIGIN}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${CDN_ORIGIN}/upload</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${CDN_ORIGIN}/docs</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${CDN_ORIGIN}/llms.txt</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${CDN_ORIGIN}/llms-full.txt</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${CDN_ORIGIN}/openapi.yaml</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
`;

export const CDN_LLMS_TXT = `# cdn.mikeodnis.dev

> Global edge media delivery, on-the-fly image optimization, and HMAC-signed private asset serving for the *.mikeodnis.dev platform. Built on Cloudflare Workers + R2 with hexagonal TypeScript architecture.

## Key Endpoints

- [CDN Console & Reference](${CDN_ORIGIN}/): Human-readable overview, live edge telemetry, and working examples.
- [Interactive OpenAPI Docs (Scalar)](${CDN_ORIGIN}/docs): Interactive Scalar OpenAPI 3.1 explorer for CDN routes.
- [Upload Studio PWA](${CDN_ORIGIN}/upload): Installable web/mobile app for uploading, managing, signing, and purging R2 assets anywhere.
- [Full LLM Technical Reference](${CDN_ORIGIN}/llms-full.txt): Complete route specs, HMAC signing algorithm, image transform parameters, rate limits, and error codes.
- [OpenAPI 3.1 Specification](${CDN_ORIGIN}/openapi.yaml): Machine-readable API contract for edge delivery and media management.
- [Health Check](${CDN_ORIGIN}/health): JSON liveness probe.
- [Rate-Limiter Metrics](${CDN_ORIGIN}/health/metrics): Live edge health and per-tier rate-limiter telemetry.

## Delivery Routes

- \`GET /assets/{key}\`: Immutable public R2 assets (\`Cache-Control: public, max-age=31536000, immutable\`, ETag, Range).
- \`GET /private/{key}?exp={unix}&sig={hmac}\`: Time-limited HMAC-SHA256 signed private assets (\`Cache-Control: private, max-age=3600\`).
- \`GET /img/assets/{key}?w={px}&h={px}&q={1-100}&f={avif|webp|jpeg|png}\`: On-the-fly imgproxy image transformation with automatic AVIF/WebP negotiation.

## Uploads & Management

Uploads and asset management are authenticated via JWT on the companion platform gateway:
- \`POST ${API_ORIGIN}/v1/media/upload\`: Multipart file upload (up to 100 MiB) to public or private R2 namespaces.
- \`POST ${API_ORIGIN}/v1/media/presign\` + \`POST ${API_ORIGIN}/v1/media/assets/confirm\`: Direct-to-R2 presigned PUT upload flow.
- \`GET ${API_ORIGIN}/v1/media/assets\`, \`POST ${API_ORIGIN}/v1/media/sign\`, \`POST ${API_ORIGIN}/v1/media/purge\`, \`DELETE ${API_ORIGIN}/v1/media/assets/{id}\`.

## Rate Limits (Per-IP, 60s Window)

- \`/assets/*\`: 300 req/min
- \`/private/*\`: 120 req/min
- \`/img/*\`: 60 req/min
- Standard IETF \`RateLimit-Limit\`, \`RateLimit-Remaining\`, \`RateLimit-Reset\`, \`RateLimit-Policy\`, and \`Retry-After\` headers emitted.

## Ecosystem (*.mikeodnis.dev)

- Portfolio: https://mikeodnis.dev
- Platform API: ${API_ORIGIN}
- Short Links: https://links.mikeodnis.dev
- Blog: https://blog.mikeodnis.dev
- Status: https://status.mikeodnis.dev
- Source: https://github.com/WomB0ComB0/cdn
`;

export const CDN_LLMS_FULL_TXT = `# cdn.mikeodnis.dev — Full Technical & LLM Reference

## Overview

\`cdn.mikeodnis.dev\` is the static media, image transformation, and signed asset delivery edge for the \`*.mikeodnis.dev\` ecosystem by Mike Odnis.
It runs on Cloudflare Workers backed by Cloudflare R2 (\`cdn\` bucket) with tiered native Cloudflare edge rate limiting, byte-range streaming, conditional ETag validation (\`304 Not Modified\`), SVG XSS sandboxing, and on-the-fly \`imgproxy\` optimization.

## Complete Edge Route Matrix

| Method | Path | Auth | Cache-Control | Rate Limit | Description |
|---|---|---|---|---|---|
| GET, HEAD | \`/\` | None | \`public, max-age=300\` | Exempt | Live Console HTML (or JSON with \`Accept: application/json\`) |
| GET, HEAD | \`/upload\` | None (UI) / JWT (API) | \`public, max-age=300\` | Exempt | Installable Upload Studio PWA (supports Android Web Share Target) |
| GET, HEAD | \`/assets/{key}\` | None | \`public, max-age=31536000, immutable\` | 300 / 60s | Public R2 object delivery with ETag & HTTP Range (\`206\`) |
| GET, HEAD | \`/private/{key}?exp=...&sig=...\` | HMAC-SHA256 | \`private, max-age=3600\` | 120 / 60s | Time-limited signed private R2 object delivery |
| GET, HEAD | \`/img/assets/{key}?w=&h=&q=&f=\` | None | \`public, max-age=31536000, immutable\` | 60 / 60s | On-the-fly resized/re-encoded public image via imgproxy |
| GET | \`/health\` | None | \`no-store\` | Exempt | Liveness check (\`{"status":"healthy","service":"cdn-worker"}\`) |
| GET | \`/health/metrics\` | None | \`no-store\` | Exempt | Liveness + edge rate-limiter counters |
| GET | \`/llms.txt\`, \`/llms-full.txt\` | None | \`public, max-age=3600\` | Exempt | LLM-optimized Markdown documentation |
| GET | \`/openapi.yaml\` | None | \`public, max-age=3600\` | Exempt | OpenAPI 3.1 contract |
| GET | \`/.well-known/security.txt\` | None | \`public, max-age=86400\` | Exempt | RFC 9116 security disclosure contact |

## Image Transformation Parameters (\`/img/assets/{key}\`)

- \`w\`: Target width in pixels (integer, bounded by imgproxy)
- \`h\`: Target height in pixels (integer)
- \`q\`: Output quality \`1\`–\`100\`
- \`f\`: Output format (\`avif\`, \`webp\`, \`jpeg\`, \`png\`). When omitted, content-negotiated from \`Accept\` header (\`image/avif,image/webp,*/*\`).
- Security: \`/img/private/*\` is strictly forbidden (\`403 Forbidden\`) to prevent unauthenticated private asset leakage through the image proxy.

## Private URL HMAC Signing Specification

Private assets under \`/private/{key}\` require both \`exp\` (Unix timestamp in seconds) and \`sig\` (URL-safe base64 HMAC-SHA256 without padding):

\`\`\`text
payload = "/private/{key}:{exp}"
sig     = base64url_nopad(HMAC_SHA256(SIGNING_SECRET, payload))
\`\`\`

Signatures are verified in constant time using Web Crypto \`crypto.subtle.verify\`. Expired or mismatched signatures return \`403 Forbidden\`.
To mint a signed URL programmatically, call \`POST ${API_ORIGIN}/v1/media/sign\` with a valid Bearer JWT.

## Uploading Assets (via api.mikeodnis.dev/v1/media)

1. Authenticate to obtain a JWT:
\`\`\`bash
TOKEN=$(curl -sS -X POST ${API_ORIGIN}/v1/core/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"you@mikeodnis.dev","password":"..."}' | jq -r .access_token)
\`\`\`

2. Upload a public or private file directly:
\`\`\`bash
curl -sS -X POST ${API_ORIGIN}/v1/media/upload \\
  -H "Authorization: Bearer $TOKEN" \\
  -F "file=@./photo.png" \\
  -F "visibility=public"
\`\`\`

3. Or use the installable Upload Studio PWA at \`${CDN_ORIGIN}/upload\` (supports drag-and-drop, clipboard paste, mobile camera, and Android Share Sheet).

## Security Controls

- **SVG / HTML / XML Sandboxing**: Any R2 object with \`svg\`, \`html\`, or \`xml\` MIME type is served with \`Content-Security-Policy: default-src 'none'; sandbox\` and \`X-Content-Type-Options: nosniff\` to prevent Stored XSS.
- **Path Traversal Guard**: \`AssetPath.parse\` rejects \`..\`, null bytes, backslashes, and malformed segments (\`400\` / \`403\`).
- **Rate Limiting**: Tiered Cloudflare native \`ratelimits\` bindings with bounded per-isolate sliding-window fallback and IETF \`RateLimit-*\` response headers.

## Error Codes

- \`400 Bad Request\`: Malformed object path or invalid image transform parameters.
- \`403 Forbidden\`: Missing, expired, or invalid HMAC signature; or attempt to transform a \`/private/\` object.
- \`404 Not Found\`: Object does not exist in R2.
- \`405 Method Not Allowed\`: Only \`GET\`, \`HEAD\`, and \`OPTIONS\` are permitted on the delivery edge.
- \`429 Too Many Requests\`: Tier rate limit exceeded (check \`Retry-After\` and \`RateLimit-Reset\`).
- \`503 Service Unavailable\`: \`IMGPROXY_URL\` not configured for \`/img/\` requests.
`;

export const CDN_OPENAPI_YAML = `openapi: 3.1.0
info:
  title: cdn.mikeodnis.dev — Edge CDN & Media Delivery
  version: 2.0.0
  description: >
    Global edge delivery worker for public immutable R2 assets, HMAC-SHA256 signed private assets,
    and on-the-fly imgproxy image transformations. Uploads and management live at
    https://api.mikeodnis.dev/v1/media.
  contact:
    name: Mike Odnis
    url: https://mikeodnis.dev
    email: mike@mikeodnis.dev
  license:
    name: Apache-2.0
    url: https://www.apache.org/licenses/LICENSE-2.0
servers:
  - url: ${CDN_ORIGIN}
    description: Edge Delivery (Cloudflare Workers + R2)
  - url: ${API_ORIGIN}/v1/media
    description: Media Upload & Management API
paths:
  /:
    get:
      summary: CDN overview (HTML Live Console or JSON descriptor)
      tags: [Discovery]
      responses:
        '200':
          description: Service overview
  /health:
    get:
      summary: Edge worker liveness probe
      tags: [Health]
      responses:
        '200':
          description: Healthy
  /health/metrics:
    get:
      summary: Edge worker health and rate-limiter counters
      tags: [Health]
      responses:
        '200':
          description: Health and rate-limit metrics
  /assets/{key}:
    get:
      summary: Fetch public immutable R2 asset
      tags: [Delivery]
      parameters:
        - name: key
          in: path
          required: true
          schema: { type: string }
        - name: If-None-Match
          in: header
          schema: { type: string }
        - name: Range
          in: header
          schema: { type: string }
      responses:
        '200': { description: Asset content }
        '206': { description: Partial byte range }
        '304': { description: Not Modified }
        '404': { description: Asset not found }
        '429': { description: Rate limit exceeded (300/60s) }
  /private/{key}:
    get:
      summary: Fetch HMAC-SHA256 signed private asset
      tags: [Delivery]
      parameters:
        - name: key
          in: path
          required: true
          schema: { type: string }
        - name: exp
          in: query
          required: true
          schema: { type: integer }
        - name: sig
          in: query
          required: true
          schema: { type: string }
      responses:
        '200': { description: Private asset content }
        '403': { description: Invalid or expired HMAC signature }
        '404': { description: Asset not found }
        '429': { description: Rate limit exceeded (120/60s) }
  /img/assets/{key}:
    get:
      summary: On-the-fly resized and format-negotiated public image
      tags: [Transforms]
      parameters:
        - name: key
          in: path
          required: true
          schema: { type: string }
        - name: w
          in: query
          schema: { type: integer }
        - name: h
          in: query
          schema: { type: integer }
        - name: q
          in: query
          schema: { type: integer, minimum: 1, maximum: 100 }
        - name: f
          in: query
          schema: { type: string, enum: [avif, webp, jpeg, png] }
      responses:
        '200': { description: Transformed image }
        '403': { description: Private transforms forbidden }
        '429': { description: Rate limit exceeded (60/60s) }
        '503': { description: Image proxy unavailable }
  /llms.txt:
    get:
      summary: Concise LLM documentation index
      tags: [Discovery]
      responses:
        '200': { description: Markdown summary }
  /llms-full.txt:
    get:
      summary: Full LLM technical reference
      tags: [Discovery]
      responses:
        '200': { description: Full Markdown reference }
`;

export const CDN_SERVICE_DESCRIPTOR = {
  service: 'cdn.mikeodnis.dev',
  version: '2.0.0',
  runtime: 'Cloudflare Workers + R2',
  status: 'operational',
  routes: {
    public_assets: '/assets/{key}',
    private_assets: '/private/{key}?exp={unix}&sig={hmac}',
    image_transforms: '/img/assets/{key}?w={px}&h={px}&q={1-100}&f={avif|webp|jpeg|png}',
    upload_studio_pwa: '/upload',
    health: '/health',
    metrics: '/health/metrics',
  },
  discovery: {
    docs: `${CDN_ORIGIN}/docs`,
    llms: `${CDN_ORIGIN}/llms.txt`,
    llms_full: `${CDN_ORIGIN}/llms-full.txt`,
    openapi: `${CDN_ORIGIN}/openapi.yaml`,
    security: `${CDN_ORIGIN}/.well-known/security.txt`,
    manifest: `${CDN_ORIGIN}/manifest.webmanifest`,
  },
  upload_api: `${API_ORIGIN}/v1/media`,
  rate_limits: {
    assets: '300 requests / 60s',
    private: '120 requests / 60s',
    img: '60 requests / 60s',
  },
  ecosystem: {
    portfolio: 'https://mikeodnis.dev',
    api: API_ORIGIN,
    links: 'https://links.mikeodnis.dev',
    blog: 'https://blog.mikeodnis.dev',
    news: 'https://news.mikeodnis.dev',
    status: 'https://status.mikeodnis.dev',
  },
} as const;
