/**
 * S-16's dialogues in the address (28 Sep 2026, project owner): `?panel=invite` is the invitation form
 * open over the list and `?panel=remind` the reminder's, so a reload or a pasted link reopens either —
 * UX-4, as §5.2 applies it to A-08's invitation form, whose spelling this is. A reminder opened from a
 * person's row carries them as `&person=<membership>`, so the form opens with them chosen.
 *
 * **Its own module rather than `access.ts`'s view**, because the two are read by different tiers. The
 * view — filter, order, page — is the server's: the section parses it and the read is made from it.
 * The panel changes nothing the server reads, so the browser opens and closes it without a request
 * (`history.pushState`, which Next's router follows), and a view in the section's props would be a
 * copy of the address that stopped being true the moment a dialogue opened.
 */

/** The query parameters: which dialogue, and whom a reminder is for. */
export const ACCESS_PANEL_PARAM = 'panel';
export const ACCESS_PERSON_PARAM = 'person';

export const ACCESS_PANEL = {
  /** UC-60 — the invitation form. */
  INVITE: 'invite',
  /** UC-175 — the reminder form. */
  REMIND: 'remind',
} as const;

export type AccessPanel = (typeof ACCESS_PANEL)[keyof typeof ACCESS_PANEL];

const PANELS: readonly string[] = Object.values(ACCESS_PANEL);

/**
 * The dialogue the address names, or none. Untrusted like every parameter: an unknown value opens
 * nothing rather than a dialogue about the query string.
 */
export const readAccessPanel = (params: Pick<URLSearchParams, 'get'>): AccessPanel | null => {
  const value = params.get(ACCESS_PANEL_PARAM);
  return value !== null && PANELS.includes(value) ? (value as AccessPanel) : null;
};

/**
 * The membership a reminder opens with, or none — and none unless the reminder is the dialogue open, so
 * a stray `person` beside the invitation form chooses nothing. Whether it is someone the reminder may go
 * to is the form's question, answered against the people it was offered, not the address's.
 */
export const readRemindPerson = (params: Pick<URLSearchParams, 'get'>): string | null => {
  if (readAccessPanel(params) !== ACCESS_PANEL.REMIND) return null;
  const person = params.get(ACCESS_PERSON_PARAM);
  return person === null || person === '' ? null : person;
};

/**
 * The address with a dialogue opened or closed, **everything else kept** — the filter, the order and
 * the page stay what the reader was looking at, so closing returns them to the same list. `person`
 * travels with the reminder alone, and leaves with it.
 */
export const accessPanelHref = (input: {
  readonly pathname: string;
  readonly search: string;
  readonly panel: AccessPanel | null;
  readonly person?: string | null;
}): string => {
  const params = new URLSearchParams(input.search);
  if (input.panel === null) params.delete(ACCESS_PANEL_PARAM);
  else params.set(ACCESS_PANEL_PARAM, input.panel);
  const person = input.panel === ACCESS_PANEL.REMIND ? (input.person ?? null) : null;
  if (person === null) params.delete(ACCESS_PERSON_PARAM);
  else params.set(ACCESS_PERSON_PARAM, person);
  const query = params.toString();
  return query ? `${input.pathname}?${query}` : input.pathname;
};
