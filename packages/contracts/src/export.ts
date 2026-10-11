import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * Export's vocabulary, consumer side (task 47; FR-49 … FR-53) — the mirror of `apps/api`'s `EXPORT_FORMAT` and
 * `EXPORT_STATUS`, which the api derives its contract enums from and may not import from here (`membership.ts`'s
 * reason).
 *
 * **What it adds over the generated unions is the runtime value**: S-11 offers the formats as its first decision,
 * filters its history by them, and draws a row by its export's status — a pending card while it is requested, the
 * download once it has completed — and none of those branches may be a literal at the site. Held to the generated
 * enums at compile time, so a format or a status the api gains and this file lacks fails `pnpm typecheck` here.
 */
export const EXPORT_FORMAT = {
  /** The report laid out for reading — the document S-10 previews. */
  PDF: 'pdf',
  /** EFRAG's Digital Template, patched in place. */
  XLSX: 'xlsx',
} as const;

export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];

export const EXPORT_FORMAT_MIRRORS_WIRE: SameSet<ExportFormat, components['schemas']['ExportResponseDto']['format']> =
  true;

/** Is this unvalidated value one of the formats? Beside the set, not retyped at each reader — a radio answers a string. */
export const isExportFormat = (value: unknown): value is ExportFormat =>
  (Object.values(EXPORT_FORMAT) as readonly unknown[]).includes(value);

export const EXPORT_STATUS = {
  /** Its job is running — what S-11 watches. */
  REQUESTED: 'requested',
  /** Its file is stored, and downloads exactly as it was produced (FR-53). */
  COMPLETED: 'completed',
  /** Its last attempt failed; there is no file. */
  FAILED: 'failed',
} as const;

export type ExportStatus = (typeof EXPORT_STATUS)[keyof typeof EXPORT_STATUS];

export const EXPORT_STATUS_MIRRORS_WIRE: SameSet<ExportStatus, components['schemas']['ExportResponseDto']['status']> =
  true;

/** Is this unvalidated value one of the statuses? Beside the set, for the watch that reads one off the wire. */
export const isExportStatus = (value: unknown): value is ExportStatus =>
  (Object.values(EXPORT_STATUS) as readonly unknown[]).includes(value);
