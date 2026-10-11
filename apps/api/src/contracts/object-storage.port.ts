/**
 * Object storage, behind a port (§4.9's `ObjectStoragePort`; P-7): S3-compatible and in the EU — Scaleway in production
 * (§12.5.1), an emulator in the Compose stacks — so no vendor type appears outside its adapter.
 *
 * **Narrow on purpose** (ISP): an export's job puts the file it produced (task 44.2); reading one back is the
 * re-download's (task 47.1), which adds its method when it has a caller.
 */
export interface ObjectStorage {
  /** Stores `body` under `key`, replacing what an earlier, abandoned attempt may have left there. */
  put(input: { readonly key: string; readonly body: Buffer; readonly contentType: string }): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
