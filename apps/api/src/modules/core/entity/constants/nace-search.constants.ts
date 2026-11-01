/**
 * The bounds on an activity-classifier search (FR-17, task 30.4.1).
 *
 * **Here rather than beside the use case, because `controllers-not-to-use-cases` is right.** The
 * controller needs the default to declare its query parameter and the use case needs both to clamp;
 * importing them across that boundary made a transport file depend on an application one for a
 * number, which is exactly the coupling the rule exists to refuse — and the boundary gate caught it
 * rather than a reviewer. A value two layers share belongs to neither.
 */

/** What a caller gets without asking. A picker shows a page; it does not show 996 rows. */
export const NACE_SEARCH_DEFAULT_LIMIT = 25;

/** The ceiling. A request above it is clamped rather than refused: a picker asking for too much is
 *  a caller to correct, not a reader to fail. */
export const NACE_SEARCH_MAX_LIMIT = 50;
