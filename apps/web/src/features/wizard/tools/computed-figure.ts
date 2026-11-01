import { DISCLOSURE_KIND, DISCLOSURE_ORIGIN, type DisclosureField } from '@easyesg/contracts';
import type { useFormatter } from 'next-intl';
import { formatFigure, formatShare } from '@/lib/figure-format';
import { COLUMN_OF_KIND, VALUE_COLUMN } from './values';

/**
 * **A figure the platform worked out, as S-07 shows it** (tasks 39.3, 211; FR-29; `architecture.md` §12.5.6's task-39
 * row (7) and task-211 row) — calculated, overridden or derived: rounded once, half-up, to the places the step read
 * serves its field — its unit's, else its element's, chosen by the rule the PDF chooses by — and **a share as a
 * percentage**. A figure the reporter typed is not one: it is an answer, and shown as typed.
 *
 * **One description for every place S-07 quotes such a figure** — its field, and UX-28's *Kept: …* notice, which quotes
 * a hidden answer exactly as its field showed it (row (2)) — so the two cannot come apart.
 */
export interface ComputedFigure {
  /** The figure as stored: a decimal string, a share as its fraction. */
  readonly value: string;
  /** Where to round it to — decimals of the percent for a share — or `null` for every digit. */
  readonly places: number | null;
  /** A field of the percent kind: B8's turnover rate, B10's coverage and pay gap. */
  readonly share: boolean;
}

type Formatter = Pick<ReturnType<typeof useFormatter>, 'number'>;

/** The figure a field holds, where the platform worked it out — `null` for a typed one, or a field holding no figure. */
export function computedFigureOf(
  field: Pick<DisclosureField, 'kind' | 'derived' | 'origin' | 'places'>,
  value: string | null,
): ComputedFigure | null {
  if (value === null || value === '' || COLUMN_OF_KIND[field.kind] !== VALUE_COLUMN.NUMERIC) return null;
  if (!field.derived && field.origin === DISCLOSURE_ORIGIN.REPORTED) return null;
  return { value, places: field.places, share: field.kind === DISCLOSURE_KIND.PERCENT };
}

/** Its words in the reader's locale: a percentage for a share, a figure for the rest. */
export function computedFigureWords(input: { readonly figure: ComputedFigure; readonly format: Formatter }): string {
  const { figure, format } = input;
  const places = figure.places ?? undefined;
  return figure.share
    ? formatShare({ value: figure.value, places, format })
    : formatFigure({ value: figure.value, places, format });
}
