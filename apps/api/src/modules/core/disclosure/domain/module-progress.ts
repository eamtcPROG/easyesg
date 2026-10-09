import type { DisclosureLabel } from '@easyesg/i18n';
import { isAnswered } from '@easyesg/validation';
import type { TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import type { EvaluatedApplicability } from '../models/applicability.model';
import type { DisclosureValue } from '../models/disclosure-value.model';
import type { DisclosureModuleSummary } from '../models/wizard-step.model';
import { soleCause } from './applicability';
import { toCause } from './applicability-cause';

/**
 * The persistent module list (UX-5), with how much of each module has been answered (task 89; S-07) — whether it
 * applies (FR-28, task 91.3), where work last happened (FR-39, task 35.3) and whether B1 declared it omitted (UX-29,
 * task 36.13).
 *
 * **Pure: everything it counts is handed in.** The use case reads the report's pinned version, its stored answers,
 * FR-28's verdicts, the label catalogue and B1's omission list; what they make the list is this function's, and every
 * rule below is a unit case without a store.
 */
export function moduleSummaries(input: {
  readonly elements: readonly TaxonomyElement[];
  /** `RegisteredTaxonomy.modules` — the order the list is answered in. */
  readonly moduleOrder: readonly string[];
  /** FR-28's verdicts, for the elements a rule governs and no others. */
  readonly applicability: ReadonlyMap<string, EvaluatedApplicability>;
  readonly byElement: ReadonlyMap<string, readonly DisclosureValue[]>;
  /** For the applicability cause's wording, in the reader's locale. */
  readonly catalogue: Readonly<Record<string, DisclosureLabel>> | null;
  /** The modules B1 declares omitted. */
  readonly omitted: ReadonlySet<string>;
}): readonly DisclosureModuleSummary[] {
  const counts = new Map<string, ModuleCount>();
  for (const element of input.elements) {
    // An element FR-28 has ruled out is not part of this report's obligations, so it is counted
    // into neither side of the module's progress (task 91.3): a services company that can never
    // fill B6 must not be shown a denominator it cannot reach. Its cause is kept, because a
    // module every one of whose elements has gone is a module that has gone, and UX-27 asks why.
    const verdict = input.applicability.get(element.key);
    // An element counts as answered when ANY of its rows is (task 91.2): a repeating group's
    // second site is as much an answer as its first, and `total` counts elements, not rows.
    const answered = (input.byElement.get(element.key) ?? []).filter(isAnswered);

    // **Counted into every module that presents it** (task 36.4). The eight disclosures B3 and C3
    // share are one obligation with one stored value, so each module's own denominator includes
    // them and both progress figures move together — which is what the taxonomy says, and what a
    // Comprehensive reporter filling B3 should see on C3.
    //
    // The pillar-level catch-alls present in none (task 33.3). They are reportable and belong to
    // no step, so they are counted into no module rather than into one invented to hold them.
    for (const module of element.modules) {
      const count = counts.get(module) ?? newModuleCount();
      counts.set(module, count);

      if (verdict !== undefined && !verdict.applicable) {
        count.causes.push(verdict);
        continue;
      }

      count.applicable = true;
      count.total += 1;
      if (answered.length > 0) {
        count.answered += 1;
        // The latest answer in the module is where work last happened (task 35.3, FR-39). A row
        // cleared back to holding nothing is not an answer and does not move it (182/17).
        for (const value of answered) {
          if (count.lastAnsweredAt === null || value.updatedAt > count.lastAnsweredAt) {
            count.lastAnsweredAt = value.updatedAt;
          }
        }
      }
    }
  }

  // The taxonomy's own module order rather than the map's insertion order: S-07's list reads as
  // the standard does, and `RegisteredTaxonomy.modules` is already in that order.
  return input.moduleOrder.flatMap((module) => {
    const count = counts.get(module);
    if (count === undefined) return [];
    // One cause or none — `soleCause` states the rule and a unit case reaches its other branch,
    // which the shipped rules cannot produce (gate-integrity review, 3 Sep 2026).
    const only = count.applicable ? undefined : soleCause(count.causes);
    return [
      {
        module,
        answered: count.answered,
        total: count.total,
        lastAnsweredAt: count.lastAnsweredAt,
        applicable: count.applicable,
        applicabilityCause: toCause(only, input.catalogue),
        omitted: input.omitted.has(module),
      },
    ];
  });
}

/**
 * What one module's row is accumulated in while the elements are walked (task 91.3).
 *
 * Every inapplicable element's verdict is kept, duplicates included: what decides the module's own
 * announcement is how many *distinct* reasons its elements left for, and `soleCause` is what
 * answers that — here it is only collection.
 */
interface ModuleCount {
  answered: number;
  total: number;
  lastAnsweredAt: number | null;
  applicable: boolean;
  causes: EvaluatedApplicability[];
}

const newModuleCount = (): ModuleCount => ({
  answered: 0,
  total: 0,
  lastAnsweredAt: null,
  // False until an applicable element is met: a module whose every element a rule ruled out has
  // nothing to answer, and one with no elements at all never reaches the list.
  applicable: false,
  causes: [],
});
