import { encodeBase64Url, type ImageTransform } from '../domain/asset.js';
import type { ImageProxyPort, ImageProxyResponse } from '../domain/ports.js';

export class ImgproxyClient implements ImageProxyPort {
  private readonly encoder = new TextEncoder();

  constructor(
    private readonly baseUrl: string | undefined,
    private readonly bucketName: string | undefined,
    private readonly fetcher: typeof fetch = fetch
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
    const encodedSource = encodeBase64Url(this.encoder.encode(sourceUrl));
    const base = (this.baseUrl || '').replace(/\/+$/, '');
    const target = `${base}/unsafe/rs:fit:${transform.width}:${transform.height}:0/q:${transform.quality}/${encodedSource}.${transform.format}`;

    const upstream = await this.fetcher(target, {
      method,
      headers: { Accept: acceptHeader },
    });

    return {
      ok: upstream.ok,
      status: upstream.status,
      headers: upstream.headers,
      body: upstream.body,
    };
  }
}
