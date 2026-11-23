import type { ImageTransform } from './asset.js';

export interface ByteRange {
  readonly offset: number;
  readonly length: number;
}

export interface StoredObject {
  readonly size: number;
  readonly etag: string;
  readonly body: ReadableStream<Uint8Array> | string | Uint8Array | null;
  readonly hasBody: boolean;
  readonly range?: ByteRange;
  writeHttpMetadata(headers: Headers): void;
}

export interface ReadObjectOptions {
  readonly headers: Headers;
  readonly includeConditional?: boolean;
}

export interface ObjectStorePort {
  get(key: string, options: ReadObjectOptions): Promise<StoredObject | null>;
  head(key: string): Promise<StoredObject | null>;
}

export interface EdgeCachePort {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): void;
}

export interface SignatureVerifierPort {
  verify(pathname: string, expiresRaw: string, signature: string): Promise<boolean>;
}

export interface ImageProxyResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: Headers;
  readonly body: ReadableStream<Uint8Array> | null;
}

export interface ImageProxyPort {
  isConfigured(): boolean;
  fetchTransformed(
    method: 'GET' | 'HEAD',
    transform: ImageTransform,
    acceptHeader: string
  ): Promise<ImageProxyResponse>;
}

export interface ClockPort {
  nowSeconds(): number;
}
