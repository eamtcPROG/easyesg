import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { PATCH_REFUSAL } from '../patch-refusal.js';
import { refusalOf } from '../testing/refusal-of.js';
import { COMMITTED_TEMPLATE, committedTemplate } from '../testing/committed-templates.js';
import { entryContent, replaceContent } from './entry-content.js';
import { readZip } from './read-zip.js';
import { writeZip } from './write-zip.js';


/** Bytes of a committed template with one 32-bit or 16-bit field of its end record or a central record changed. */
const withField = (bytes: Uint8Array, at: number, value: number, width: 2 | 4): Uint8Array => {
  const copy = bytes.slice();
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  if (width === 2) view.setUint16(at, value, true);
  else view.setUint32(at, value, true);
  return copy;
};
const endRecordOf = (bytes: Uint8Array): number => Buffer.from(bytes).lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));

describe('the zip codec (task 45.1)', () => {
  describe.each(Object.values(COMMITTED_TEMPLATE))('%s', (file) => {
    const bytes = committedTemplate(file);

    it('reads and writes the archive back byte for byte', () => {
      expect(Buffer.from(writeZip(readZip(bytes))).equals(Buffer.from(bytes))).toBe(true);
    });

    it('reads every entry, and each one inflates to the size and checksum its record states', () => {
      const archive = readZip(bytes);
      expect(archive.entries.length).toBeGreaterThan(0);
      for (const entry of archive.entries) expect(entryContent(entry).byteLength).toBe(entry.uncompressedSize);
    });
  });

  /**
   * **Why the round trip above can fail, and what it would take.** Content read and deflated again — what a zip
   * library does to every entry it writes — does not reproduce Excel's compressed bytes even when the content is
   * identical. So the identity above holds only because the codec copies records rather than re-encoding them, and a
   * codec that re-encoded would turn it red.
   */
  it('changes the bytes of an entry whose unchanged content is deflated again', () => {
    const bytes = committedTemplate(COMMITTED_TEMPLATE.V1_3_0);
    const archive = readZip(bytes);
    const sheet = archive.entries.find((entry) => entry.name === 'xl/worksheets/sheet4.xml');
    if (sheet === undefined) throw new Error('the template has no sheet4');
    const recompressed = { ...archive, entries: archive.entries.map((entry) => (entry === sheet ? replaceContent(entry, entryContent(entry)) : entry)) };

    const written = writeZip(recompressed);
    expect(Buffer.from(written).equals(Buffer.from(bytes))).toBe(false);
    // …and is still the same content, under its new checksum.
    const reread = readZip(written).entries.find((entry) => entry.name === sheet.name);
    expect(reread === undefined ? null : Buffer.from(entryContent(reread)).equals(Buffer.from(entryContent(sheet)))).toBe(true);
  });

  it('keeps an archive comment', () => {
    const bytes = committedTemplate(COMMITTED_TEMPLATE.V1_2_0);
    const comment = Buffer.from('kept as written');
    const end = endRecordOf(bytes);
    const commented = Buffer.concat([withField(bytes, end + 20, comment.byteLength, 2), comment]);

    expect(Buffer.from(writeZip(readZip(commented))).equals(commented)).toBe(true);
  });

  describe('refuses what it could not reproduce', () => {
    const bytes = committedTemplate(COMMITTED_TEMPLATE.V1_2_0);
    const end = endRecordOf(bytes);
    const centralOffset = new DataView(bytes.buffer, bytes.byteOffset).getUint32(end + 16, true);

    it('bytes that are no zip at all', () => {
      expect(refusalOf(() => readZip(new Uint8Array(64)))).toBe(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE);
    });

    it('a zip64 archive', () => {
      expect(refusalOf(() => readZip(withField(bytes, end + 10, 0xffff, 2)))).toBe(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE);
    });

    it('an archive spanning disks', () => {
      expect(refusalOf(() => readZip(withField(bytes, end + 4, 1, 2)))).toBe(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE);
    });

    it('bytes before the first record', () => {
      const prefixed = Buffer.concat([Buffer.from('PK!!'), bytes]);
      expect(refusalOf(() => readZip(prefixed))).toBe(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE);
    });

    it('an encrypted entry', () => {
      expect(refusalOf(() => readZip(withField(bytes, centralOffset + 8, 0x0001, 2)))).toBe(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE);
    });

    it('a local header that states other sizes or another checksum than its central record', () => {
      expect(refusalOf(() => readZip(withField(bytes, centralOffset + 16, 0, 4)))).toBe(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE);
      expect(refusalOf(() => readZip(withField(bytes, centralOffset + 20, 1, 4)))).toBe(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE);
    });

    it('content that does not match the checksum both records state', () => {
      // The first entry's local record is at offset 0; its checksum field is at 14 there and at 16 in the directory.
      const archive = readZip(withField(withField(bytes, 14, 0, 4), centralOffset + 16, 0, 4));
      expect(refusalOf(() => entryContent(archive.entries[0]))).toBe(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE);
    });

    it('compressed data that does not inflate', () => {
      const archive = readZip(bytes);
      const deflated = archive.entries.find((entry) => entry.method === 8 && entry.compressedSize > 16);
      if (deflated === undefined) throw new Error('the template has no deflated entry');
      const broken = deflated.localRecord.slice();
      broken.fill(0xff, deflated.dataOffset, deflated.dataOffset + 8);
      expect(refusalOf(() => entryContent({ ...deflated, localRecord: broken }))).toBe(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE);
    });
  });
});
