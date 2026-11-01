import { crc32, deflateRawSync } from 'node:zlib';
import type { ZipEntry } from './read-zip.js';

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_LENGTH = 30;
const CENTRAL_HEADER_LENGTH = 46;
const DEFLATED = 8;
/** General-purpose flag bit 11: the name is UTF-8. */
const FLAG_UTF8_NAME = 0x0800;
const ENCODER = new TextEncoder();

/**
 * A part the template does not have, as a new entry laid out after every entry read (task 46.5's cell notes).
 *
 * **Its version fields and its timestamp are another entry's** (`like`) — the workbook part's, by the caller — so an
 * export made twice from one report is the same bytes twice: a timestamp from the clock would make every file differ
 * from the last in a field no reader looks at, and an export's digest is FR-53's record of the file. No extra field,
 * no comment, no external attributes: nothing Excel writes for a part needs them.
 */
export function newEntry(input: { readonly name: string; readonly content: Uint8Array; readonly like: ZipEntry; readonly after: number }): ZipEntry {
  const name = ENCODER.encode(input.name);
  const compressed = deflateRawSync(input.content);
  const checksum = crc32(input.content);
  const like = new DataView(input.like.centralRecord.buffer, input.like.centralRecord.byteOffset, input.like.centralRecord.byteLength);

  const localRecord = new Uint8Array(LOCAL_HEADER_LENGTH + name.byteLength + compressed.byteLength);
  const local = new DataView(localRecord.buffer);
  local.setUint32(0, LOCAL_SIGNATURE, true);
  local.setUint16(4, like.getUint16(6, true), true); // version needed to extract
  local.setUint16(6, FLAG_UTF8_NAME, true);
  local.setUint16(8, DEFLATED, true);
  local.setUint16(10, like.getUint16(12, true), true); // modification time
  local.setUint16(12, like.getUint16(14, true), true); // modification date
  local.setUint32(14, checksum, true);
  local.setUint32(18, compressed.byteLength, true);
  local.setUint32(22, input.content.byteLength, true);
  local.setUint16(26, name.byteLength, true);
  local.setUint16(28, 0, true);
  localRecord.set(name, LOCAL_HEADER_LENGTH);
  localRecord.set(compressed, LOCAL_HEADER_LENGTH + name.byteLength);

  const centralRecord = new Uint8Array(CENTRAL_HEADER_LENGTH + name.byteLength);
  const central = new DataView(centralRecord.buffer);
  central.setUint32(0, CENTRAL_SIGNATURE, true);
  central.setUint16(4, like.getUint16(4, true), true); // version made by
  central.setUint16(6, like.getUint16(6, true), true);
  central.setUint16(8, FLAG_UTF8_NAME, true);
  central.setUint16(10, DEFLATED, true);
  central.setUint16(12, like.getUint16(12, true), true);
  central.setUint16(14, like.getUint16(14, true), true);
  central.setUint32(16, checksum, true);
  central.setUint32(20, compressed.byteLength, true);
  central.setUint32(24, input.content.byteLength, true);
  central.setUint16(28, name.byteLength, true);
  centralRecord.set(name, CENTRAL_HEADER_LENGTH);

  return {
    name: input.name,
    // Laid out after every entry read: `writeZip` orders local records by this, and only the order is read from it.
    localOffset: input.after,
    localRecord,
    centralRecord,
    method: DEFLATED,
    flags: FLAG_UTF8_NAME,
    crc32: checksum,
    compressedSize: compressed.byteLength,
    uncompressedSize: input.content.byteLength,
    dataOffset: LOCAL_HEADER_LENGTH + name.byteLength,
  };
}
