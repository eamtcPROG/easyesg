import type { LegalDate } from '@api/contracts/types/time';

/**
 * What the calculator needs to know about the report it calculates for (task 38.1).
 *
 * **Its own read, not `core/disclosure`'s `ReportStore`.** The calculator asks three things the disclosure store has no
 * reason to answer together — the period's start, which picks the factor set (§9.9); the organization's country,
 * which scopes it (task 37.1); and how many sites the period's snapshot holds — and one joined statement answers
 * them. A port borrowed from another module would make that module's every change this one's.
 */
export interface CalcReport {
  readonly reportId: string;
  /** The reporting period's start — the date a factor set is resolved for (§9.9, NFR-34). */
  readonly periodStart: LegalDate;
  /** The pinned taxonomy version, which says which elements carry the site axis. */
  readonly taxonomyVersion: string;
  /** The organization's ISO 3166 country — the factor set's scope. */
  readonly countryCode: string;
  /** How many sites the period's FR-18 snapshot holds — B1's rows before anyone answers them. */
  readonly snapshotSites: number;
}

export interface CalcReports {
  /** Null when the report is unknown or another tenant's, which RLS makes one answer. */
  find(query: { readonly reportId: string }): Promise<CalcReport | null>;

  /** The ordinals any of `elementKeys` holds an undimensioned value at, in any state — B1's answered site rows. */
  answeredOrdinals(query: { readonly reportId: string; readonly elementKeys: readonly string[] }): Promise<number[]>;
}

/** DI token beside the interface, as every port in `core/` is (P-7). */
export const CALC_REPORTS = Symbol('CALC_REPORTS');
