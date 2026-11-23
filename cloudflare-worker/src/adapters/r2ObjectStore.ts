import type { ByteRange, ObjectStorePort, ReadObjectOptions, StoredObject } from '../domain/ports.js';

function extractRange(raw: R2Range | undefined): ByteRange | undefined {
  if (!raw || !('offset' in raw) || !('length' in raw)) {
    return undefined;
  }
  if (typeof raw.offset !== 'number' || typeof raw.length !== 'number') {
    return undefined;
  }
  return { offset: raw.offset, length: raw.length };
}

function toStoredObject(obj: R2Object | R2ObjectBody): StoredObject {
  const hasBody = 'body' in obj;
  const range = extractRange(obj.range);
  return {
    size: obj.size,
    etag: obj.httpEtag,
    body: hasBody ? obj.body : null,
    hasBody,
    ...(range ? { range } : {}),
    writeHttpMetadata(headers: Headers): void {
      obj.writeHttpMetadata(headers);
    },
  };
}

export class R2ObjectStore implements ObjectStorePort {
  constructor(private readonly bucket: R2Bucket) {}

  async get(key: string, options: ReadObjectOptions): Promise<StoredObject | null> {
    const r2Opts: R2GetOptions = options.includeConditional
      ? { range: options.headers, onlyIf: options.headers }
      : { range: options.headers };

    const obj = await this.bucket.get(key, r2Opts);
    return obj ? toStoredObject(obj) : null;
  }

  async head(key: string): Promise<StoredObject | null> {
    const obj = await this.bucket.head(key);
    return obj ? toStoredObject(obj) : null;
  }
}
