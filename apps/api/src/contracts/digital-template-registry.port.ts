/**
 * The EFRAG Digital Template a report's pin names (task 45.3; FR-50, DR-4, UC-75).
 *
 * **A report pins a template version beside its taxonomy version, and they are two facts** (FR-50 behaviour 3,
 * `architecture.md` §12.5.6's task-45 row): the template is EFRAG's workbook at a release (`1.3.0`), the taxonomy the
 * XBRL package it is written against (`2026-05-01`). The Excel export (task 46.1) asks this port for the binary its
 * report's pin names and patches it; it never chooses a template itself and never takes the newest (FR-51).
 *
 * In the port surface because the export is `core/export`'s and the registry `platform/taxonomy`'s — the same reason
 * `TAXONOMY_REGISTRY` is here.
 */

/** A registered template, its binary read from the release and checked against its registration. */
export interface DigitalTemplate {
  /** EFRAG's release identifier, `1.3.0` — the report's `templateVersion`. */
  readonly version: string;
  /** The taxonomy version the template is written against, equal to the pin's own by construction of the answer. */
  readonly taxonomyVersion: string;
  /** The workbook's bytes, exactly as committed — the SHA-256 the registration names. */
  readonly content: Uint8Array;
}

export interface DigitalTemplateRegistry {
  /**
   * The template a report's pin names, or `null` when none answers it: the version is registered nowhere, its
   * registration is unreadable, or the registered template is written against a different taxonomy than the report
   * was prepared under. **Never a nearby version** — exporting a report against a template it was not prepared under
   * is what FR-51 forbids, and `null` is what lets the export refuse with a reason instead (task 46.1).
   *
   * A registration whose committed binary is missing, or is not the file it names by digest, is a defect in the
   * release rather than an answer, and **throws**: the export's job records the failure, where an operator reads it.
   */
  templateFor(pin: { readonly templateVersion: string; readonly taxonomyVersion: string }): Promise<DigitalTemplate | null>;
}

export const DIGITAL_TEMPLATE_REGISTRY = Symbol('DIGITAL_TEMPLATE_REGISTRY');
