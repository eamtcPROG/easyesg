import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BROWSER_STORAGE, COOKIE_INVENTORY, COOKIE_SURFACE } from './cookie-inventory';

/**
 * Task 75.2's gate (182/122; FR-206 AC-4, AC-9): the cookie policy states what the build sets, so a cookie or a browser
 * store the inventory does not list fails here, before the policy can be false for one release (OQ-23).
 *
 * **Read from the source of every app, not imported**: the operator console's two cookies are set by `apps/api`, which
 * `apps/web` may not import (`web-not-to-api-src`), and a cookie is added by declaring its name — every one in the
 * repository is a constant whose name ends in `COOKIE`, which is the shape this reads.
 */
const ROOT = join(import.meta.dirname, '../../../..');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/u.test(entry) && !/\.(spec|test)\.tsx?$/u.test(entry) && !entry.endsWith('.d.ts') ? [path] : [];
  });

const SOURCES = ['apps/web/src', 'apps/admin/src', 'apps/api/src', 'packages/ui/src'].flatMap((dir) =>
  sourceFiles(join(ROOT, dir)),
);

/**
 * `export const SOME_COOKIE = 'name';` — the value of every constant named for a cookie. `SET_COOKIE` is the response
 * header's name, which two api files declare, and not a cookie.
 */
const declaredCookies = (): string[] =>
  SOURCES.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/\b(?!SET_COOKIE\b)[A-Z_]*COOKIE\s*=\s*'([^']+)'/gu)].map((match) => match[1]),
  );

/**
 * The modules that use browser storage that is not a cookie, from the repository's root — read as a use (`x.` or the
 * IndexedDB factory), so a module that only names a store, as the inventory does, is not counted as keeping one.
 */
const USES_STORAGE = /\b(sessionStorage|localStorage)\.|\bindexedDB\b/u;
const storageModules = (): string[] =>
  SOURCES.filter((file) => USES_STORAGE.test(readFileSync(file, 'utf8')))
    .map((file) => relative(ROOT, file))
    .toSorted();

describe('the cookie inventory', () => {
  it('lists every cookie the repository declares, and nothing it does not', () => {
    expect(COOKIE_INVENTORY.map((cookie) => cookie.name).toSorted()).toEqual([...new Set(declaredCookies())].toSorted());
  });

  it('is read from source that holds the cookies — the scan is not looking at nothing', () => {
    // Without this, a path that stopped resolving would make the first case compare two empty lists.
    expect(declaredCookies()).toEqual(expect.arrayContaining(['easyesg_session', 'easyesg_admin_session']));
  });

  it('names where each cookie is set: the site, or the operator console', () => {
    expect(
      COOKIE_INVENTORY.filter((cookie) => cookie.surface === COOKIE_SURFACE.CONSOLE).map((cookie) => cookie.name),
    ).toEqual(['easyesg_admin_session', 'easyesg_admin_challenge']);
  });

  /** OQ-23's basis: no browser storage holds a preference beyond the tab's session — so none persists by `localStorage`. */
  it('names every module that keeps browser storage that is not a cookie, and none uses localStorage', () => {
    expect(BROWSER_STORAGE.map((store) => store.module).toSorted()).toEqual(storageModules());
    expect(SOURCES.filter((file) => /\blocalStorage\./u.test(readFileSync(file, 'utf8')))).toEqual([]);
  });
});
