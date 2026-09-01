import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { scheduledWindows } from '@api/infrastructure/configuration/seed-configuration';

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
  /** The window this entry is in force over, where its file scheduled one (task 33.3). */
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
}

/**
 * A scheduled file expands to one entry per window, exactly as `config:seed` publishes one schedule
 * row per window.
 *
 * **This is the docblock above being taken literally rather than admired.** Task 33.3 added the
 * schedule form to the real loader and not to this one, and the consequence was immediate: every
 * spec reading `reporting-taxonomy.vsme.json` got a payload of `{ schedule: [...] }`, `pinFor`
 * found no `version`, and eight tests failed at once. That is the double parsing artefacts
 * differently from the running system — the failure this file's header names — caught by the gate
 * rather than by a reader, which is the outcome it was written for.
 */
function expand(kind: string, scope: string, file: Record<string, unknown>): SeedEntry[] {
  // **The real loader's own parser, imported rather than re-implemented.** Two copies of a
  // discriminator is how the double and the running system come to disagree about what a file is —
  // which is exactly what this file's header warns against, and what task 33.3 walked into.
  const windows = scheduledWindows(file);
  if (windows === null) return [{ kind, scope, revision: 1, payload: file }];
  return windows.map((window, index) => ({
    kind,
    scope,
    revision: index + 1,
    payload: window.payload,
    validFrom: window.validFrom ?? null,
    validTo: window.validTo ?? null,
  }));
}

/**
 * Whether an entry is in force on a date — half-open `[from, to)`, the store's own daterange.
 *
 * An entry with no window is always in force, which is what the bare form means.
 */
function coversDate(entry: SeedEntry, on: string): boolean {
  if (entry.validFrom == null && entry.validTo == null) return true;
  if (entry.validFrom != null && on < entry.validFrom) return false;
  if (entry.validTo != null && on >= entry.validTo) return false;
  return true;
}

/** Every seed artefact on disk, as the loader parses it. */
export function readSeedEntries(directory = resolve(process.cwd(), '../../config/seed')): SeedEntry[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const [, kind, scope] = /^([a-z0-9-]+)\.([a-z0-9-]+)\.json$/.exec(name) ?? [];
      const file = JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as Record<
        string,
        unknown
      >;
      return expand(kind?.replaceAll('-', '_') ?? '', scope ?? '', file);
    })
    .flat()
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
    // `on` defaults to today, as the real store's does: an unqualified read asks what is in force
    // now, and with a scheduled artefact that is a different answer from "the first one on disk".
    get: (query) =>
      entries.find(
        (e) =>
          e.kind === query.kind &&
          e.scope === query.scope &&
          coversDate(e, query.on ?? new Date().toISOString().slice(0, 10)),
      ),
    list: (query) =>
      entries.filter(
        (e) => e.kind === query.kind && coversDate(e, query.on ?? new Date().toISOString().slice(0, 10)),
      ),
  } as Pick<ConfigurationStore, 'get' | 'list'>;
  return reads as ConfigurationStore;
}
