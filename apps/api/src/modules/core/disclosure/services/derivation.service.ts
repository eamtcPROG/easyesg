import { Injectable, Logger } from '@nestjs/common';
import type { Derivations } from '../interfaces/derivation.interface';

import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_DERIVATION_CONFIG_KIND } from '../constants/disclosure.constants';
import {
  type Derivation,
  type DerivationOperand,
  isDerivationFormula,
  isOperandSource,
} from '../models/derivation.model';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Which elements are derived and from what — the adapter half of AD-4 for task 36.10.
 *
 * `AxisShapeService`'s shape, and its reasoning about which way to fail. **Validated, never cast**,
 * because this is data an operator publishes: a payload whose `operands` arrived as a string has to
 * surface as an operator-facing log line rather than as a rate silently computed from nothing.
 *
 * **It fails closed, and here that is the safe direction rather than the conservative one.** An
 * unreadable entry yields no derivations, so the two rates render as ordinary unanswered fields and
 * the reporter is short two figures — visible, reportable, and recoverable by republishing the
 * artefact. The opposite failure is a rate computed from a half-read operand map and written into a
 * filing with `origin = 'calculated'`, which is a wrong number wearing the mark that says the system
 * stands behind it. A derivation dropped for being malformed is dropped **whole**, never partially,
 * for the same reason.
 *
 * **Cached per configuration revision**, keyed on it, so a publication invalidates the cache with no
 * invalidation logic — a new revision is a new key.
 */
@Injectable()
export class DerivationService implements Derivations {
  private readonly logger = new Logger(DerivationService.name);
  private readonly cache = new Map<
    string,
    { revision: number; derivations: ReadonlyMap<string, Derivation> }
  >();

  constructor(private readonly configurationStore: ConfigurationStore) {}

  /** Every registered derivation, by the element it produces. */
  all(query: { readonly standard: string }): ReadonlyMap<string, Derivation> {
    const entry = this.configurationStore.get({
      kind: DISCLOSURE_DERIVATION_CONFIG_KIND,
      scope: query.standard,
    });
    // No entry is not a defect: a standard nobody has registered derivations for derives nothing,
    // which is the shape every module had before this task.
    if (!entry) return new Map();

    const key = `${DISCLOSURE_DERIVATION_CONFIG_KIND}/${query.standard}`;
    const cached = this.cache.get(key);
    if (cached?.revision === entry.revision) return cached.derivations;

    const derivations = this.read(entry.payload, key, entry.revision);
    this.cache.set(key, { revision: entry.revision, derivations });
    return derivations;
  }

  /** The one that produces this element, or `null` — which is the ordinary answer. */
  forElement(query: { readonly standard: string; readonly element: string }): Derivation | null {
    return this.all({ standard: query.standard }).get(query.element) ?? null;
  }

  private read(payload: unknown, key: string, revision: number): ReadonlyMap<string, Derivation> {
    const listed: unknown = isRecord(payload) ? payload.derivations : undefined;
    if (!Array.isArray(listed)) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) carries no \`derivations\` array — ` +
          `every derived figure renders as an ordinary unanswered field instead.`,
      );
      return new Map();
    }

    const read = new Map<string, Derivation>();
    const dropped: string[] = [];
    for (const candidate of listed) {
      const derivation = this.readOne(candidate);
      if (derivation === null) {
        dropped.push(isRecord(candidate) && typeof candidate.element === 'string' ? candidate.element : '?');
        continue;
      }
      read.set(derivation.element, derivation);
    }
    if (dropped.length > 0) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) carries ${dropped.length} malformed ` +
          `derivation(s), dropped: ${dropped.join(', ')}`,
      );
    }
    return read;
  }

  /** One derivation, whole or not at all. */
  private readOne(candidate: unknown): Derivation | null {
    if (!isRecord(candidate)) return null;
    const { element, formula, operands } = candidate;
    if (typeof element !== 'string' || element === '') return null;
    if (!isDerivationFormula(formula)) return null;
    if (!isRecord(operands)) return null;

    const read: Record<string, DerivationOperand> = {};
    for (const [name, binding] of Object.entries(operands)) {
      if (!isRecord(binding)) return null;
      if (!isOperandSource(binding.from)) return null;
      if (typeof binding.key !== 'string' || binding.key === '') return null;
      // A default is optional and must be a decimal string where present. A number here would be a
      // float on the way to a `numeric` column, which §7.3 refuses for exactly this class of value.
      const fallback = binding.default;
      if (fallback !== undefined && typeof fallback !== 'string') return null;
      read[name] = { from: binding.from, key: binding.key, fallback: fallback ?? null };
    }
    if (Object.keys(read).length === 0) return null;
    return { element, formula, operands: read };
  }
}
