import { S3Client } from '@aws-sdk/client-s3';
import { S3ObjectStorage } from './s3-object-storage';

/** The adapter's lifecycle (task 47.1): every application builds the client now, so each must release it. */
describe('S3ObjectStorage', () => {
  it('destroys its client when its module is torn down', () => {
    const destroy = jest.spyOn(S3Client.prototype, 'destroy');
    const storage = new S3ObjectStorage({
      endpoint: 'http://127.0.0.1:9000',
      region: 'fr-par',
      bucket: 'exports',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    });

    storage.onModuleDestroy();

    expect(destroy).toHaveBeenCalledTimes(1);
    destroy.mockRestore();
  });
});
