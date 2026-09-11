import { MEMBERSHIP_GRANT_KIND, type MembershipGrantKind } from '@easyesg/contracts';

/**
 * S-05's own rules (UC-16, UC-67; FR-12, FR-23) — pure, so both are unit specs rather than browser
 * journeys. The same split `../../access/access.ts` makes.
 *
 * **In `tools/` with `overview.ts` and both specs** (task 126, project owner: *files should not sit
 * at the same level as folders*, and the folder's name is theirs). They were loose at `home/`'s root
 * beside `components/`, which is the shape that rule refuses: a listing mixing the two makes a
 * reader check each entry to learn what kind of thing it is. `home/` is now two folders and nothing
 * else.
 *
 * **Two files here are named for S-05 and one of them collides** — `home.spec.ts` is this module's
 * unit spec, and `e2e/web/home.spec.ts` is the screen's browser suite. Task 126 made that ambiguous
 * by giving this one a folder, so every reference to the browser one in this feature now carries its
 * path. Neither file moves for it: each is named for the screen it covers, which is right in both
 * trees.
 *
 * **`tools/`, where `apps/web/CLAUDE.md` says *rules*** — *"each screen folder holds its own rules,
 * its own actions and its own `components/`"*. That sentence describes what a screen folder
 * contains, not what its directories are called, so there is no disagreement to resolve; the note is
 * here because a reader who knows the sentence will look for the word and should find out in one
 * place that it is this folder.
 *
 * One `tools/` rather than a folder per module, because these four files are a **leaf** — a
 * directory of files is fine, a directory of files *and* folders is what was being complained
 * about — and because every extra level lengthens the `../` chain four components under
 * `components/overview/` walk to reach them.
 */

/**
 * Which arrival sentence to show, from `?joined=`.
 *
 * **An unrecognised value is no sentence rather than a default one.** The parameter reaches this
 * screen through the address bar, so it is whatever somebody typed — and a home that announced
 * *"you now have access"* to a reader who edited a query string would be stating something the
 * product never decided. Absent and unrecognised are the same fact here: nothing to say.
 */
export const readArrival = (value: string | string[] | undefined): MembershipGrantKind | null => {
  const single = Array.isArray(value) ? value[0] : value;
  return (
    Object.values(MEMBERSHIP_GRANT_KIND).find((grant) => grant === single) ?? null
  );
};
