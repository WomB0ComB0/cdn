export type HttpMethod = 'GET' | 'HEAD';

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

export class AssetPath {
  private constructor(
    public readonly pathname: string,
    public readonly objectKey: string
  ) {}

  static parse(rawPathname: string): AssetPath {
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawPathname);
    } catch {
      throw new CdnError(400, 'Bad Request');
    }

    if (decoded.includes('..') || decoded.includes('\\')) {
      throw new CdnError(400, 'Bad Request');
    }

    const objectKey = decoded.startsWith('/') ? decoded.slice(1) : decoded;
    if (!objectKey) {
      throw new CdnError(404, 'Not Found');
    }

    return new AssetPath(rawPathname, objectKey);
  }
}

export interface SignedRequestParams {
  readonly pathname: string;
  readonly objectKey: string;
  readonly expiresRaw: string;
  readonly expiresUnix: number;
  readonly signature: string;
}

export function parseSignedRequest(
  asset: AssetPath,
  signature: string | null,
  expiresRaw: string | null,
  nowSeconds: number
): SignedRequestParams {
  if (!signature || !expiresRaw) {
    throw new CdnError(403, 'Missing signature or expiration');
  }

  const expiresUnix = Number.parseInt(expiresRaw, 10);
  if (!Number.isFinite(expiresUnix) || nowSeconds > expiresUnix) {
    throw new CdnError(403, 'Signature expired');
  }

  return {
    pathname: asset.pathname,
    objectKey: asset.objectKey,
    expiresRaw,
    expiresUnix,
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
  readonly sourceKey: string;
  readonly width: number;
  readonly height: number;
  readonly quality: number;
  readonly format: ImageFormat;
}

export function parseImageTransform(
  asset: AssetPath,
  query: { width?: string | null; height?: string | null; quality?: string | null; format?: string | null }
): ImageTransform {
  const sourceKey = asset.objectKey.startsWith('img/')
    ? asset.objectKey.slice('img/'.length)
    : asset.objectKey;

  if (!sourceKey || sourceKey.startsWith('private/')) {
    throw new CdnError(403, 'Forbidden');
  }

  return {
    sourceKey,
    width: sanitizeDimension(query.width),
    height: sanitizeDimension(query.height),
    quality: sanitizeQuality(query.quality),
    format: sanitizeFormat(query.format),
  };
}

export function sanitizeDimension(raw?: string | null): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 4096) return 0;
  return n;
}

export function sanitizeQuality(raw?: string | null): number {
  if (!raw) return 85;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 10 || n > 100) return 85;
  return n;
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
