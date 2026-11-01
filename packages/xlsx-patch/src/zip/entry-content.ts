import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';
import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import type { ZipEntry } from './read-zip.js';

const METHOD = { STORED: 0, DEFLATED: 8 } as const;
/** General-purpose flag bit 11: the name is UTF-8. The one flag a replaced entry carries over. */
const FLAG_UTF8_NAME = 0x0800;

/**
 * An entry's content, decompressed and checked against the CRC-32 its central record carries.
 *
 * **Checked, because a part read wrong would be patched wrong.** A sheet whose bytes inflated to something other than
 * what was stored would still parse — and the patch would then write a cell into it and re-deflate the damage under a
 * fresh, valid checksum, laundering it. Only stored and deflated entries can be read; an Office archive uses no other.
 */
export function entryContent(entry: ZipEntry): Uint8Array {
  const data = entry.localRecord.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.method !== METHOD.STORED && entry.method !== METHOD.DEFLATED) {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE, `${entry.name} is compressed by method ${entry.method}`);
  }
  let content: Uint8Array;
  try {
    content = entry.method === METHOD.STORED ? data : inflateRawSync(data);
  } catch {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE, `${entry.name} does not inflate`);
  }

  if (content.byteLength !== entry.uncompressedSize || crc32(content) !== entry.crc32) {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE, `${entry.name} does not match its checksum`);
  }
  return content;
}

/**
 * The same entry holding new content — deflated, with a fresh checksum and sizes, and every other field of both its
 * records kept: its name, its timestamp, its extra field, its version fields and its external attributes.
 *
 * **The flags are reset to the one that describes the name**, because the others described the data that was replaced:
 * the compression-option bits named how the old data was deflated, and a data descriptor no longer follows — the new
 * sizes are in the header.
 */
export function replaceContent(entry: ZipEntry, content: Uint8Array): ZipEntry {
  const compressed = deflateRawSync(content);
  const checksum = crc32(content);
  const flags = entry.flags & FLAG_UTF8_NAME;

  const header = entry.localRecord.slice(0, entry.dataOffset);
  const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
  headerView.setUint16(6, flags, true);
  headerView.setUint16(8, METHOD.DEFLATED, true);
  headerView.setUint32(14, checksum, true);
  headerView.setUint32(18, compressed.byteLength, true);
  headerView.setUint32(22, content.byteLength, true);

  const localRecord = new Uint8Array(header.byteLength + compressed.byteLength);
  localRecord.set(header, 0);
  localRecord.set(compressed, header.byteLength);

  const centralRecord = entry.centralRecord.slice();
  const centralView = new DataView(centralRecord.buffer, centralRecord.byteOffset, centralRecord.byteLength);
  centralView.setUint16(8, flags, true);
  centralView.setUint16(10, METHOD.DEFLATED, true);
  centralView.setUint32(16, checksum, true);
  centralView.setUint32(20, compressed.byteLength, true);
  centralView.setUint32(24, content.byteLength, true);

  return {
    ...entry,
    localRecord,
    centralRecord,
    method: METHOD.DEFLATED,
    flags,
    crc32: checksum,
    compressedSize: compressed.byteLength,
    uncompressedSize: content.byteLength,
    dataOffset: header.byteLength,
  };
}
