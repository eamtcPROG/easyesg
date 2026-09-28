/**
 * S-16's dialogue in the address (28 Sep 2026, project owner): `?panel=invite` is the invitation form
 * open over the list, so a reload or a pasted link reopens it — UX-4, as §5.2 applies it to A-08's
 * invitation form, whose spelling this is.
 *
 * **Its own module rather than `access.ts`'s view**, because the two are read by different tiers. The
 * view — filter, order, page — is the server's: the section parses it and the read is made from it.
 * The panel changes nothing the server reads, so the browser opens and closes it without a request
 * (`history.pushState`, which Next's router follows), and a view in the section's props would be a
 * copy of the address that stopped being true the moment the dialogue opened.
 */

/** The query parameter, and the one dialogue it can name. */
export const ACCESS_PANEL_PARAM = 'panel';

export const ACCESS_PANEL = {
  /** UC-60 — the invitation form. */
  INVITE: 'invite',
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
 * The address with the dialogue opened or closed, **everything else kept** — the filter, the order and
 * the page stay what the reader was looking at, so closing returns them to the same list.
 */
export const accessPanelHref = (input: {
  readonly pathname: string;
  readonly search: string;
  readonly panel: AccessPanel | null;
}): string => {
  const params = new URLSearchParams(input.search);
  if (input.panel === null) params.delete(ACCESS_PANEL_PARAM);
  else params.set(ACCESS_PANEL_PARAM, input.panel);
  const query = params.toString();
  return query ? `${input.pathname}?${query}` : input.pathname;
};
