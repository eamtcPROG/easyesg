import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_AXIS_SHAPE_CONFIG_KIND } from '../constants/disclosure.constants';
import type { AxisShapes } from '../interfaces/axis-shape.interface';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The two lists the artefact registers. Anything named in neither keeps one undimensioned row. */
const AXIS_SHAPE = { BREAKDOWN: 'breakdown', CLASSIFICATION: 'classification' } as const;

type AxisShape = (typeof AXIS_SHAPE)[keyof typeof AXIS_SHAPE];

/**
 * Which explicit axes are breakdowns — `AxisShapes` over the configuration store, the adapter half
 * of AD-4 for task 36.4.
 *
 * `ApplicabilityRulesService`'s shape throughout: **validated, never cast**, because this is data an
 * operator publishes (AD-4) and a payload whose `breakdown` arrived as a string must surface as an
 * operator-facing log line rather than as a screen that silently renders one field where the
 * standard asks for three.
 *
 * **A malformed payload fails to *neither* shape, and that reverses the applicability service's
 * direction — deliberately, and for the reason that service states rather than against it.** There,
 * failing open keeps disclosures *visible*, and the danger is a reporter never seeing a section.
 * Here the errors are not symmetric: falling back to *no* registered shape renders B3's three energy
 * elements as one field each and B4's three emissions as one undimensioned row, a defect an operator
 * sees in the log and a reporter can report; the opposite fallback — treat every explicit axis as a
 * breakdown — renders B4 as 282 fields and B7 as 973, which is not a degraded screen but an unusable
 * one. Conservative shape plus a loud line is the direction that leaves the product working.
 *
 * **And the default is the *third* shape rather than an absence** (task 36.5): an axis in neither
 * list keeps one undimensioned row, which is what `ReportingScopesAxis` needs on B3 — its members
 * are baseline year / target year / currently stated, so the default member IS the answer. Reading
 * *not a breakdown* as *a classification* would have put a year picker over eight emissions.
 *
 * **Cached per configuration revision**, keyed on it, so a publication invalidates the cache with no
 * invalidation logic — a new revision is a new key.
 */
@Injectable()
export class AxisShapeService implements AxisShapes {
  private readonly logger = new Logger(AxisShapeService.name);

  private readonly cache = new Map<
    string,
    { revision: number; shapes: Readonly<Record<AxisShape, ReadonlySet<string>>> }
  >();

  constructor(private readonly configurationStore: ConfigurationStore) {}

  breakdownAxes(query: { readonly standard: string }): ReadonlySet<string> {
    return this.shapes(query)[AXIS_SHAPE.BREAKDOWN];
  }

  classificationAxes(query: { readonly standard: string }): ReadonlySet<string> {
    return this.shapes(query)[AXIS_SHAPE.CLASSIFICATION];
  }

  /**
   * Both lists, read and cached together.
   *
   * **One read for both, because they come from one entry** — two cached reads of the same payload
   * is two things to invalidate and one revision to disagree about.
   */
  private shapes(query: {
    readonly standard: string;
  }): Readonly<Record<AxisShape, ReadonlySet<string>>> {
    const entry = this.configurationStore.get({
      kind: DISCLOSURE_AXIS_SHAPE_CONFIG_KIND,
      scope: query.standard,
    });
    // No entry is not a defect: a standard nobody has registered shapes for has neither kind of
    // axis, which is the shape every module had before task 36.4.
    if (!entry) return { [AXIS_SHAPE.BREAKDOWN]: new Set(), [AXIS_SHAPE.CLASSIFICATION]: new Set() };

    const key = `${DISCLOSURE_AXIS_SHAPE_CONFIG_KIND}/${query.standard}`;
    const cached = this.cache.get(key);
    if (cached?.revision === entry.revision) return cached.shapes;

    const shapes = {
      [AXIS_SHAPE.BREAKDOWN]: this.read(entry.payload, AXIS_SHAPE.BREAKDOWN, key, entry.revision),
      [AXIS_SHAPE.CLASSIFICATION]: this.read(
        entry.payload,
        AXIS_SHAPE.CLASSIFICATION,
        key,
        entry.revision,
      ),
    };
    this.cache.set(key, { revision: entry.revision, shapes });
    return shapes;
  }

  private read(payload: unknown, shape: AxisShape, key: string, revision: number): ReadonlySet<string> {
    const named: unknown = isRecord(payload) ? payload[shape] : undefined;
    if (!Array.isArray(named)) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) carries no \`${shape}\` array — every ` +
          `axis registered as a ${shape} renders as a single undimensioned field instead.`,
      );
      return new Set();
    }
    const axes = named.filter((axis): axis is string => typeof axis === 'string');
    if (axes.length !== named.length) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) names ` +
          `${named.length - axes.length} non-string axis(es) under \`${shape}\`, dropped.`,
      );
    }
    return new Set(axes);
  }
}
