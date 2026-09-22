/**
 * §6.8's compact list query as a route's narrowing reads it — the parsed shape and its sort vocabulary, without the
 * framework classes (tasks 131, 67.3, 50.1.2).
 *
 * **Here rather than in `app/dto/request-list.dto.ts`**, because the files that narrow a list query into a route's
 * own vocabulary are `domain/` files — they hold the rules: which facets exist, what an unreadable one falls back
 * to — and that module carries `@nestjs/swagger`. `domain-free-of-frameworks` checks a domain file's own imports,
 * not what those import, so reaching the vocabulary through the DTO module passed the gate while putting Swagger in
 * the domain's graph; S-16's and A-02's narrowers both did. `RequestListDto` satisfies `ListQueryInput` by
 * construction and imports the vocabulary from here, so a controller hands over what it parsed and each narrowing
 * stays a unit spec with no container and no request. It imports nothing, so `contracts-is-a-leaf` holds.
 */

/**
 * The sort vocabulary of the compact format, as an `as const` object with its union and its contract surface both
 * derived (CLAUDE.md, "Conventions"). It had been a hand-written union with `['asc', 'desc']` restated in an
 * `@ApiProperty` — two copies of one closed set, and the published enum was the copy that could drift silently.
 */
export const SORT_DIRECTION = { ASC: 'asc', DESC: 'desc' } as const;

export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

/** Membership decided from the object, so a member added there is accepted here by construction. */
export const isSortDirection = (value: string): value is SortDirection =>
  (Object.values(SORT_DIRECTION) as string[]).includes(value);

/** The parsed query, as `ListQueryInterceptor` leaves it on the request. */
export interface ListQueryInput {
  readonly filters: readonly { readonly field: string; readonly values: readonly string[] }[];
  readonly order: readonly { readonly field: string; readonly direction: string }[];
  readonly skip: number;
  readonly take: number | undefined;
}
