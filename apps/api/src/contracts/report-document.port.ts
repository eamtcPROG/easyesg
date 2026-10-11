import type { LabelStanding, Locale } from '@easyesg/i18n';
import type { LegalDate } from './types/time';

/**
 * The report as a document — what a bank, a buyer or an auditor reads — and the port that turns it into one page of
 * markup (task 43; FR-48, FR-49; `architecture.md` §12.5.6's task-43 row, which closed OQ-38).
 *
 * **One rendering, two consumers.** The preview route answers the markup and S-10 frames it; task 44's job hands the
 * same markup to Chromium. Both call this port, so the preview and the PDF are one function's output and cannot drift
 * (AD-10). The model says *what* is printed — which sections, which figures, which marks — and nothing about wording or
 * layout; the adapter words it in `locale` and lays it out as paper.
 *
 * In the port surface because both `core/export` and the adapter at the edge read it, and an adapter may not import a
 * module.
 */
export const REPORT_DOCUMENT_RENDERER = Symbol('REPORT_DOCUMENT_RENDERER');

export interface ReportDocumentRenderer {
  /** The whole document — `<!doctype html>` to `</html>` — with its stylesheet and fonts inside it and no script. */
  render(document: ReportDocument): string;
}

/** What one printed value is, by the kind of thing it says (UX-119: a zero, a gap and an omission never look alike). */
export const DOCUMENT_VALUE = {
  /** A number, rounded to `places` where the configuration gives its unit some (FR-29). */
  FIGURE: 'figure',
  /**
   * A share, stored as a fraction — which is what every derivation writes and what EFRAG's `0.00%` cells hold — and
   * printed as a percentage, `places` counting decimals of the percent (task-46 row (10)).
   */
  PERCENT: 'percent',
  /** An amount of money, in the report's currency. */
  MONEY: 'money',
  /** A year, which is a date and takes no thousands separator. */
  YEAR: 'year',
  TEXT: 'text',
  YES_NO: 'yes_no',
  /** A calendar date, `YYYY-MM-DD`, printed without passing through an instant (NFR-34). */
  DATE: 'date',
  /** The labels of the option, or options, chosen. */
  CHOICES: 'choices',
  /** FR-30's answered zero — printed as a stated zero, never as a blank. */
  NIL_RETURN: 'nil_return',
  /** FR-32's deliberate non-answer, with the reason the reporter gave. */
  NOT_AVAILABLE: 'not_available',
  /** No answer — printed only where an unresolved finding names the field (UX-119). */
  UNANSWERED: 'unanswered',
} as const;

export type DocumentValue =
  | { readonly kind: typeof DOCUMENT_VALUE.FIGURE; readonly value: string; readonly places: number | null }
  | { readonly kind: typeof DOCUMENT_VALUE.PERCENT; readonly value: string; readonly places: number | null }
  | {
      readonly kind: typeof DOCUMENT_VALUE.MONEY;
      readonly value: string;
      readonly places: number | null;
      readonly currency: string | null;
    }
  | { readonly kind: typeof DOCUMENT_VALUE.YEAR; readonly value: string }
  | { readonly kind: typeof DOCUMENT_VALUE.TEXT; readonly text: string }
  | { readonly kind: typeof DOCUMENT_VALUE.YES_NO; readonly value: boolean }
  | { readonly kind: typeof DOCUMENT_VALUE.DATE; readonly date: string }
  | { readonly kind: typeof DOCUMENT_VALUE.CHOICES; readonly labels: readonly string[] }
  | { readonly kind: typeof DOCUMENT_VALUE.NIL_RETURN }
  | { readonly kind: typeof DOCUMENT_VALUE.NOT_AVAILABLE; readonly reason: string | null }
  | { readonly kind: typeof DOCUMENT_VALUE.UNANSWERED };

/** A figure that replaced a computed one (UX-43; FR-36): what it superseded, why, and who replaced it (task 39.4). */
export interface DocumentOverride {
  /** The computed figure it replaced, rounded as the figure is — `null` where no run is held to say. */
  readonly superseded: string | null;
  readonly places: number | null;
  readonly reason: string | null;
  /** The person, by the name they are shown under — `null` where the account is gone. */
  readonly person: string | null;
}

/** One line of a module's table: a disclosure, or one member or one row of it. */
export interface DocumentRow {
  /** The disclosure's label in the document's language, from its pinned version — `null` where none is published. */
  readonly label: string | null;
  /** What names this row within the disclosure — a member, or the reporter's own name for a site. */
  readonly member: string | null;
  readonly value: DocumentValue;
  /** The prior period's figure, where it is comparable (FR-45); `null` otherwise. */
  readonly prior: DocumentValue | null;
  /** The unit's code, which the document words; `null` where the figure carries none. */
  readonly unit: string | null;
  /** An unresolved finding names this field (UX-119). */
  readonly unresolved: boolean;
  /** Withheld by a section omitted as classified or sensitive (FR-31) — printed with that mark and no value. */
  readonly withheld: boolean;
  readonly override: DocumentOverride | null;
}

/** A narrative disclosure — a block of the reporter's own text, printed under its label. */
export interface DocumentNarrative {
  readonly label: string | null;
  readonly text: string;
}

/** Where a module of the report stands — which of three pages it is given. */
export const DOCUMENT_MODULE = {
  /** Its disclosures are printed — none at all, still owed, where B1 has not yet said whether it applies. */
  REPORTED: 'reported',
  /** Omitted whole as classified or sensitive information (FR-31). */
  OMITTED: 'omitted',
  /** The report's own answers rule it out (FR-28): the standard does not ask it of this undertaking. */
  RULED_OUT: 'ruled_out',
} as const;

export type DocumentModuleStanding = (typeof DOCUMENT_MODULE)[keyof typeof DOCUMENT_MODULE];

/** One module the report's scope asks — a page of its own, whatever it holds. */
export interface DocumentModule {
  /** `B1` … `B11`; the document words it with the standard's name for the module. */
  readonly module: string;
  readonly standing: DocumentModuleStanding;
  readonly narrative: readonly DocumentNarrative[];
  readonly rows: readonly DocumentRow[];
}

/** An unresolved finding, as the omissions page lists it (UX-119, UX-25). */
export interface DocumentFinding {
  readonly module: string | null;
  readonly label: string | null;
  readonly member: string | null;
  /** The finding's message key — the document prints its *what happened* part (NFR-79). */
  readonly message: string;
  readonly params: Readonly<Record<string, string>>;
}

/** A disclosure printed with a gap — the omissions page's other list. */
export interface DocumentGap {
  readonly module: string;
  readonly label: string | null;
  readonly member: string | null;
  readonly value: DocumentValue | null;
  readonly withheld: boolean;
}

/**
 * Who produced the file and when — a file's facts (NFR-22; FR-53), so a preview, which produces no file (FR-48 AC-2),
 * has none, and the export's job writes them (task 44).
 */
export interface DocumentProduction {
  /** The moment the file is produced — printed in the zone of the report's period. */
  readonly generatedAt: Date;
  /** The person who asked for it, by the name they are shown under — `null` where the account is gone. */
  readonly generatedBy: string | null;
}

export interface ReportDocument {
  readonly locale: Locale;
  readonly undertaking: string;
  readonly fiscalYear: number;
  readonly periodStart: LegalDate;
  readonly periodEnd: LegalDate;
  /** The report's scope (D-A) — which of the standard's modules it reports. */
  readonly scope: string;
  readonly templateVersion: string;
  readonly taxonomyVersion: string;
  /** The factor set the latest calculator run used, as its label reads — `null` where nothing has been calculated. */
  readonly factorSet: string | null;
  /** The year the comparatives are from — `null` where there is no comparable prior period. */
  readonly priorYear: number | null;
  readonly modules: readonly DocumentModule[];
  /** Every disclosure printed with a gap — not available, or withheld — in the order the body prints them. */
  readonly gaps: readonly DocumentGap[];
  /** Each module omitted whole. */
  readonly omittedModules: readonly string[];
  /** The last validation run's findings — `null` where the report has never been checked. */
  readonly findings: readonly DocumentFinding[] | null;
  /**
   * Whose words the disclosure labels are in this language at the report's pinned version — EFRAG's own, or the
   * platform's translation (UX-98, T-14) — which the document states; `null` where the version registers none.
   */
  readonly labelStanding: LabelStanding | null;
  /** The file's own facts — `null` in the preview. */
  readonly production: DocumentProduction | null;
}
