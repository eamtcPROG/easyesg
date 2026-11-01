import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';

/**
 * One entry of a zip archive, held as the bytes it occupied rather than as what they mean.
 *
 * **This is the whole of AD-10's "every other part byte for byte".** A zip library reads an entry's content and
 * writes it back by compressing it again, with its own deflater, its own header fields and its own flags — so even an
 * untouched part leaves different from how it arrived. Here an entry is its **local record** (header, name, extra
 * field, compressed data, any data descriptor) and its **central record**, both verbatim, and writing it is copying
 * them. Only an entry whose content the patch changes is ever compressed again (`replaceContent`).
 */
export interface ZipEntry {
  readonly name: string;
  /** Where the local record sat in the archive read — the order the writer lays records out in. */
  readonly localOffset: number;
  /** Header, name, extra field, compressed data and any data descriptor, exactly as read. */
  readonly localRecord: Uint8Array;
  /** The central directory's record for the entry, exactly as read; the writer rewrites its offset field alone. */
  readonly centralRecord: Uint8Array;
  readonly method: number;
  readonly flags: number;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  /** Where the compressed data starts inside {@link localRecord}. */
  readonly dataOffset: number;
}

/** An archive as read: its entries in central-directory order, and the comment its end record carries. */
export interface ZipArchive {
  readonly entries: readonly ZipEntry[];
  readonly comment: Uint8Array;
}

const SIGNATURE = {
  LOCAL: 0x04034b50,
  CENTRAL: 0x02014b50,
  END: 0x06054b50,
  ZIP64_LOCATOR: 0x07064b50,
} as const;

const LOCAL_HEADER_LENGTH = 30;
const CENTRAL_HEADER_LENGTH = 46;
const END_RECORD_LENGTH = 22;
const MAX_COMMENT_LENGTH = 0xffff;
/** General-purpose flag bit 0: the entry is encrypted, and its data cannot be read or recompressed. */
const FLAG_ENCRYPTED = 0x0001;
/** General-purpose flag bit 3: the checksum and sizes follow the data, and the local header carries zeros. */
const FLAG_DATA_DESCRIPTOR = 0x0008;

const refuse = (message: string): never => {
  throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_ARCHIVE, message);
};

/**
 * Reads a zip archive into entries that can be written back unchanged (`writeZip`).
 *
 * **It refuses every layout it could not reproduce byte for byte**, rather than reading it and writing something
 * else: zip64, an archive spanning disks, an encrypted entry, bytes before the first record, or a gap between the
 * central directory and its end record. None is a shape Excel writes, and the round-trip spec holds that EFRAG's
 * binaries are none of them — so a refusal here is a template that is not the one registered, said loudly.
 *
 * **A gap between two local records is kept, not refused**: a record runs from its own offset to the next one's, so
 * anything between them travels with the record before it and is reproduced in place.
 */
export function readZip(input: Uint8Array): ZipArchive {
  // A plain view over the caller's bytes. Node's `Buffer` — what `fs.readFile` hands back — is a `Uint8Array` whose
  // `slice` returns a view rather than a copy, so the records below would share the caller's memory and a replaced
  // entry's header writes would land in the template the caller still holds. `Uint8Array`'s own `slice` copies.
  const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndRecord(view);

  const diskNumber = view.getUint16(end + 4, true);
  const centralDisk = view.getUint16(end + 6, true);
  const entriesOnDisk = view.getUint16(end + 8, true);
  const entryCount = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  const commentLength = view.getUint16(end + 20, true);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    refuse('the archive spans several disks');
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    refuse('the archive is zip64');
  }
  if (end >= 20 && view.getUint32(end - 20, true) === SIGNATURE.ZIP64_LOCATOR) {
    refuse('the archive carries a zip64 locator');
  }
  if (centralOffset + centralSize !== end) {
    refuse('the central directory does not end where the end record begins');
  }

  const central: Omit<ZipEntry, 'localRecord' | 'dataOffset'>[] = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + CENTRAL_HEADER_LENGTH > end || view.getUint32(cursor, true) !== SIGNATURE.CENTRAL) {
      refuse(`central record ${index} is not where the directory says`);
    }
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLengthOfEntry = view.getUint16(cursor + 32, true);
    const recordLength = CENTRAL_HEADER_LENGTH + nameLength + extraLength + commentLengthOfEntry;
    const flags = view.getUint16(cursor + 8, true);
    if ((flags & FLAG_ENCRYPTED) !== 0) refuse(`entry ${index} is encrypted`);

    central.push({
      name: new TextDecoder().decode(bytes.subarray(cursor + CENTRAL_HEADER_LENGTH, cursor + CENTRAL_HEADER_LENGTH + nameLength)),
      localOffset: view.getUint32(cursor + 42, true),
      centralRecord: bytes.slice(cursor, cursor + recordLength),
      method: view.getUint16(cursor + 10, true),
      flags,
      crc32: view.getUint32(cursor + 16, true),
      compressedSize: view.getUint32(cursor + 20, true),
      uncompressedSize: view.getUint32(cursor + 24, true),
    });
    cursor += recordLength;
  }
  if (cursor !== end) refuse('the central directory is longer than its records');
  // A part is addressed by its name, so two entries spelled alike would make "the" sheet ambiguous.
  if (new Set(central.map((entry) => entry.name)).size !== central.length) refuse('two entries share a name');

  // Local records in the order they sit, so each runs to the start of the next — or to the directory, for the last.
  const byOffset = [...central].sort((a, b) => a.localOffset - b.localOffset);
  if (byOffset.length > 0 && byOffset[0].localOffset !== 0) refuse('bytes precede the first local record');

  const extents = new Map<number, { localRecord: Uint8Array; dataOffset: number }>();
  byOffset.forEach((entry, index) => {
    const start = entry.localOffset;
    const stop = index + 1 < byOffset.length ? byOffset[index + 1].localOffset : centralOffset;
    if (extents.has(start)) refuse(`two entries claim the local record at ${start}`);
    if (start + LOCAL_HEADER_LENGTH > stop || view.getUint32(start, true) !== SIGNATURE.LOCAL) {
      refuse(`the local record of ${entry.name} is not where the directory says`);
    }
    const nameLength = view.getUint16(start + 26, true);
    const extraLength = view.getUint16(start + 28, true);
    const dataOffset = LOCAL_HEADER_LENGTH + nameLength + extraLength;
    const localName = new TextDecoder().decode(bytes.subarray(start + LOCAL_HEADER_LENGTH, start + LOCAL_HEADER_LENGTH + nameLength));
    if (localName !== entry.name) refuse(`the local record at ${start} names ${localName}, not ${entry.name}`);
    // Without a data descriptor the local header states the checksum and sizes too, and must state the directory's —
    // a reader trusting either one alone would read a different entry from a reader trusting the other.
    const describedLater = (view.getUint16(start + 6, true) & FLAG_DATA_DESCRIPTOR) !== 0;
    if (
      !describedLater &&
      (view.getUint32(start + 14, true) !== entry.crc32 ||
        view.getUint32(start + 18, true) !== entry.compressedSize ||
        view.getUint32(start + 22, true) !== entry.uncompressedSize)
    ) {
      refuse(`the local header of ${entry.name} disagrees with its central record`);
    }
    if (dataOffset + entry.compressedSize > stop - start) refuse(`the data of ${entry.name} overruns its record`);
    extents.set(start, { localRecord: bytes.slice(start, stop), dataOffset });
  });

  return {
    entries: central.map((entry) => {
      const extent = extents.get(entry.localOffset);
      return extent === undefined ? refuse(`no local record for ${entry.name}`) : { ...entry, ...extent };
    }),
    comment: bytes.slice(end + END_RECORD_LENGTH, end + END_RECORD_LENGTH + commentLength),
  };
}

/** The end-of-central-directory record, searched backwards over the longest comment the format admits. */
function findEndRecord(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - END_RECORD_LENGTH - MAX_COMMENT_LENGTH);
  for (let at = view.byteLength - END_RECORD_LENGTH; at >= lowest; at -= 1) {
    if (view.getUint32(at, true) === SIGNATURE.END && at + END_RECORD_LENGTH + view.getUint16(at + 20, true) === view.byteLength) {
      return at;
    }
  }
  return refuse('no end-of-central-directory record');
}
