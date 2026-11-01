/**
 * A search term made safe to place inside a `LIKE` pattern (task 67.3's, shared since task 203.2): `%` and `_` are
 * the pattern's wildcards and `!` is the escape this repository's statements declare (`ESCAPE '!'`), so a typed `50%`
 * matches the characters and not "50, then anything". **Every statement using it must say `ESCAPE '!'`**, or the
 * escape character is matched literally and the search quietly finds nothing.
 */
export const escapeLikePattern = (term: string): string => term.replace(/[!%_]/gu, (character) => `!${character}`);
