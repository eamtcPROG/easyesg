import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { ConfigurationPublisher } from './configuration-publisher.service';
import { ConfigurationStore } from './configuration-store.service';

/**
 * Applies `config/seed` to the configuration store (DR-3, AD-4).
 *
 * **Idempotent by comparison, not by assertion.** A file is published as a new revision only when
 * its payload differs from what is currently in force. Republishing on every run would move the
 * store version on every deploy — invalidating every replica's cache for no change — and would bury
 * the real publication history under identical revisions, which NFR-19 needs preserved so a stored
 * calculation can be reproduced against the factor set it actually used.
 *
 * It also means an operator's later edit survives a redeploy. Seeds are what the platform ships
 * with, not what it insists on.
 *
 * Run with `pnpm --filter @easyesg/api config:seed`. It is deliberately a script rather than a
 * migration: seeds are data whose desired state changes independently of the schema, and a
 * migration runs once.
 */

const SEED_DIRECTORY = resolve(process.cwd(), '../../config/seed');

/** `<kind>.<scope>.json` — `factor-set.md.json` is kind `factor_set`, scope `md`. */
function parseSeedName(fileName: string): { kind: string; scope: string } | null {
  const match = /^([a-z0-9-]+)\.([a-z0-9-]+)\.json$/.exec(fileName);
  if (!match) return null;
  return { kind: match[1].replaceAll('-', '_'), scope: match[2] };
}

export interface SeedOutcome {
  kind: string;
  scope: string;
  published: boolean;
  revision: number | null;
}

export async function seedConfiguration(dataSource: DataSource): Promise<SeedOutcome[]> {
  const publisher = new ConfigurationPublisher(dataSource);
  const store = new ConfigurationStore(dataSource);
  await store.refreshIfStale();

  const outcomes: SeedOutcome[] = [];

  for (const fileName of readdirSync(SEED_DIRECTORY).sort()) {
    const parsed = parseSeedName(fileName);
    if (!parsed) continue;

    const payload = JSON.parse(
      readFileSync(resolve(SEED_DIRECTORY, fileName), 'utf8'),
    ) as Record<string, unknown>;

    const current = store.get({ kind: parsed.kind, scope: parsed.scope });
    // Compared as canonical JSON so key order in the file cannot register as a change.
    const unchanged = current !== undefined && stableStringify(current.payload) === stableStringify(payload);

    if (unchanged) {
      outcomes.push({ ...parsed, published: false, revision: current.revision });
      continue;
    }

    const revision = await publisher.publish({ ...parsed, payload });
    outcomes.push({ ...parsed, published: true, revision });
  }

  return outcomes;
}

/** Key order is not meaning. Without this, reformatting a seed file would publish a revision. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}
