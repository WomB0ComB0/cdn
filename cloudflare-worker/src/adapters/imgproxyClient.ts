import { CdnError, encodeBase64Url, type ImageTransform } from '../domain/asset.js';
import type { ImageProxyPort, ImageProxyResponse } from '../domain/ports.js';

const ENCODER = new TextEncoder();
const DEFAULT_IMGPROXY_TIMEOUT_MS = 10_000;

export class ImgproxyClient implements ImageProxyPort {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly bucketName: string | undefined,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs: number = DEFAULT_IMGPROXY_TIMEOUT_MS
  ) {}

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.bucketName);
  }

  async fetchTransformed(
    method: 'GET' | 'HEAD',
    transform: ImageTransform,
    acceptHeader: string
  ): Promise<ImageProxyResponse> {
    const sourceUrl = `s3://${this.bucketName}/${transform.sourceKey}`;
    const encodedSource = encodeBase64Url(ENCODER.encode(sourceUrl));
    const base = (this.baseUrl || '').replace(/\/+$/, '');
    const target = `${base}/unsafe/rs:fit:${transform.width}:${transform.height}:0/q:${transform.quality}/${encodedSource}.${transform.format}`;

    try {
      const upstream = await this.fetcher(target, {
        method,
        headers: { Accept: acceptHeader },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      return {
        ok: upstream.ok,
        status: upstream.status,
        headers: upstream.headers,
        body: upstream.body,
      };
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new CdnError(504, 'Image proxy timed out');
      }
      throw new CdnError(502, 'Image proxy unavailable');
    }
  }
}
