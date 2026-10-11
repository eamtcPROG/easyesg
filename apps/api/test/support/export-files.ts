import { randomUUID } from 'node:crypto';
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import type { DataSource } from 'typeorm';
import { S3ObjectStorage } from '@api/infrastructure/adapters/object-storage/s3-object-storage';

const BUCKET = 'esg-exports';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; the test stack's env files supply it.`);
  return value;
};

/** The test stack's object storage, as the worker's adapter reaches it. */
export const exportStorage = (): S3ObjectStorage =>
  new S3ObjectStorage({
    endpoint: required('OBJECT_STORAGE_ENDPOINT'),
    region: process.env.OBJECT_STORAGE_REGION ?? 'fr-par',
    bucket: process.env.OBJECT_STORAGE_BUCKET ?? BUCKET,
    accessKeyId: required('OBJECT_STORAGE_ACCESS_KEY_ID'),
    secretAccessKey: required('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
  });

/** A client that reads back what an export stored, and clears an organization's files after a suite. */
export function storageReader(): {
  readonly client: S3Client;
  file(key: string): Promise<Uint8Array>;
  contentType(key: string): Promise<string | undefined>;
  removeOrganization(organizationId: string): Promise<void>;
} {
  const client = new S3Client({
    endpoint: required('OBJECT_STORAGE_ENDPOINT'),
    region: process.env.OBJECT_STORAGE_REGION ?? 'fr-par',
    credentials: { accessKeyId: required('OBJECT_STORAGE_ACCESS_KEY_ID'), secretAccessKey: required('OBJECT_STORAGE_SECRET_ACCESS_KEY') },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const object = (key: string) => client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return {
    client,
    file: async (key) => (await object(key)).Body?.transformToByteArray() ?? new Uint8Array(),
    contentType: async (key) => (await object(key)).ContentType,
    removeOrganization: async (organizationId) => {
      const listed = await client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `organizations/${organizationId}/` }));
      const keys = (listed.Contents ?? []).flatMap((entry) => (entry.Key ? [{ Key: entry.Key }] : []));
      if (keys.length > 0) await client.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys } }));
    },
  };
}

/**
 * An export requested as task 47.4's route will write it: as the application, with the person asking bound, so the
 * record's trigger stamps the requester and the report's pins. Answers the export's id.
 */
export async function requestExport(input: {
  readonly appRole: DataSource;
  readonly organizationId: string;
  readonly accountId: string;
  readonly reportId: string;
  readonly format: string;
  readonly locale: string;
}): Promise<string> {
  const exportId = randomUUID();
  const runner = input.appRole.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(`SELECT set_config('app.current_org', $1, true), set_config('app.current_user', $2, true)`, [
      input.organizationId,
      input.accountId,
    ]);
    await runner.query(
      `INSERT INTO core.export_artifact (id, organization_id, report_id, format, locale) VALUES ($1, $2, $3, $4, $5)`,
      [exportId, input.organizationId, input.reportId, input.format, input.locale],
    );
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
  return exportId;
}
