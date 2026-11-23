import type { EdgeCachePort } from '../domain/ports.js';

export class CloudflareEdgeCache implements EdgeCachePort {
  constructor(
    private readonly cache: Cache,
    private readonly waitUntil: (promise: Promise<unknown>) => void
  ) {}

  async match(request: Request): Promise<Response | undefined> {
    return this.cache.match(request);
  }

  put(request: Request, response: Response): void {
    this.waitUntil(this.cache.put(request, response));
  }
}
