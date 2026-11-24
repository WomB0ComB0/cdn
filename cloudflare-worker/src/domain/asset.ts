import {
  type Brand,
  isFiniteNumber,
  isInRange,
  isNonEmptyString,
  unsafeBrand,
} from '@resq-systems/types';

export type HttpMethod = 'GET' | 'HEAD';
export type ObjectKey = Brand<string, 'ObjectKey'>;
export type Pathname = Brand<string, 'Pathname'>;
export type UnixSeconds = Brand<number, 'UnixSeconds'>;

export class CdnError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly headers?: Record<string, string>
  ) {
    super(message);
    this.name = 'CdnError';
  }
}

const UNSAFE_PATH_CHARS = /[\u0000-\u001f\u007f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

export class AssetPath {
  private constructor(
    public readonly pathname: Pathname,
    public readonly objectKey: ObjectKey
  ) {}

  static parse(rawPathname: string): AssetPath {
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawPathname);
    } catch {
      throw new CdnError(400, 'Bad Request');
    }

    if (
      decoded.includes('..') ||
      decoded.includes('\\') ||
      decoded.includes('//') ||
      UNSAFE_PATH_CHARS.test(decoded) ||
      UNSAFE_PATH_CHARS.test(rawPathname)
    ) {
      throw new CdnError(400, 'Bad Request');
    }

    const objectKey = decoded.startsWith('/') ? decoded.slice(1) : decoded;
    if (!isNonEmptyString(objectKey)) {
      throw new CdnError(404, 'Not Found');
    }

    return new AssetPath(
      unsafeBrand<'Pathname', string>(rawPathname),
      unsafeBrand<'ObjectKey', string>(objectKey)
    );
  }
}

export interface SignedRequestParams {
  readonly pathname: Pathname;
  readonly objectKey: ObjectKey;
  readonly expiresRaw: string;
  readonly expiresUnix: UnixSeconds;
  readonly signature: string;
}

const EXPIRES_RE = /^\d{1,12}$/;
const BASE64URL_SIG_RE = /^[A-Za-z0-9_-]{32,128}$/;

export function parseSignedRequest(
  asset: AssetPath,
  signature: string | null,
  expiresRaw: string | null,
  nowSeconds: number
): SignedRequestParams {
  if (!isNonEmptyString(signature) || !isNonEmptyString(expiresRaw)) {
    throw new CdnError(403, 'Missing signature or expiration');
  }
  if (!EXPIRES_RE.test(expiresRaw) || !BASE64URL_SIG_RE.test(signature)) {
    throw new CdnError(403, 'Invalid signature format');
  }

  const expiresUnix = Number(expiresRaw);
  if (!isFiniteNumber(expiresUnix) || nowSeconds > expiresUnix) {
    throw new CdnError(403, 'Signature expired');
  }

  return {
    pathname: asset.pathname,
    objectKey: asset.objectKey,
    expiresRaw,
    expiresUnix: unsafeBrand<'UnixSeconds', number>(expiresUnix),
    signature,
  };
}

export type ImageFormat = 'webp' | 'avif' | 'jpg' | 'jpeg' | 'png';

const ALLOWED_FORMATS: ReadonlySet<string> = new Set<ImageFormat>([
  'webp',
  'avif',
  'jpg',
  'jpeg',
  'png',
]);

export interface ImageTransform {
  readonly sourceKey: ObjectKey;
  readonly width: number;
  readonly height: number;
  readonly quality: number;
  readonly format: ImageFormat;
}

const RASTER_SOURCE_EXT_RE = /\.(?:jpe?g|png|gif|webp|avif)$/i;

export function parseImageTransform(
  asset: AssetPath,
  query: { width?: string | null; height?: string | null; quality?: string | null; format?: string | null }
): ImageTransform {
  const sourceKey = asset.objectKey.startsWith('img/')
    ? asset.objectKey.slice('img/'.length)
    : asset.objectKey;

  // Fail-closed allowlist: only public raster assets/* images may ever be sent to imgproxy.
  if (!isNonEmptyString(sourceKey) || !sourceKey.startsWith('assets/')) {
    throw new CdnError(403, 'Forbidden');
  }
  if (!RASTER_SOURCE_EXT_RE.test(sourceKey)) {
    throw new CdnError(415, 'Unsupported image format for transform');
  }

  return {
    sourceKey: unsafeBrand<'ObjectKey', string>(sourceKey),
    width: sanitizeDimension(query.width),
    height: sanitizeDimension(query.height),
    quality: sanitizeQuality(query.quality),
    format: sanitizeFormat(query.format),
  };
}

const isValidDimension = isInRange(0, 4096);
const isValidQuality = isInRange(10, 100);

export function sanitizeDimension(raw?: string | null): number {
  if (!isNonEmptyString(raw)) return 0;
  const n = Number.parseInt(raw, 10);
  return isValidDimension(n) ? n : 0;
}

export function sanitizeQuality(raw?: string | null): number {
  if (!isNonEmptyString(raw)) return 85;
  const n = Number.parseInt(raw, 10);
  return isValidQuality(n) ? n : 85;
}

export function sanitizeFormat(raw?: string | null): ImageFormat {
  const f = (raw || 'webp').toLowerCase();
  return ALLOWED_FORMATS.has(f) ? (f as ImageFormat) : 'webp';
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
