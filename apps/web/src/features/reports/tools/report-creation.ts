/**
 * The two choices the creation screen carries in its address (UX-4): the entity and, once one is
 * chosen, the period. Pure, so the parse is a unit spec. `?entity=` and `?period=` reach the screen
 * through the address bar — a repeated key takes its first value and an absent one is `undefined` —
 * and the section re-finds the period in what the API answered rather than trusting the id.
 */

export interface CreationChoice {
  readonly entityId?: string;
  readonly periodId?: string;
}

const single = (
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

export const creationChoice = (
  query: Record<string, string | string[] | undefined>,
): CreationChoice => ({ entityId: single(query, 'entity'), periodId: single(query, 'period') });
