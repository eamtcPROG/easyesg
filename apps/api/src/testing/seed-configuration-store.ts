import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';

/**
 * The shipped `config/seed/` artefacts, behind the configuration store's read surface.
 *
 * **Here rather than inline because two specs now use it** — `platform/taxonomy`'s artefact spec and
 * `platform/localization`'s — which is the condition `apps/api/CLAUDE.md` states: *"`testing/` holds
 * test doubles shared by more than one spec … `tsconfig.build.json` excludes it so it never reaches
 * `dist`, while `tsconfig.json` keeps it in the program so `pnpm typecheck` holds a fake to the
 * interface it claims to implement."* It was correctly inline while one spec used it; task 33.2 is
 * the moment that stopped being true.
 *
 * **The reader is the interesting half, and it mirrors the real loader rather than approximating
 * it**: `<kind>.<scope>.json` with dashes folded to underscores, which is how `config:seed` derives
 * a row's kind and scope from a filename. A double that parsed those differently would let a spec
 * pass against artefacts the running system reads as something else.
 */
export interface SeedEntry {
  readonly kind: string;
  readonly scope: string;
  readonly revision: number;
  readonly payload: Record<string, unknown>;
}

/** Every seed artefact on disk, as the loader parses it. */
export function readSeedEntries(directory = resolve(process.cwd(), '../../config/seed')): SeedEntry[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const [, kind, scope] = /^([a-z0-9-]+)\.([a-z0-9-]+)\.json$/.exec(name) ?? [];
      return {
        kind: kind?.replaceAll('-', '_') ?? '',
        scope: scope ?? '',
        revision: 1,
        payload: JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as Record<string, unknown>,
      };
    })
    .filter((entry) => entry.kind !== '');
}

/**
 * `ConfigurationStore`'s two read methods over those entries.
 *
 * **Typed as `Pick<ConfigurationStore, 'get' | 'list'>` before the cast**, which is the part that
 * earns its place here: `ConfigurationStore` is a concrete class with a private `DataSource` and two
 * lifecycle hooks, so a fake cannot implement it wholesale and every caller was reaching for
 * `as unknown as ConfigurationStore` — a cast that holds the double to nothing. The `Pick` makes
 * `pnpm typecheck` check the two signatures that are actually stood in for, so changing `get`'s
 * query shape breaks this file rather than silently passing in both specs. One documented widening
 * remains, where a consumer's constructor asks for the whole class.
 */
export function seedConfigurationStore(entries: readonly SeedEntry[]): ConfigurationStore {
  const reads: Pick<ConfigurationStore, 'get' | 'list'> = {
    get: (query) => entries.find((e) => e.kind === query.kind && e.scope === query.scope),
    list: (query) => entries.filter((e) => e.kind === query.kind),
  } as Pick<ConfigurationStore, 'get' | 'list'>;
  return reads as ConfigurationStore;
}
