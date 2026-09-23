/**
 * `pnpm events:check` — AD-15's event catalogue, emitted and checked (task 146; §12.5.6's task-146 row).
 *
 * Two gates in one command, as the task row asks:
 *
 * 1. **The emitted artefact.** The catalogue (`packages/contracts/src/events/catalogue.ts`) is written to
 *    `packages/contracts/events/v1.json`, and the root script then runs `git diff --exit-code` over it — the idiom
 *    `openapi:check` proves. An event declared in the source and not committed in the artefact fails, and **staging
 *    the regenerated file is what makes it pass**: the gate is "the artefact in the commit matches the source in the
 *    commit".
 * 2. **The authority.** Every event names the HTTP path its hint hurries, and that path must exist in
 *    `packages/contracts/openapi/v1.json` **and answer a GET** — a frame's only effect is a refetch. This is *push is
 *    never the authority* in a form CI can refuse.
 *
 * **It proves itself before it judges the catalogue.** The catalogue ships with zero events, and a check over zero
 * entries passes whether it works or not — the shape `boundaries:prove` exists for. So the authority check is first
 * run on three synthetic entries: one naming no path and one naming a path that only writes must each be refused, and
 * one naming a readable path must not be. A check that fails its own proof exits before reading the catalogue.
 *
 * **It loads the TypeScript catalogue directly**, under Node's type stripping (Node 26, architecture.md §12.1) — which
 * is why that module carries no relative import that survives compilation.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EVENT_CATALOGUE, EVENT_ROUTING_KEY } from '../packages/contracts/src/events/catalogue.ts';
import { PUSH_EVENT_ROUTING } from '../apps/api/src/contracts/push.port.ts';

const at = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const OPENAPI = at('packages/contracts/openapi/v1.json');
const ARTEFACT = at('packages/contracts/events/v1.json');
const ROUTING_KEYS = new Set(Object.values(EVENT_ROUTING_KEY));

/** Every refusal an entry list earns against a contract — empty when all of it holds. */
const catalogueFailures = ({ entries, contract }) => {
  const failures = [];
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.name)) failures.push(`${entry.name}: declared twice`);
    seen.add(entry.name);
    if (!ROUTING_KEYS.has(entry.routingKey)) {
      failures.push(`${entry.name}: routing key ${String(entry.routingKey)} is not one of ${[...ROUTING_KEYS].join(', ')}`);
    }
    const path = contract.paths?.[entry.authority];
    if (path === undefined) failures.push(`${entry.name}: its authority ${entry.authority} is no path in the contract`);
    else if (path.get === undefined) failures.push(`${entry.name}: its authority ${entry.authority} answers no GET`);
  }
  return failures;
};

const contract = JSON.parse(readFileSync(OPENAPI, 'utf8'));
const pathNames = Object.keys(contract.paths ?? {});
const readable = pathNames.find((name) => contract.paths[name].get !== undefined);
const writeOnly = pathNames.find((name) => contract.paths[name].get === undefined);

// ── The proof: the check refuses what it exists to refuse, and admits what it must ──
const proof = (name, authority) => ({ name, routingKey: EVENT_ROUTING_KEY.ORGANIZATION, authority });
const inert = [
  catalogueFailures({ entries: [proof('proof.nowhere', '/api/v1/no-such-path')], contract }).length === 0 &&
    'an authority naming no path was admitted',
  (writeOnly === undefined ||
    catalogueFailures({ entries: [proof('proof.write_only', writeOnly)], contract }).length === 0) &&
    'an authority that answers no GET was admitted',
  (readable === undefined || catalogueFailures({ entries: [proof('proof.readable', readable)], contract }).length > 0) &&
    'a readable authority was refused',
].filter(Boolean);
if (inert.length > 0) {
  console.error(`events:check — the check failed its own proof: ${inert.join('; ')}.`);
  process.exit(1);
}

/**
 * **The api's copy agrees with the catalogue** (task 148): the api may not import this package, so it declares the
 * events and their audiences again (`apps/api/src/contracts/push.port.ts`). Every event on either side must be on the
 * other, with the same routing key — or the api publishes a hint no client knows, or a client waits for one the api
 * never sends.
 */
const mirrorFailures = ({ entries, mirror }) => {
  const failures = [];
  const catalogued = new Map(entries.map((entry) => [entry.name, entry.routingKey]));
  for (const [name, routingKey] of Object.entries(mirror)) {
    if (!catalogued.has(name)) failures.push(`${name}: the api publishes it and the catalogue does not declare it`);
    else if (catalogued.get(name) !== routingKey) {
      failures.push(`${name}: the api routes it by ${routingKey}, the catalogue by ${catalogued.get(name)}`);
    }
  }
  for (const name of catalogued.keys()) {
    if (!Object.hasOwn(mirror, name)) failures.push(`${name}: the catalogue declares it and the api does not`);
  }
  return failures;
};

const mirrorProof = [
  mirrorFailures({ entries: [], mirror: { 'proof.only_in_api': EVENT_ROUTING_KEY.ACCOUNT } }).length === 0 &&
    'an event only the api declares was admitted',
  mirrorFailures({ entries: [proof('proof.routed', readable ?? '')], mirror: { 'proof.routed': EVENT_ROUTING_KEY.ACCOUNT } })
    .length === 0 && 'an event routed differently on the two sides was admitted',
].filter(Boolean);
if (mirrorProof.length > 0) {
  console.error(`events:check — the mirror check failed its own proof: ${mirrorProof.join('; ')}.`);
  process.exit(1);
}

// ── The catalogue ──
const failures = [
  ...catalogueFailures({ entries: EVENT_CATALOGUE, contract }),
  ...mirrorFailures({ entries: EVENT_CATALOGUE, mirror: PUSH_EVENT_ROUTING }),
];
if (failures.length > 0) {
  console.error(`events:check — ${failures.length} event(s) refused:\n\n${failures.map((f) => `  ✗ ${f}`).join('\n')}`);
  process.exit(1);
}

const events = [...EVENT_CATALOGUE]
  .map(({ name, routingKey, authority }) => ({ name, routingKey, authority }))
  .sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(ARTEFACT, `${JSON.stringify({ events }, null, 2)}\n`);
console.log(
  `events:check — ${events.length} event(s), each naming a readable path in the contract and routed as the api routes ` +
    'it; the check proved it refuses a missing and a write-only authority and a disagreeing mirror. ' +
    'Emitted packages/contracts/events/v1.json.',
);
