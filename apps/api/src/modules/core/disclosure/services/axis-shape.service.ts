import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_AXIS_SHAPE_CONFIG_KIND } from '../constants/disclosure.constants';
import type { AxisShapes } from '../interfaces/axis-shape.interface';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Which explicit axes are breakdowns — `AxisShapes` over the configuration store, the adapter half
 * of AD-4 for task 36.4.
 *
 * `ApplicabilityRulesService`'s shape throughout: **validated, never cast**, because this is data an
 * operator publishes (AD-4) and a payload whose `breakdown` arrived as a string must surface as an
 * operator-facing log line rather than as a screen that silently renders one field where the
 * standard asks for three.
 *
 * **A malformed payload fails to *no* breakdowns, and that reverses the applicability service's
 * direction — deliberately, and for the reason that service states rather than against it.** There,
 * failing open keeps disclosures *visible*, and the danger is a reporter never seeing a section.
 * Here the two errors are not symmetric: falling back to *no* breakdown renders B3's three energy
 * elements as one field each, a defect an operator sees in the log and a reporter can report; the
 * opposite fallback — treat every explicit axis as a breakdown — renders B4 as 282 fields and B7 as
 * 973, which is not a degraded screen but an unusable one. Conservative shape plus a loud line is
 * the direction that leaves the product working.
 *
 * **Cached per configuration revision**, keyed on it, so a publication invalidates the cache with no
 * invalidation logic — a new revision is a new key.
 */
@Injectable()
export class AxisShapeService implements AxisShapes {
  private readonly logger = new Logger(AxisShapeService.name);

  private readonly cache = new Map<string, { revision: number; breakdown: ReadonlySet<string> }>();

  constructor(private readonly configurationStore: ConfigurationStore) {}

  breakdownAxes(query: { readonly standard: string }): ReadonlySet<string> {
    const entry = this.configurationStore.get({
      kind: DISCLOSURE_AXIS_SHAPE_CONFIG_KIND,
      scope: query.standard,
    });
    // No entry is not a defect: a standard nobody has registered shapes for has no breakdown axis,
    // which is the shape every module had before this task.
    if (!entry) return new Set();

    const key = `${DISCLOSURE_AXIS_SHAPE_CONFIG_KIND}/${query.standard}`;
    const cached = this.cache.get(key);
    if (cached?.revision === entry.revision) return cached.breakdown;

    const breakdown = this.read(entry.payload, key, entry.revision);
    this.cache.set(key, { revision: entry.revision, breakdown });
    return breakdown;
  }

  private read(payload: unknown, key: string, revision: number): ReadonlySet<string> {
    if (!isRecord(payload) || !Array.isArray(payload.breakdown)) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) carries no \`breakdown\` array — every ` +
          'axis is read as a classification, so any breakdown renders as a single undimensioned field.',
      );
      return new Set();
    }
    const named = payload.breakdown.filter((axis): axis is string => typeof axis === 'string');
    if (named.length !== payload.breakdown.length) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) names ` +
          `${payload.breakdown.length - named.length} non-string axis(es), dropped.`,
      );
    }
    return new Set(named);
  }
}
