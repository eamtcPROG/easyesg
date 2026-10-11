import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ObjectStorage } from '@api/contracts/object-storage.port';

/** Where and as whom the store is reached — `endpoint` an S3-compatible one, never AWS's (§12.5.1). */
export interface S3ObjectStorageOptions {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/**
 * `ObjectStorage` over the S3 API, the one vendor type confined here (P-7). Path-style addressing and checksums only
 * where an operation requires them: both are what an S3-compatible store — Scaleway, the Compose stacks' emulator —
 * answers alike, where the SDK's defaults are AWS's own.
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly options: S3ObjectStorageOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async put(input: { readonly key: string; readonly body: Buffer; readonly contentType: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }
}
