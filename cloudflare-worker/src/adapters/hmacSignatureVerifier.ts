import { encodeBase64Url } from '../domain/asset.js';
import type { SignatureVerifierPort } from '../domain/ports.js';

type SubtleWithTimingSafe = SubtleCrypto & {
  timingSafeEqual?: (a: ArrayBufferView | ArrayBuffer, b: ArrayBufferView | ArrayBuffer) => boolean;
};

const ENCODER = new TextEncoder();

// Isolate-level cache avoids re-importing the same HMAC CryptoKey on every /private/* request
let cachedSecret: string | null = null;
let cachedKeyPromise: Promise<CryptoKey> | null = null;

function getHmacKey(secret: string): Promise<CryptoKey> {
  if (cachedSecret === secret && cachedKeyPromise) {
    return cachedKeyPromise;
  }
  cachedSecret = secret;
  cachedKeyPromise = crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return cachedKeyPromise;
}

export class HmacSignatureVerifier implements SignatureVerifierPort {
  constructor(private readonly secret: string) {}

  async verify(pathname: string, expiresRaw: string, signature: string): Promise<boolean> {
    if (!this.secret) {
      return false;
    }

    const key = await getHmacKey(this.secret);
    const mac = await crypto.subtle.sign('HMAC', key, ENCODER.encode(`${pathname}:${expiresRaw}`));
    const expected = encodeBase64Url(new Uint8Array(mac));

    const a = ENCODER.encode(expected);
    const b = ENCODER.encode(signature);
    if (a.byteLength !== b.byteLength) {
      return false;
    }

    const subtle = crypto.subtle as SubtleWithTimingSafe;
    if (typeof subtle.timingSafeEqual === 'function') {
      return subtle.timingSafeEqual(a, b);
    }

    let diff = 0;
    for (let i = 0; i < a.byteLength; i++) {
      diff |= a[i]! ^ b[i]!;
    }
    return diff === 0;
  }
}
