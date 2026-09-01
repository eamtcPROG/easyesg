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
  /** The window this outcome is about, where the file scheduled one. Absent for the bare form. */
  window?: string;
}

/**
 * One effective-dated window of a scheduled seed (task 33.3).
 *
 * **A seed file may hold a schedule instead of a payload**, because the store's own effective dating
 * is where AD-4 puts "which version applies when" and a *starting state* that cannot express a
 * schedule cannot ship an arrangement that depends on one. R-7 is the case that forced it: two
 * taxonomy versions registered from day one with a report pinned to each needs two adoption windows,
 * and one payload per file can only say one thing.
 *
 * Both bounds are **calendar dates** (NFR-34) and both are optional, matching
 * `ConfigurationPublisher`'s own `daterange`: `validFrom` null is "since always", `validTo` null is
 * "until further notice". The schedule carries `WITHOUT OVERLAPS`, so two windows that collide are
 * refused by the database rather than by this loader.
 */
/**
 * The one key that makes a seed file a schedule rather than a payload.
 *
 * Declared once and exported, because the hermetic double in `src/testing/` must parse these files
 * *identically* — its own header says a double that parsed them differently would let a spec pass
 * against artefacts the running system reads as something else, and task 33.3 proved that by
 * teaching only this loader the form and watching eight unit tests fail.
 */
const SEED_SCHEDULE_KEY = 'schedule';

export interface ScheduledSeed {
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
  readonly payload: Record<string, unknown>;
}

/**
 * A file is scheduled when it holds exactly one key, `schedule`, and that key is an array.
 *
 * **Exactly one key, deliberately.** A payload that happened to carry a `schedule` field of its own
 * would otherwise be read as a schedule and lose the rest of itself silently — the same class of
 * defect as a discriminator that is merely probable. No artefact here is a single `schedule` key,
 * and one that wanted to be would have to say so by being nested.
 */
export function scheduledWindows(file: Record<string, unknown>): ScheduledSeed[] | null {
  const keys = Object.keys(file);
  if (keys.length !== 1 || keys[0] !== SEED_SCHEDULE_KEY || !Array.isArray(file[SEED_SCHEDULE_KEY])) {
    return null;
  }
  return file[SEED_SCHEDULE_KEY] as ScheduledSeed[];
}

/**
 * A date inside the window, to ask the store what is in force there.
 *
 * The bare form asks "what is in force *now*", which is wrong for a historical window: seeding an
 * adoption that ended in May would compare against today's and republish on every run, moving the
 * store version for nothing — the exact harm this loader's idempotence exists to prevent. A window
 * with a start is probed at its start; one with only an end is probed the day before it.
 */
function probeDate(window: ScheduledSeed): string | undefined {
  if (window.validFrom != null) return window.validFrom;
  if (window.validTo == null) return undefined;
  const before = new Date(`${window.validTo}T00:00:00Z`);
  before.setUTCDate(before.getUTCDate() - 1);
  return before.toISOString().slice(0, 10);
}

export async function seedConfiguration(dataSource: DataSource): Promise<SeedOutcome[]> {
  const publisher = new ConfigurationPublisher(dataSource);
  const store = new ConfigurationStore(dataSource);
  await store.refreshIfStale();

  const outcomes: SeedOutcome[] = [];

  for (const fileName of readdirSync(SEED_DIRECTORY).sort()) {
    const parsed = parseSeedName(fileName);
    if (!parsed) continue;

    const file = JSON.parse(
      readFileSync(resolve(SEED_DIRECTORY, fileName), 'utf8'),
    ) as Record<string, unknown>;

    const windows = scheduledWindows(file);
    if (windows !== null) {
      await refuseReshape(dataSource, parsed, windows);
      for (const window of windows) {
        outcomes.push(await applyWindow(publisher, store, parsed, window));
      }
      continue;
    }

    const payload = file;
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

/**
 * Refuse to reshape a schedule that is already in force, with a message instead of a constraint.
 *
 * `config.entry_schedule` is keyed `(kind, scope, validity WITHOUT OVERLAPS)`, so narrowing an
 * existing unbounded slot into two windows is not an insert — it collides. Postgres says so
 * correctly and unhelpfully (`conflicting key value violates exclusion constraint
 * "entry_schedule_pkey"`), on a path where the cause is four directories away in a JSON file.
 *
 * **This does not delete the old slot, and that is the decision rather than a limitation.** A seed
 * is the state the platform ships with, and `config/seed/README.md` promises that a later run does
 * not undo an operator's edit — a loader that silently rewrote a live schedule would break exactly
 * that promise, on the table that decides which taxonomy a filing is pinned to. Reshaping an
 * adopted schedule is an operator action with a revert path (AD-4, NFR-85); this names it.
 *
 * A fresh database has no rows here and never sees this.
 */
async function refuseReshape(
  dataSource: DataSource,
  parsed: { kind: string; scope: string },
  windows: ScheduledSeed[],
): Promise<void> {
  // **Postgres does the comparison, not a string built here.** It normalises a daterange on the way
  // in — an unbounded lower bound is always exclusive, so the publisher's `[,2026-01-01)` is stored
  // as `(,2026-01-01)`. Re-deriving that spelling in TypeScript would be a second implementation of
  // a rule the database already owns, and it would be wrong in exactly the case nobody tests.
  const wanted = windows.map((w) => `[${w.validFrom ?? ''},${w.validTo ?? ''})`);
  const strays = await dataSource.query<{ validity: string }[]>(
    `SELECT validity::text AS validity
       FROM config.entry_schedule
      WHERE kind = $1 AND scope = $2 AND validity <> ALL($3::daterange[])`,
    [parsed.kind, parsed.scope, wanted],
  );
  if (strays.length === 0) return;

  throw new Error(
    `${parsed.kind}/${parsed.scope}: the store already holds ` +
      `${strays.map((s) => s.validity).join(', ')}, which this seed's schedule does not contain. ` +
      `Narrowing a live schedule is an operator action, not a seed — publish the new windows ` +
      `through the configuration surface, or clear the slot deliberately. Seeding will not rewrite ` +
      `a schedule someone may have scheduled.`,
  );
}

/**
 * One window, published only where it differs from what is already in force inside it.
 *
 * Same comparison the bare form makes, asked at a date the window actually covers rather than at
 * today.
 */
async function applyWindow(
  publisher: ConfigurationPublisher,
  store: ConfigurationStore,
  parsed: { kind: string; scope: string },
  window: ScheduledSeed,
): Promise<SeedOutcome> {
  const on = probeDate(window);
  const current = store.get({ kind: parsed.kind, scope: parsed.scope, ...(on === undefined ? {} : { on }) });
  const label = `${window.validFrom ?? '-'}..${window.validTo ?? '-'}`;

  if (current !== undefined && stableStringify(current.payload) === stableStringify(window.payload)) {
    return { ...parsed, published: false, revision: current.revision, window: label };
  }

  const revision = await publisher.publish({
    ...parsed,
    payload: window.payload,
    validFrom: window.validFrom ?? null,
    validTo: window.validTo ?? null,
  });
  return { ...parsed, published: true, revision, window: label };
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
