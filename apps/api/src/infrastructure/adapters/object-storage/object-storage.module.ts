import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import { OBJECT_STORAGE } from '@api/contracts/object-storage.port';
import { S3ObjectStorage } from './s3-object-storage';

/**
 * Object storage for the worker's export job (task 44.2). **It refuses to start without its endpoint and keys**: a
 * worker that could render a file it cannot keep would record failures for a reason no retry can fix.
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
          throw new Error(`The worker stores exports and requires ${missing.join(', ')}.`);
        }
        return new S3ObjectStorage({ endpoint, region, bucket, accessKeyId, secretAccessKey });
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class ObjectStorageModule {}
