/**
 * Which line's derivation S-09 opens, from its address (task 39.2; §4.7's *open derivation is an address*): the id the
 * line's client chose, or none. **Only an id's shape is checked here** — a line the report does not hold simply opens
 * nothing, which the board decides against the lines it has.
 */
const LINE_ID = /^[0-9a-f-]{36}$/u;

export function openLine(param: string | readonly string[] | undefined): string | null {
  const raw: string | undefined = typeof param === 'string' ? param : param?.[0];
  return raw !== undefined && LINE_ID.test(raw) ? raw : null;
}
