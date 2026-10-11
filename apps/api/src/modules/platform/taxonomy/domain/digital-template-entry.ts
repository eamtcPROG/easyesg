/**
 * The `vsme_digital_template` payload, read (task 45.3): which taxonomy version a registered template is written
 * against, which committed file it is, and that file's SHA-256 — the registration names one binary exactly, so a file
 * replaced in `config/efrag/` without a new registration is refused at resolution rather than exported.
 *
 * **Read whole or not at all**, as `presentation_precision` is: a registration with one field wrong answers `null`, and
 * publication refuses the same payload (`configuration-kind-rules.ts`), so a bad one is stopped where someone is present
 * to correct it.
 *
 * **The file is a bare name inside the version's directory**, never a path: the payload is operator data and a path in
 * it would be a way to point the export at any file the worker can read.
 */
export interface DigitalTemplateEntry {
  /** The taxonomy version the template is written against — OQ-45's `YYYY-MM-DD`, named inside the workbook too. */
  readonly taxonomyVersion: string;
  /** The binary's file name inside `config/efrag/<version>/`. */
  readonly file: string;
  /** The binary's SHA-256, lower-case hex. */
  readonly sha256: string;
  /** Where EFRAG publishes it — provenance, for an operator; nothing downloads from it (182/48). */
  readonly source: string;
}

const TAXONOMY_VERSION = /^\d{4}-\d{2}-\d{2}$/;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.xlsx$/;
const SHA256 = /^[0-9a-f]{64}$/;
/** EFRAG serves its downloads over TLS; an address that is not is a typo, or not EFRAG's. */
const SECURE_PROTOCOL = 'https:';

export function readDigitalTemplateEntry(payload: unknown): DigitalTemplateEntry | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { taxonomyVersion, file, sha256, source } = payload as Record<string, unknown>;
  if (typeof taxonomyVersion !== 'string' || !TAXONOMY_VERSION.test(taxonomyVersion)) return null;
  if (typeof file !== 'string' || !FILE_NAME.test(file) || file.includes('..')) return null;
  if (typeof sha256 !== 'string' || !SHA256.test(sha256)) return null;
  if (typeof source !== 'string' || !isHttpsAddress(source)) return null;
  return { taxonomyVersion, file, sha256, source };
}

/** Why a payload may not be published, or `null` — the reader's own verdict, so publication and reading agree. */
export const digitalTemplateRefusal = (payload: unknown): string | null =>
  readDigitalTemplateEntry(payload) === null
    ? 'a Digital Template registration is { "taxonomyVersion": "YYYY-MM-DD", "file": "<name>.xlsx", "sha256": "<64 hex>", "source": "https://…" }, read whole'
    : null;

function isHttpsAddress(text: string): boolean {
  try {
    return new URL(text).protocol === SECURE_PROTOCOL;
  } catch {
    return false;
  }
}
