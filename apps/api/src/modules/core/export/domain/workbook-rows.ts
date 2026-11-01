import { CELL_VALUE_KIND } from '@easyesg/xlsx-patch';
import { type DigitalTemplateMap, offsetCell, TEMPLATE_GROUP, type TemplateGroup } from '@api/contracts/digital-template-map';
import type { WorkbookWrite } from '@api/contracts/report-workbook.port';
import type { FieldAddress } from '@easyesg/validation';

/** A table's rows, given out: each field's row, and what each row's key cell says. */
export interface TableRows {
  /** The row a field of the table occupies, counted from the table's first — `null` for one the table gives no row. */
  rowOf(field: Pick<FieldAddress, 'dimensionKey' | 'ordinal'>): number | null;
  /** What a footnote names the row by — a member's key, or a typed row's identifier, counted from 1. */
  dimensionOf(field: Pick<FieldAddress, 'dimensionKey' | 'ordinal'>): string;
  /** The key cells the rows need written — none where the template's IDs already stand in them. */
  readonly keys: readonly WorkbookWrite[];
}

/**
 * How one table of the template takes the rows a report holds (task 46.1; the map's tables, task-46 row (1)).
 *
 * - **By ordinal** where the template already numbers its rows — B1's sites and subsidiaries, B7's materials: site 1 is
 *   the first row, whatever else is answered, because the template's own ID 1 stands beside it.
 * - **Keyed, from the top**, where the reporter picks which thing a row describes — B5's sites, each row naming its B1
 *   site's ID, so a report with biodiversity data for its second and fifth sites fills two rows, not five.
 * - **Classified, from the top**, where a row is a member of a list — B4's pollutants, B7's waste, B8's countries — its
 *   key the string EFRAG's own dropdown holds for the member, in the order the report first gives them.
 *
 * **A table the report outgrows is refused, never truncated**: EFRAG's tables hold a hundred rows, and the hundred and
 * first site written nowhere is a disclosure lost with nothing to say so.
 */
export function tableRows(input: {
  readonly group: TemplateGroup;
  /** The answered fields of every element on the table, in the report's order. */
  readonly fields: readonly Pick<FieldAddress, 'dimensionKey' | 'ordinal'>[];
  readonly lists: DigitalTemplateMap['lists'];
}): TableRows {
  const { group } = input;
  const outgrown = (count: number): never => {
    throw new Error(`the template's ${group.axis} table holds ${group.rows} rows, and the report fills ${count}`);
  };

  if (group.kind === TEMPLATE_GROUP.ORDINAL) {
    const highest = Math.max(-1, ...input.fields.map((field) => field.ordinal));
    if (highest >= group.rows) outgrown(highest + 1);
    return { rowOf: (field) => field.ordinal, dimensionOf: (field) => String(field.ordinal + 1), keys: [] };
  }

  if (group.kind === TEMPLATE_GROUP.KEYED) {
    const ordinals = [...new Set(input.fields.map((field) => field.ordinal))].sort((a, b) => a - b);
    if (ordinals.length > group.rows) outgrown(ordinals.length);
    return {
      rowOf: (field) => (ordinals.includes(field.ordinal) ? ordinals.indexOf(field.ordinal) : null),
      dimensionOf: (field) => String(field.ordinal + 1),
      keys: ordinals.map((ordinal, row) => ({
        at: offsetCell(group.key, { row }),
        value: { kind: CELL_VALUE_KIND.NUMBER, value: String(ordinal + 1) },
      })),
    };
  }

  const members = [...new Set(input.fields.map((field) => field.dimensionKey).filter((member) => member !== ''))];
  if (members.length > group.rows) outgrown(members.length);
  const list = input.lists[group.list] ?? {};
  return {
    rowOf: (field) => (members.includes(field.dimensionKey) ? members.indexOf(field.dimensionKey) : null),
    dimensionOf: (field) => field.dimensionKey,
    keys: members.map((member, row) => {
      const text = list[`${group.qualify ?? ''}${member}`];
      if (text === undefined) throw new Error(`EFRAG's ${group.list} list holds no string for ${member}`);
      return { at: offsetCell(group.member, { row }), value: { kind: CELL_VALUE_KIND.TEXT, value: text } };
    }),
  };
}
