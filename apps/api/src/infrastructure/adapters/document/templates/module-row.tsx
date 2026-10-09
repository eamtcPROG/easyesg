import { DOCUMENT_VALUE, type DocumentRow } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';
import { DOCUMENT_MARK } from './document-marks';
import { Mark } from './mark';
import { ValueText } from './value-text';

/** The values printed as figures — aligned to the end, and never split from their unit. Internal to this file. */
const FIGURES: ReadonlySet<string> = new Set([DOCUMENT_VALUE.FIGURE, DOCUMENT_VALUE.MONEY, DOCUMENT_VALUE.NIL_RETURN]);

/**
 * One disclosure of a module's table: its label and what names the row, the figure with its marks, the prior period's
 * beside it (FR-45), and the unit in a column of its own so no break separates them (UX-118).
 */
export function ModuleRow(props: {
  readonly row: DocumentRow;
  /** The number of this row's note, where it is an overridden figure. */
  readonly note: number | null;
  readonly comparatives: boolean;
  readonly words: DocumentWords;
}) {
  const { row, note, words } = props;
  const figure = FIGURES.has(row.value.kind) ? 'figure' : undefined;
  return (
    <tr>
      <th scope="row">
        {row.label}
        {row.member === null ? null : <span className="member">{row.member}</span>}
        {row.unresolved ? <Mark mark={DOCUMENT_MARK.UNRESOLVED} words={words} /> : null}
      </th>
      <td className={figure}>
        {row.withheld ? <Mark mark={DOCUMENT_MARK.OMITTED} words={words} /> : <ValueText value={row.value} words={words} />}
        {note === null ? null : (
          <>
            <sup>{note}</sup>
            <Mark mark={DOCUMENT_MARK.ESTIMATE} words={words} />
          </>
        )}
      </td>
      {props.comparatives ? (
        <td className="figure">{row.prior === null ? '—' : <ValueText value={row.prior} words={words} />}</td>
      ) : null}
      <td className="unit">{unitOf(row, words)}</td>
    </tr>
  );
}

/** The unit's word — the currency, for money — or nothing where the figure carries none. */
function unitOf(row: DocumentRow, words: DocumentWords): string {
  if (row.unit !== null) return words.t(`units.${row.unit}`) || row.unit;
  return row.value.kind === DOCUMENT_VALUE.MONEY ? (row.value.currency ?? '') : '';
}
