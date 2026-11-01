import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  ConfigurationHistory,
  ConfigVersion,
} from '@api/infrastructure/configuration/configuration-history.service';
import { parseSeedName } from '@api/infrastructure/configuration/seed-configuration';

/**
 * NFR-87's kept versions (task 201; `architecture.md` §12.5.6's task-201 row): every payload `config/seed` has shipped
 * for a pinned artefact, frozen in `config/version-pinned/` beside what was recorded under it — and the configuration
 * history that serves them, so a spec reads a kept version through the same adapter a pin is read through.
 *
 * **Here rather than in either spec because both read it** — the calculator's factor sets and validation's rule sets —
 * which is `testing/`'s admission test (`apps/api/CLAUDE.md`).
 *
 * **A directory is named as the seed file it keeps versions of, without `.json`**, and parsed by the loader's own
 * `parseSeedName`, so `emission-factor-set.md/` is kind `emission_factor_set`, scope `md`, exactly as
 * `emission-factor-set.md.json` is. A second parser here is how the kept versions and the seed would come to disagree
 * about which artefact a directory holds.
 */
export interface KeptVersion<T extends KeptFile> {
  readonly kind: string;
  readonly scope: string;
  /** The file's name without `.json` — a factor set's label, a rule set's date. */
  readonly name: string;
  /**
   * Its revision in the history `keptHistory` serves: its place in name order within its scope, the first being 1. A
   * pin to that double, not to any revision a store published — those differ per database, which is why a version is
   * kept by its payload.
   */
  readonly revision: number;
  /** The whole file: the frozen payload, and whatever was recorded under it. */
  readonly file: T;
}

/** What every kept file holds, whatever else it records. */
export interface KeptFile {
  readonly payload: Record<string, unknown>;
}

/** Every kept version of one kind, all scopes, in name order within each. */
export function readKeptVersions<T extends KeptFile>(query: {
  readonly kind: string;
  readonly directory?: string;
}): KeptVersion<T>[] {
  const root = query.directory ?? resolve(process.cwd(), '../../config/version-pinned');
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const artefact = parseSeedName(`${entry.name}.json`);
      if (artefact?.kind !== query.kind) return [];
      return readdirSync(resolve(root, entry.name))
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name, index) => ({
          kind: artefact.kind,
          scope: artefact.scope,
          name: name.slice(0, -'.json'.length),
          revision: index + 1,
          file: JSON.parse(readFileSync(resolve(root, entry.name, name), 'utf8')) as T,
        }));
    });
}

/**
 * `ConfigurationHistory.version` over kept versions — each published at its `revision`, and no window, which a pinned
 * read never consults. Typed as a `Pick` before the cast, as `seedConfigurationStore` is, so changing the query's
 * shape breaks this file rather than every spec that reads through it.
 */
export function keptHistory(versions: readonly KeptVersion<KeptFile>[]): ConfigurationHistory {
  const reads: Pick<ConfigurationHistory, 'version'> = {
    version: <P = Record<string, unknown>>(query: {
      readonly kind: string;
      readonly scope: string;
      readonly revision: number;
    }): Promise<ConfigVersion<P> | undefined> => {
      const kept = versions.find(
        (version) =>
          version.kind === query.kind && version.scope === query.scope && version.revision === query.revision,
      );
      return Promise.resolve(
        kept === undefined
          ? undefined
          : {
              kind: kept.kind,
              scope: kept.scope,
              revision: kept.revision,
              payload: kept.file.payload as P,
              validFrom: null,
              validTo: null,
            },
      );
    },
  };
  return reads as ConfigurationHistory;
}
