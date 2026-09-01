import { Inject, Injectable } from '@nestjs/common';
import { COLUMN_OF_KIND, DISCLOSURE_KIND, VALUE_COLUMN } from '@easyesg/vsme';
import type {
  Disclosure,
  Dimensioned,
  HoldsOf,
  RepeatingGroup,
  Scalar,
  ValueOf,
} from '@easyesg/vsme';
import {
  DISCLOSURE_VALUE_STORE,
  type DisclosureValueStore,
} from '../interfaces/disclosure-value-store.interface';
import {
  DEFAULT_DISCLOSURE_STATE,
  DISCLOSURE_STATE,
  type DisclosureState,
  type DisclosureValue,
} from '../models/disclosure-value.model';

/**
 * The typed facade over the element-keyed store (task 34.2; AD-3, T-3).
 *
 * **This is the buy-back, and it is worth naming what it buys.** The store is keyed by
 * `element_key`, a string, so nothing stops a caller writing `EnergyConsumptionFromFuel` and getting
 * a row nobody reads. A descriptor from `@easyesg/vsme` supplies the key, so the misspelling is a
 * compile error; it also carries the *shape*, so a caller that treats a repeating group as a single
 * value fails to compile rather than reading row zero and looking right.
 *
 * **Generated per taxonomy version, and this service takes the descriptor rather than choosing it.**
 * DR-4 makes two versions coexist, so which `DISCLOSURES` a caller reaches for is a property of the
 * report they hold — task 36's wizard resolves that from the report's pin. A facade that imported
 * one version's descriptors directly would be the shape that silently re-reads an archived report
 * against a taxonomy it was never authored under.
 *
 * **It does not validate.** T-3's other two buy-backs are elsewhere by design: rule-driven
 * validation is task 40's, from registered definitions (FR-73) rather than from types, and the
 * golden-report corpus is NFR-20's. What this adds is that a *well-typed* write cannot name a
 * nonexistent element or the wrong shape for a real one.
 */
@Injectable()
export class DisclosureFacade {
  constructor(
    @Inject(DISCLOSURE_VALUE_STORE) private readonly values: DisclosureValueStore,
  ) {}

  /**
   * Read one disclosure, in the shape its descriptor declares.
   *
   * A scalar answers its value or `null`; a dimensioned element answers a partial record keyed by
   * axis member, because a reporter answering renewable and not non-renewable is a normal state
   * rather than a gap; a repeating group answers an array ordered by `ordinal`.
   */
  async read<D extends Disclosure>(query: {
    readonly reportId: string;
    readonly disclosure: D;
  }): Promise<ValueOf<HoldsOf<D>>> {
    const stored = await this.values.forReport({ reportId: query.reportId });
    const mine = stored.filter((value) => value.elementKey === query.disclosure.key);
    return this.project(query.disclosure, mine) as ValueOf<HoldsOf<D>>;
  }

  /**
   * Write one scalar disclosure.
   *
   * **Separate methods per shape rather than one `write` branching on the descriptor**, because the
   * *arguments* differ: a dimensioned write needs the member and a repeating write needs the
   * ordinal, and folding all three into one signature would make both optional — which is exactly
   * the shape that lets a caller omit the member and silently write the undimensioned total.
   */
  async writeScalar<T>(command: {
    readonly reportId: string;
    readonly disclosure: Disclosure<Scalar<T>>;
    readonly value: T | null;
    readonly state?: DisclosureState;
  }): Promise<void> {
    await this.put(command.reportId, command.disclosure, '', 0, command.value, command.state);
  }

  async writeDimensioned<T, M extends string>(command: {
    readonly reportId: string;
    readonly disclosure: Disclosure<Dimensioned<T, M>>;
    readonly member: M;
    readonly value: T | null;
    readonly state?: DisclosureState;
  }): Promise<void> {
    await this.put(
      command.reportId,
      command.disclosure,
      command.member,
      0,
      command.value,
      command.state,
    );
  }

  async writeRow<T>(command: {
    readonly reportId: string;
    readonly disclosure: Disclosure<RepeatingGroup<T>>;
    readonly ordinal: number;
    readonly value: T | null;
    readonly state?: DisclosureState;
  }): Promise<void> {
    await this.put(
      command.reportId,
      command.disclosure,
      '',
      command.ordinal,
      command.value,
      command.state,
    );
  }

  /**
   * **The one place a value meets its column.**
   *
   * The column comes from the descriptor's `kind` through `COLUMN_OF_KIND`, never from the runtime
   * type of the value: `'42'` is a string whether the element is numeric or text, and inferring from
   * it would put a numeric disclosure in `value_text` for every reporter who typed a number into a
   * text field. The map is total over `DisclosureKind`, so a kind added to the vocabulary fails to
   * compile until its column is decided — where the `switch` this replaced had a `default` that
   * would have filed it silently as text.
   */
  private async put(
    reportId: string,
    disclosure: Disclosure,
    dimensionKey: string,
    ordinal: number,
    value: unknown,
    state: DisclosureState | undefined,
  ): Promise<void> {
    const column = COLUMN_OF_KIND[disclosure.kind];
    const empty = value === null || value === undefined;
    await this.values.write({
      key: { reportId, elementKey: disclosure.key, dimensionKey, ordinal },
      contents: {
        valueNumeric: column === VALUE_COLUMN.NUMERIC ? (value as string | null) : null,
        valueText: column === VALUE_COLUMN.TEXT ? this.asText(disclosure, value) : null,
        valueBoolean: column === VALUE_COLUMN.BOOLEAN ? (value as boolean | null) : null,
        valueDate: column === VALUE_COLUMN.DATE ? (value as string | null) : null,
        unitCode: null,
        state: state ?? (empty ? DEFAULT_DISCLOSURE_STATE : DISCLOSURE_STATE.OK),
        notAvailableReason: null,
        carriedForward: false,
      },
    });
  }

  /**
   * An enumeration set is many members in one text column; every other text kind is already a
   * string by its descriptor.
   *
   * **Typed rather than `String(value)`**, which `no-base-to-string` refused and was right to: the
   * parameter is `unknown`, so an object reaching it would have been stored as `[object Object]` —
   * a silent wrong answer on a filed disclosure.
   */
  private asText(disclosure: Disclosure, value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (disclosure.kind === DISCLOSURE_KIND.ENUMERATION_SET) {
      // Only an array is a set. Anything else reaching here is a caller ignoring the descriptor's
      // own shape, and storing it would be a guess — so it is refused rather than coerced.
      return Array.isArray(value) ? (value as readonly string[]).join(' ') : null;
    }
    return value as string;
  }

  private readColumn(disclosure: Disclosure, row: DisclosureValue): unknown {
    const column = COLUMN_OF_KIND[disclosure.kind];
    if (column === VALUE_COLUMN.NUMERIC) return row.valueNumeric;
    if (column === VALUE_COLUMN.BOOLEAN) return row.valueBoolean;
    if (column === VALUE_COLUMN.DATE) return row.valueDate;
    if (disclosure.kind === DISCLOSURE_KIND.ENUMERATION_SET) {
      return row.valueText === null ? [] : row.valueText.split(' ').filter((part) => part !== '');
    }
    return row.valueText;
  }

  /** Rows for one element, in the shape its descriptor declares. */
  private project(disclosure: Disclosure, rows: readonly DisclosureValue[]): unknown {
    if (disclosure.axis === null) {
      const row = rows.find((value) => value.dimensionKey === '' && value.ordinal === 0);
      return row === undefined ? null : this.readColumn(disclosure, row);
    }
    if (disclosure.members === null && disclosure.axis.endsWith('TypedAxis')) {
      return [...rows]
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((row) => this.readColumn(disclosure, row));
    }
    return Object.fromEntries(
      rows
        .filter((row) => row.dimensionKey !== '')
        .map((row) => [row.dimensionKey, this.readColumn(disclosure, row)]),
    );
  }
}
