import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { OnModuleDestroy } from '@nestjs/common';
import type { ObjectReader, ObjectStorage } from '@api/contracts/object-storage.port';

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
export class S3ObjectStorage implements ObjectStorage, ObjectReader, OnModuleDestroy {
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

  async get(input: { readonly key: string }): Promise<Buffer> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: input.key }));
    if (object.Body === undefined) throw new Error(`The store answered no body for ${input.key}`);
    return Buffer.from(await object.Body.transformToByteArray());
  }

  /**
   * The client's sockets released with the application (task 47.1). Since the request tier reads files back, every
   * application builds this client, not the worker's alone — and one never destroyed outlives its application, which in
   * a suite booting an application per file is every file's.
   */
  onModuleDestroy(): void {
    this.client.destroy();
  }
}
