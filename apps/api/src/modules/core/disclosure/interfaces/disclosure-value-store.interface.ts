import type {
  DisclosureValue,
  DisclosureValueKey,
  DisclosureValueWrite,
} from '../models/disclosure-value.model';

/**
 * The disclosure value store (task 34.1; FR-24 … FR-32, FR-54).
 *
 * **Every method is tenant-scoped by RLS rather than by a filter here** (DR-5, AD-2): the bound
 * organization comes from `app.current_org` on the transaction, so no signature takes an
 * `organizationId` and no call site can forget one. A row written under one tenant is invisible to
 * every other, and that is a property of the database rather than of this interface.
 */
export interface DisclosureValueStore {
  /**
   * Every stored value of one report, in the taxonomy's own key order.
   *
   * The wizard renders a module, not a field, so the read is per report rather than per element —
   * one round trip for a screen instead of forty.
   */
  forReport(query: { readonly reportId: string }): Promise<DisclosureValue[]>;

  /** One stored value, or `null` where the field has never been answered. */
  find(key: DisclosureValueKey): Promise<DisclosureValue | null>;

  /**
   * Write an answer, creating the row or replacing its contents.
   *
   * **Upsert rather than create-or-update**, because whether a field has been answered before is not
   * something a caller should have to know: autosave writes the same field repeatedly and a
   * round trip to find out would be both slower and racy. The natural key is a `UNIQUE`, so the
   * conflict target is the database's own definition of "the same field".
   *
   * Refused with `ReportNotEditableError` where the report's period is locked — by a trigger, not by
   * this method, so it holds for every writer (FR-22, P-4).
   */
  write(value: DisclosureValueWrite): Promise<DisclosureValue>;
  /**
   * Write a figure the platform computed, marking it `origin = 'calculated'` (task 36.10).
   *
   * **A separate method rather than an `origin` on `DisclosureValueContents`**, which is task 36.4's
   * decision honoured rather than reversed: *"the read tells; the write cannot"* — putting provenance
   * on the ordinary write shape would oblige `wizard.controller.ts` to send `'reported'` on every
   * keystroke as though it had chosen. Only the code that actually computed something can reach this,
   * which is the property that made 36.4 keep it off the shape in the first place.
   *
   * `null` clears the figure back to unanswered, for a derivation whose operands are no longer all
   * present — a stale computed number outliving its inputs is worse than an empty field.
   */
  writeDerived(value: {
    readonly key: DisclosureValueKey;
    readonly valueNumeric: string | null;
  }): Promise<DisclosureValue>;

  /**
   * Remove one value — a repeating-group row for a site or subsidiary that no longer applies.
   *
   * Answers whether a row was removed rather than throwing on a miss: deleting a field nobody ever
   * answered is the caller's intended end state, not an error.
   */
  remove(key: DisclosureValueKey): Promise<boolean>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const DISCLOSURE_VALUE_STORE = Symbol('DISCLOSURE_VALUE_STORE');
