/**
 * Cloudflare Worker for cdn.mikeodnis.dev (ES Module Worker)
 *
 * Routes:
 *   GET|HEAD /assets/<key>   -> Public immutable R2 objects (Edge cached + Range/ETag)
 *   GET|HEAD /private/<key>  -> HMAC-SHA256 signed private R2 objects (compatible with api.mikeodnis.dev /v1/media/sign)
 *   GET|HEAD /img/<key>      -> On-the-fly image transforms via imgproxy
 *   GET      /health         -> Worker liveness check
 */

const DEFAULT_CACHE_TTL_IMMUTABLE = 31536000; // 1 year
const DEFAULT_CACHE_TTL_PRIVATE = 3600; // 1 hour

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === 'OPTIONS') {
        return handleOptions();
      }

      if (path === '/health') {
        return Response.json({ status: 'healthy', service: 'cdn-worker' });
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD, OPTIONS' },
        });
      }

      let decodedPath;
      try {
        decodedPath = decodeURIComponent(path);
      } catch {
        return new Response('Bad Request', { status: 400 });
      }

      if (decodedPath.includes('..') || decodedPath.includes('\\')) {
        return new Response('Bad Request', { status: 400 });
      }

      if (path.startsWith('/img/')) {
        return await handleImageProxy(request, url, env, ctx);
      }

      if (path.startsWith('/private/')) {
        return await handlePrivateAsset(request, url, env);
      }

      if (path.startsWith('/assets/')) {
        return await handlePublicAsset(request, url, env, ctx);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      console.error('Unhandled CDN Worker error', { message: err instanceof Error ? err.message : String(err) });
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

async function handlePublicAsset(request, url, env, ctx) {
  const objectKey = decodeURIComponent(url.pathname.slice(1)); // assets/...
  const cache = caches.default;
  const hasRange = request.headers.has('range');

  if (!hasRange && request.method === 'GET') {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
  }

  const object =
    request.method === 'HEAD'
      ? await env.R2_BUCKET.head(objectKey)
      : await env.R2_BUCKET.get(objectKey, {
          range: request.headers,
          onlyIf: request.headers,
        });

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');

  const ttl = Number(env.CACHE_TTL_IMMUTABLE) || DEFAULT_CACHE_TTL_IMMUTABLE;
  headers.set('Cache-Control', `public, max-age=${ttl}, immutable`);
  headers.set('CDN-Cache-Control', `public, max-age=${ttl}`);
  applyCorsHeaders(headers);

  // Conditional 304 Not Modified when R2 returns an R2Object without body
  if (request.method === 'GET' && !('body' in object)) {
    return new Response(null, { status: 304, headers });
  }

  let status = 200;
  if (hasRange && object.range && 'offset' in object.range && 'length' in object.range) {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    headers.set('Content-Length', String(object.range.length));
    status = 206;
  } else {
    headers.set('Content-Length', String(object.size));
  }

  const body = request.method === 'HEAD' ? null : object.body;
  const response = new Response(body, { status, headers });

  if (status === 200 && request.method === 'GET') {
    ctx.waitUntil(cache.put(request, response.clone()));
  }

  return response;
}

async function handlePrivateAsset(request, url, env) {
  if (!env.SIGNING_SECRET) {
    return new Response('Signing secret not configured', { status: 500 });
  }

  const signature = url.searchParams.get('sig');
  const expires = url.searchParams.get('exp');
  const path = url.pathname;

  if (!signature || !expires) {
    return new Response('Missing signature or expiration', { status: 403 });
  }

  const expirationTime = Number.parseInt(expires, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(expirationTime) || currentTime > expirationTime) {
    return new Response('Signature expired', { status: 403 });
  }

  const isValid = await validateSignature(env.SIGNING_SECRET, path, expires, signature);
  if (!isValid) {
    return new Response('Invalid signature', { status: 403 });
  }

  // Matches api.mikeodnis.dev R2 key layout: private/<user_id>/<file>
  const objectKey = decodeURIComponent(path.slice(1));
  const object =
    request.method === 'HEAD'
      ? await env.R2_BUCKET.head(objectKey)
      : await env.R2_BUCKET.get(objectKey, { range: request.headers });

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');

  const ttl = Number(env.CACHE_TTL_PRIVATE) || DEFAULT_CACHE_TTL_PRIVATE;
  headers.set('Cache-Control', `private, max-age=${ttl}`);
  applyCorsHeaders(headers);

  let status = 200;
  if (request.headers.has('range') && object.range && 'offset' in object.range && 'length' in object.range) {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    headers.set('Content-Length', String(object.range.length));
    status = 206;
  } else {
    headers.set('Content-Length', String(object.size));
  }

  return new Response(request.method === 'HEAD' ? null : object.body, { status, headers });
}

async function handleImageProxy(request, url, env, ctx) {
  if (!env.IMGPROXY_URL || !env.R2_BUCKET_NAME) {
    return new Response('Image proxy not configured', { status: 503 });
  }

  const imgPath = decodeURIComponent(url.pathname.slice('/img/'.length));
  if (!imgPath || imgPath.startsWith('private/')) {
    return new Response('Forbidden', { status: 403 });
  }

  const width = sanitizeDimension(url.searchParams.get('w'));
  const height = sanitizeDimension(url.searchParams.get('h'));
  const quality = sanitizeQuality(url.searchParams.get('q'));
  const format = sanitizeFormat(url.searchParams.get('f'));

  const sourceUrl = `s3://${env.R2_BUCKET_NAME}/${imgPath}`;
  const encodedSource = base64UrlEncode(new TextEncoder().encode(sourceUrl));
  const baseImgproxy = env.IMGPROXY_URL.replace(/\/+$/, '');
  const imgproxyUrl = `${baseImgproxy}/unsafe/rs:fit:${width}:${height}:0/q:${quality}/${encodedSource}.${format}`;

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  if (request.method === 'GET') {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const upstream = await fetch(imgproxyUrl, {
    method: request.method,
    headers: {
      Accept: request.headers.get('Accept') || 'image/avif,image/webp,*/*',
    },
  });

  if (!upstream.ok) {
    return new Response('Image processing failed', { status: upstream.status });
  }

  const headers = new Headers(upstream.headers);
  const ttl = Number(env.CACHE_TTL_IMMUTABLE) || DEFAULT_CACHE_TTL_IMMUTABLE;
  headers.set('Cache-Control', `public, max-age=${ttl}, immutable`);
  headers.set('CDN-Cache-Control', `public, max-age=${ttl}`);
  applyCorsHeaders(headers);

  const response = new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers,
  });

  if (request.method === 'GET' && upstream.status === 200) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}

async function validateSignature(secret, path, expires, signature) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const macBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(`${path}:${expires}`));
  const expected = base64UrlEncode(new Uint8Array(macBuffer));

  const a = encoder.encode(expected);
  const b = encoder.encode(signature);
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(a, b);
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sanitizeDimension(raw) {
  if (!raw) return '0';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 4096) return '0';
  return String(n);
}

function sanitizeQuality(raw) {
  if (!raw) return '85';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 10 || n > 100) return '85';
  return String(n);
}

function sanitizeFormat(raw) {
  const allowed = new Set(['webp', 'avif', 'jpg', 'jpeg', 'png']);
  const f = (raw || 'webp').toLowerCase();
  return allowed.has(f) ? f : 'webp';
}

function applyCorsHeaders(headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Expose-Headers', 'ETag, Content-Length, Content-Range');
}

function handleOptions() {
  const headers = new Headers();
  applyCorsHeaders(headers);
  headers.set('Access-Control-Allow-Headers', 'Range, If-None-Match, Accept');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}
