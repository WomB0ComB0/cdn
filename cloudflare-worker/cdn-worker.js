/**
 * Cloudflare Worker for CDN with signed URL validation
 * Handles both public R2 assets and private assets with signature validation
 * Also routes image transformations to imgproxy
 */

// Configuration
const R2_BUCKET_NAME = 'your-bucket-name';
const SIGNING_SECRET = 'your-signing-secret';
const IMGPROXY_URL = 'https://your-imgproxy-instance.com';
const CACHE_TTL_IMMUTABLE = 31536000; // 1 year
const CACHE_TTL_PRIVATE = 3600; // 1 hour

/**
 * Main request handler
 */
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Handle incoming requests
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  // Image transformation requests
  if (path.startsWith('/img/')) {
    return handleImageProxy(request, url);
  }

  // Private assets (require signature)
  if (path.startsWith('/private/')) {
    return handlePrivateAsset(request, url);
  }

  // Public assets
  if (path.startsWith('/assets/')) {
    return handlePublicAsset(request, url);
  }

  // Default: return 404
  return new Response('Not Found', { status: 404 });
}

/**
 * Handle public asset requests from R2
 */
async function handlePublicAsset(request, url) {
  const objectKey = url.pathname.slice(1); // Remove leading slash

  // Check cache first
  const cache = caches.default;
  let response = await cache.match(request);
  
  if (response) {
    return response;
  }

  // Fetch from R2
  try {
    const object = await R2_BUCKET.get(objectKey);
    
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    // Immutable cache for assets with content hash
    if (objectKey.includes('/assets/')) {
      headers.set('Cache-Control', `public, max-age=${CACHE_TTL_IMMUTABLE}, immutable`);
      headers.set('CDN-Cache-Control', `public, max-age=${CACHE_TTL_IMMUTABLE}`);
    }

    // CORS headers
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    
    response = new Response(object.body, {
      headers,
      status: 200,
    });

    // Store in cache
    event.waitUntil(cache.put(request, response.clone()));
    
    return response;
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Handle private asset requests with signature validation
 */
async function handlePrivateAsset(request, url) {
  const signature = url.searchParams.get('sig');
  const expires = url.searchParams.get('exp');
  const path = url.pathname;

  // Validate signature
  if (!signature || !expires) {
    return new Response('Missing signature or expiration', { status: 403 });
  }

  // Check expiration
  const expirationTime = parseInt(expires, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (currentTime > expirationTime) {
    return new Response('Signature expired', { status: 403 });
  }

  // Validate HMAC signature
  const isValid = await validateSignature(path, expires, signature);
  if (!isValid) {
    return new Response('Invalid signature', { status: 403 });
  }

  // Extract object key (remove /private/ prefix)
  const objectKey = path.replace('/private/', '');

  // Fetch from R2
  try {
    const object = await R2_BUCKET.get(objectKey);
    
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', `private, max-age=${CACHE_TTL_PRIVATE}`);
    
    return new Response(object.body, {
      headers,
      status: 200,
    });
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Handle image transformation requests via imgproxy
 */
async function handleImageProxy(request, url) {
  // Extract image path and transformation parameters
  const imgPath = url.pathname.replace('/img/', '');
  
  // Parse transformation params from query string
  const width = url.searchParams.get('w') || 'auto';
  const height = url.searchParams.get('h') || 'auto';
  const quality = url.searchParams.get('q') || '85';
  const format = url.searchParams.get('f') || 'auto';
  const fit = url.searchParams.get('fit') || 'cover';

  // Build imgproxy URL
  // Format: /width/height/gravity/enlarge/encoded_source_url.format
  const sourceUrl = `s3://${R2_BUCKET_NAME}/${imgPath}`;
  const encodedSource = btoa(sourceUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const imgproxyPath = `/${width}/${height}/sm/0/${encodedSource}.${format}`;
  const imgproxyUrl = `${IMGPROXY_URL}${imgproxyPath}`;

  // Check cache
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  let response = await cache.match(cacheKey);

  if (response) {
    return response;
  }

  // Fetch from imgproxy
  try {
    response = await fetch(imgproxyUrl, {
      headers: {
        'X-Original-Request': request.url,
      },
    });

    if (!response.ok) {
      return new Response('Image processing failed', { status: response.status });
    }

    // Add cache headers
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', `public, max-age=${CACHE_TTL_IMMUTABLE}, immutable`);
    headers.set('Access-Control-Allow-Origin', '*');

    const cachedResponse = new Response(response.body, {
      status: response.status,
      headers,
    });

    // Store in cache
    event.waitUntil(cache.put(cacheKey, cachedResponse.clone()));

    return cachedResponse;
  } catch (error) {
    return new Response('Image processing error', { status: 500 });
  }
}

/**
 * Validate HMAC signature
 */
async function validateSignature(path, expires, signature) {
  const message = `${path}:${expires}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SIGNING_SECRET);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return signature === expectedSignature;
}

/**
 * Handle CORS preflight requests
 */
function handleOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}
