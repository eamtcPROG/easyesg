/**
 * A choice as the import panel's selects carry it (task 204.2): a column's position or an option's value as text,
 * and *no column* — or *none of these* — as a member of its own. `@easyesg/ui`'s `Select` may never take `''`, which
 * Radix reserves for its placeholder, so *nothing chosen* needs a value no column and no option can have: a column is
 * digits, a source a key, a unit a code, a site an ordinal.
 *
 * Read by the column choices and the value matches alike, which is why it is a tool of its own.
 */
export const NO_CHOICE = '-';

export const selectValueOf = (choice: number | string | null): string => (choice === null ? NO_CHOICE : String(choice));

export const columnOfSelect = (value: string): number | null => (value === NO_CHOICE ? null : Number(value));

export const optionOfSelect = (value: string): string | null => (value === NO_CHOICE ? null : value);

/** The column letter a spreadsheet shows over a column — `A` … `Z`, `AA` … — for a column its first row leaves unnamed. */
export function columnLetter(column: number): string {
  const letter = String.fromCharCode(65 + (column % 26));
  return column < 26 ? letter : `${columnLetter(Math.floor(column / 26) - 1)}${letter}`;
}
