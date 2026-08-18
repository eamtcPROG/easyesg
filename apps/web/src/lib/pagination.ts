/**
 * The list query builder.
 *
 * `apps/api` parses a compact format (§6.8, decided 18 Aug 2026):
 *
 *     ?filters=field,v1,v2|field2,v3&order=field,asc&page=1&onpage=25
 *
 * It carries filtering and sorting in one parse, which is why it beats a bare `page`/`pageSize`
 * here. The accepted cost is stated in §6.8: OpenAPI can only describe a bespoke query encoding
 * as three strings, so the generated client in `@easyesg/contracts` types them loosely. This
 * module is the typed layer that puts the safety back, in one place rather than at each call site.
 *
 * `onpage=-1` ("all rows") is honoured only on routes explicitly marked bounded; everything over
 * an append-only store clamps to `MAX_ON_PAGE` instead.
 *
 * UX-4 makes this addressable state: filters belong in the URL, so a filtered index "is a link a
 * colleague can open at the same state".
 *
 * Not built.
 */
export {};
