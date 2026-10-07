/**
 * Which site S-09 shows, from its address (task 39.1; §4.7's *site chips*, UX-4): one of the report's site rows, or
 * every site where the address names none — or names one the report does not hold, so a stale link shows everything
 * rather than an empty table that reads as *nothing entered*.
 */
export function shownSite(input: {
  /** `?site=` as Next hands it: absent, one value, or several. */
  readonly param: string | readonly string[] | undefined;
  readonly sites: readonly { readonly ordinal: number }[];
}): number | null {
  const raw: string | undefined = typeof input.param === 'string' ? input.param : input.param?.[0];
  if (raw === undefined || !/^\d+$/u.test(raw)) return null;
  const ordinal = Number(raw);
  return input.sites.some((site) => site.ordinal === ordinal) ? ordinal : null;
}
