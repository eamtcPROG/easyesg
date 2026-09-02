import type { DisclosureKind } from '@easyesg/vsme';
import type { PeriodType } from '@api/contracts/taxonomy-registry.port';
import type { EpochMillis } from '@api/contracts/types/time';
import type { DisclosureState } from './disclosure-value.model';

/**
 * What the wizard is given (task 89; S-07, FR-24 … FR-32).
 *
 * **The server composes taxonomy, labels and stored values; the screen composes none of them.** S-07
 * describes step content as *"disclosure field labels, help text, values, units, state markers"* —
 * three sources that only this tier can join. `TAXONOMY_REGISTRY` and `DISCLOSURE_CATALOGUES` are
 * api-side (AD-3, and task 33.2's decision that label resolution is `apps/api`'s), and the values are
 * behind RLS. A browser given three of these and asked to join them would be a second implementation
 * of the pinning rule DR-4 exists to keep in one place.
 *
 * **Everything here is resolved against the report's OWN pinned version**, never the newest
 * registered one. That is the whole of DR-4 restated at the read boundary: a report authored under
 * `2026-02-01` must render that version's elements years after `2026-05-01` is adopted, and task
 * 33.3 registered a second version precisely so this is exercised rather than asserted.
 */

/**
 * One module as the persistent list shows it (UX-5).
 *
 * **Counts rather than a computed status**, because a *status* is a judgement and FR-40's validation
 * verdicts are task 40's. What a module can honestly report before a validation engine exists is how
 * many of its fields have been answered — and `answered` counts a stored row in any of the answered
 * states, including FR-30's nil return and FR-32's not-available, because a considered non-answer is
 * an answer. That distinction is why this is not `SELECT count(*) WHERE value IS NOT NULL`.
 */
export interface DisclosureModuleSummary {
  /** `B1` … `B11`, `C1` … `C9` — the standard's own module, from the taxonomy's presentation roles. */
  readonly module: string;
  readonly answered: number;
  readonly total: number;
  /**
   * When this module's most recent answer was stored — epoch milliseconds — or `null` where nothing
   * in it has been answered (task 35.3; UC-36, FR-39). **Position is where work last happened**:
   * the module with the latest value is where a returning reporter is put, on any device, and
   * nothing records anyone's position separately — the values already carry it. `updated_at` is
   * the store's own column, so this is derived rather than written.
   */
  readonly lastAnsweredAt: EpochMillis | null;
}

/** One answerable field: its shape from the taxonomy, its wording from the catalogue, its value from the store. */
export interface DisclosureField {
  readonly elementKey: string;
  /** An axis member, or `''` where the element is undimensioned — §7.3's convention. */
  readonly dimensionKey: string;
  readonly ordinal: number;
  readonly kind: DisclosureKind;
  readonly periodType: PeriodType;
  /** The axes this element is dimensioned along; empty for the 109 that are not. */
  readonly axes: readonly string[];
  /** The presentation order EFRAG gives it, so a step renders as the standard reads. */
  readonly order: number;
  /** `null` where the pinned version's catalogue names no label — logged, and rendered as absent. */
  readonly label: string | null;
  /**
   * Whether that wording is EFRAG's own or this platform's (NFR-24, task 33.2). Carried per field
   * rather than per step because it travels with the text: a screen that renders a label without its
   * standing cannot make UX-47's statement, and of this product's three locales only English is
   * official.
   */
  readonly labelStanding: string | null;
  readonly valueNumeric: string | null;
  readonly valueText: string | null;
  readonly valueBoolean: boolean | null;
  readonly valueDate: string | null;
  readonly unitCode: string | null;
  readonly state: DisclosureState;
  /** FR-32's reason, required exactly when the state is `not_available`. */
  readonly notAvailableReason: string | null;
  /** FR-47: this value was carried forward from the prior period and is marked for review. */
  readonly carriedForward: boolean;
}

/** One wizard step: a module, and the fields the pinned taxonomy puts in it, in its order. */
export interface DisclosureStep {
  readonly module: string;
  readonly taxonomyVersion: string;
  readonly fields: readonly DisclosureField[];
}
