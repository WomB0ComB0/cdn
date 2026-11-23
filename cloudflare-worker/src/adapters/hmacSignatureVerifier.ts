import { encodeBase64Url } from '../domain/asset.js';
import type { SignatureVerifierPort } from '../domain/ports.js';

type SubtleWithTimingSafe = SubtleCrypto & {
  timingSafeEqual?: (a: ArrayBufferView | ArrayBuffer, b: ArrayBufferView | ArrayBuffer) => boolean;
};

export class HmacSignatureVerifier implements SignatureVerifierPort {
  private readonly encoder = new TextEncoder();

  constructor(private readonly secret: string) {}

  async verify(pathname: string, expiresRaw: string, signature: string): Promise<boolean> {
    if (!this.secret) {
      return false;
    }

    const key = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const mac = await crypto.subtle.sign('HMAC', key, this.encoder.encode(`${pathname}:${expiresRaw}`));
    const expected = encodeBase64Url(new Uint8Array(mac));

    const a = this.encoder.encode(expected);
    const b = this.encoder.encode(signature);
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
