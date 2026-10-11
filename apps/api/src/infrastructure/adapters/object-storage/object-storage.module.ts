import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import { OBJECT_READER, OBJECT_STORAGE } from '@api/contracts/object-storage.port';
import { S3ObjectStorage } from './s3-object-storage';

/**
 * Object storage — the worker's export jobs store their files (task 44.2), and since task 47.1 the request tier reads
 * them back for the re-download, so both entrypoints import it. **It refuses to start without its endpoint and keys**:
 * a worker that could render a file it cannot keep would record failures no retry can fix, and an api that cannot read
 * a stored file would answer every re-download with a failure.
 */
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { endpoint, region, bucket, accessKeyId, secretAccessKey } = config.get('objectStorage', { infer: true });
        const missing = Object.entries({
          OBJECT_STORAGE_ENDPOINT: endpoint,
          OBJECT_STORAGE_ACCESS_KEY_ID: accessKeyId,
          OBJECT_STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
        }).flatMap(([name, value]) => (value ? [] : [name]));
        if (missing.length > 0 || !endpoint || !accessKeyId || !secretAccessKey) {
          throw new Error(`Exports are stored and read back, which requires ${missing.join(', ')}.`);
        }
        return new S3ObjectStorage({ endpoint, region, bucket, accessKeyId, secretAccessKey });
      },
    },
    // One client for both faces: the re-download reads through the same adapter the job stores through.
    { provide: OBJECT_READER, useExisting: OBJECT_STORAGE },
  ],
  exports: [OBJECT_STORAGE, OBJECT_READER],
})
export class ObjectStorageModule {}
