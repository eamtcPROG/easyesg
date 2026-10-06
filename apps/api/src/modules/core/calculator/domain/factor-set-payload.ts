import { isGhgScope, type FactorSource } from '../models/factor-set.model';
import { isDecimalString, isPositiveDecimalString } from '@api/contracts/types/decimal';

/**
 * What a published `emission_factor_set` payload says, read and validated (task 37.1).
 *
 * **Validated, never cast**, for the reason every configuration reader here gives: a factor set is data an operator
 * publishes (A-05, task 67.8), and a payload whose factor arrived as a number or whose unit map is empty has to reach
 * an operator as a log line rather than a calculation as a figure.
 *
 * **A malformed source is dropped whole; a set fails whole where it cannot say which factor applies.** Dropping a
 * source leaves the reporter unable to calculate *that* source — visible, and recoverable by publishing a correction.
 * Two sources under one key, or a set with no name or no readable source, is not a partial answer but an ambiguous or
 * an empty one, and a run pinned to it would record a version that cannot be shown or reproduced.
 *
 * Pure, so the rules are a unit spec rather than a database round trip; `FactorSetCatalog` caches its answer per
 * revision.
 */
export type FactorSetReading =
  | {
      readonly readable: true;
      readonly label: string;
      readonly sources: ReadonlyMap<string, FactorSource>;
      /** The keys of sources dropped as malformed — `?` where the key itself was unreadable. */
      readonly dropped: readonly string[];
    }
  | { readonly readable: false; readonly reason: string };

/** A source key, and the catalogue path segment it becomes: lower case, digits and underscores. */
const SOURCE_KEY = /^[a-z][a-z0-9_]*$/;

/** An invoice unit's code — `m3`, `kWh`, `l`, `t` — resolved to a name by the catalogue. */
const UNIT_CODE = /^[A-Za-z][A-Za-z0-9]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

export function readFactorSetPayload(payload: unknown): FactorSetReading {
  if (!isRecord(payload)) return { readable: false, reason: 'the payload is not an object' };
  if (!isNonEmptyText(payload.label)) return { readable: false, reason: 'it carries no `label`' };
  if (!Array.isArray(payload.sources)) return { readable: false, reason: 'it carries no `sources` array' };

  const sources = new Map<string, FactorSource>();
  const dropped: string[] = [];
  for (const candidate of payload.sources) {
    const source = readSource(candidate);
    if (source === null) {
      dropped.push(isRecord(candidate) && typeof candidate.key === 'string' ? candidate.key : '?');
      continue;
    }
    if (sources.has(source.key)) {
      return { readable: false, reason: `it lists the source \`${source.key}\` twice` };
    }
    sources.set(source.key, source);
  }

  if (sources.size === 0) return { readable: false, reason: 'none of its sources is readable' };
  return { readable: true, label: payload.label, sources, dropped };
}

/** One source, whole or not at all. */
function readSource(candidate: unknown): FactorSource | null {
  if (!isRecord(candidate)) return null;
  const { key, ghgScope, emissionFactor, units, reference } = candidate;
  if (typeof key !== 'string' || !SOURCE_KEY.test(key)) return null;
  if (!isGhgScope(ghgScope)) return null;
  if (!isDecimalString(emissionFactor)) return null;
  if (!isNonEmptyText(reference)) return null;
  if (!isRecord(units)) return null;

  const read = new Map<string, string>();
  for (const [unit, megawattHours] of Object.entries(units)) {
    if (!UNIT_CODE.test(unit) || !isPositiveDecimalString(megawattHours)) return null;
    read.set(unit, megawattHours);
  }
  if (read.size === 0) return null;

  return { key, ghgScope, emissionFactor, units: read, reference };
}
