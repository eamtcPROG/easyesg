/**
 * Object storage, behind a port (§4.9's `ObjectStoragePort`; P-7): S3-compatible and in the EU — Scaleway in production
 * (§12.5.1), an emulator in the Compose stacks — so no vendor type appears outside its adapter.
 *
 * **Narrow on purpose** (ISP): an export's job puts the file it produced (task 44.2), and the request tier reads one back
 * for the re-download (task 47.1) through `ObjectReader` below — each side depends on the one operation it calls.
 */
export interface ObjectStorage {
  /** Stores `body` under `key`, replacing what an earlier, abandoned attempt may have left there. */
  put(input: { readonly key: string; readonly body: Buffer; readonly contentType: string }): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/**
 * Reading a stored object back (task 47.1; FR-53): the re-download's, on the request tier. **A key with no object
 * throws** — a record that says a file was stored, and a store that holds none, is a defect to surface, not an answer.
 */
export interface ObjectReader {
  get(input: { readonly key: string }): Promise<Buffer>;
}

export const OBJECT_READER = Symbol('OBJECT_READER');
