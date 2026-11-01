/**
 * Is this an absolute web address — an `http` or `https` scheme, `//`, and a host (task 40; FR-40's `INVALID URL`,
 * `design_spec.md` §6.4)? **The form only: the address is never reached** (182/25) — a network call could not run
 * identically in the browser and the api, and would be outbound traffic from the core no source contemplates.
 *
 * **Read by the WHATWG URL parser both runtimes carry**, so the api and the browser agree on every edge the parser
 * decides — a space in the host, a bad port, and no host at all, which the parser refuses for `http` and `https`
 * itself. One check is added in front of it because the parser is lenient where FR-40 is not: it reads
 * `http:example.md` and `http:/example.md` as `http://example.md/`, and accepts any scheme — so `http://` or
 * `https://` must open the text as written.
 *
 * **A bare `www.example.md` is not absolute and is refused**, though the template's own check accepts it — the owner's
 * decision, recorded with the disagreement in §12.5.6's task-40 row (4).
 */
const WEB_SCHEME = /^https?:\/\//iu;

export const isAbsoluteAddress = (text: string): boolean => WEB_SCHEME.test(text) && URL.canParse(text);
