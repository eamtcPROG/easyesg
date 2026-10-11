import { createHash } from 'node:crypto';
import { EXPORT_FORMAT } from '../constants/export.constants';
import { ExportFileUnavailableError, ExportNotFoundError } from '../errors/export.errors';
import { FakeExportHistory } from '../testing/export-history.fakes';
import { ReadExportFile } from './read-export-file.use-case';

const REPORT = '00000000-0000-0000-0000-0000000000f1';
const EXPORT_ID = '00000000-0000-0000-0000-0000000000e1';
const KEY = `organizations/o/exports/${EXPORT_ID}.pdf`;
const FILE = Buffer.from('%PDF-1.7 the file as it was sent');
const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

/** UC-44's re-download (task 47.1; FR-53): the stored bytes, held to their digest, only once there are some. */
describe('ReadExportFile', () => {
  const setup = (objects: Record<string, Buffer>) => {
    const history = new FakeExportHistory();
    void history.request({ exportId: EXPORT_ID, reportId: REPORT, format: EXPORT_FORMAT.PDF, locale: 'en' });
    const read = new ReadExportFile(history, { get: ({ key }) => Promise.resolve(objects[key] ?? Buffer.alloc(0)) }, sha256);
    return { history, read };
  };

  it('answers the stored file, byte for byte, once completed', async () => {
    const { history, read } = setup({ [KEY]: FILE });
    history.complete(EXPORT_ID, { objectKey: KEY, sha256: sha256(FILE), byteSize: FILE.length });
    const { body, record } = await read.execute({ exportId: EXPORT_ID });
    expect(body.equals(FILE)).toBe(true);
    expect(record.format).toBe(EXPORT_FORMAT.PDF);
  });

  it('refuses one still being produced, and one there is none of', async () => {
    const { read } = setup({ [KEY]: FILE });
    await expect(read.execute({ exportId: EXPORT_ID })).rejects.toBeInstanceOf(ExportFileUnavailableError);
    await expect(read.execute({ exportId: '00000000-0000-0000-0000-0000000000ef' })).rejects.toBeInstanceOf(ExportNotFoundError);
  });

  it('refuses to serve bytes other than the ones stored', async () => {
    const { history, read } = setup({ [KEY]: Buffer.from('something else') });
    history.complete(EXPORT_ID, { objectKey: KEY, sha256: sha256(FILE), byteSize: FILE.length });
    await expect(read.execute({ exportId: EXPORT_ID })).rejects.toThrow(/does not match the digest/u);
  });
});
