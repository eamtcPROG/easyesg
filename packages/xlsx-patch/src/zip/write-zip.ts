import type { ZipArchive, ZipEntry } from './read-zip.js';

const END_SIGNATURE = 0x06054b50;
const END_RECORD_LENGTH = 22;
/** Where a central record keeps the offset of its local record. */
const CENTRAL_LOCAL_OFFSET_FIELD = 42;

/**
 * Writes an archive back out: every local record as it is held, then the central directory, then its end record.
 *
 * **Copying, never re-encoding.** A record is written as the bytes `readZip` kept, and a central record changes in one
 * field only — the offset of its local record, which moves when an earlier record changed length. So an archive read
 * and written with no entry replaced is the archive that was read, byte for byte; the round-trip spec holds that of
 * every committed EFRAG binary, which is task 45.1's whole claim.
 *
 * **Local records keep the order they were read in**, a replaced one taking its predecessor's place, and the directory
 * keeps its own order — the two need not agree, and the writer reproduces whichever each was.
 */
export function writeZip(archive: ZipArchive): Uint8Array {
  const laidOut = [...archive.entries].sort((a, b) => a.localOffset - b.localOffset);
  const offsetOf = new Map<ZipEntry, number>();
  let localLength = 0;
  for (const entry of laidOut) {
    offsetOf.set(entry, localLength);
    localLength += entry.localRecord.byteLength;
  }
  const centralLength = archive.entries.reduce((sum, entry) => sum + entry.centralRecord.byteLength, 0);

  const out = new Uint8Array(localLength + centralLength + END_RECORD_LENGTH + archive.comment.byteLength);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  let cursor = 0;
  for (const entry of laidOut) {
    out.set(entry.localRecord, cursor);
    cursor += entry.localRecord.byteLength;
  }

  const centralOffset = cursor;
  for (const entry of archive.entries) {
    out.set(entry.centralRecord, cursor);
    // Every entry is in `laidOut`, so the lookup always answers; the map is keyed by the entry itself.
    view.setUint32(cursor + CENTRAL_LOCAL_OFFSET_FIELD, offsetOf.get(entry) as number, true);
    cursor += entry.centralRecord.byteLength;
  }

  view.setUint32(cursor, END_SIGNATURE, true);
  view.setUint16(cursor + 4, 0, true);
  view.setUint16(cursor + 6, 0, true);
  view.setUint16(cursor + 8, archive.entries.length, true);
  view.setUint16(cursor + 10, archive.entries.length, true);
  view.setUint32(cursor + 12, centralLength, true);
  view.setUint32(cursor + 16, centralOffset, true);
  view.setUint16(cursor + 20, archive.comment.byteLength, true);
  out.set(archive.comment, cursor + END_RECORD_LENGTH);

  return out;
}
