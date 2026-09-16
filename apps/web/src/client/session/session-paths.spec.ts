import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SESSION_TIER_PATH } from './session-paths';

/**
 * Each path the browser fetches is a Route Handler on disk (task 92). A path string is invisible to
 * `typecheck`, and a handler directory renamed under it would leave the dialogue posting to a 404 that
 * every unit spec — all of which stub `fetch` — would still pass.
 */
const APP = join(__dirname, '..', '..', 'app');

describe('SESSION_TIER_PATH', () => {
  it.each(Object.entries(SESSION_TIER_PATH))('%s is answered by a route handler', (_name, path) => {
    expect(existsSync(join(APP, ...path.split('/').filter(Boolean), 'route.ts'))).toBe(true);
  });
});
