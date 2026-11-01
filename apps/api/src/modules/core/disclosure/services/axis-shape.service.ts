import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_AXIS_SHAPE_CONFIG_KIND } from '../constants/disclosure.constants';
import type { AxisShapes } from '../interfaces/axis-shape.interface';
import type { TargetAxis } from '../models/target-axis';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The two lists the artefact registers. Anything named in neither keeps one undimensioned row. */
const AXIS_SHAPE = { BREAKDOWN: 'breakdown', CLASSIFICATION: 'classification' } as const;

type AxisShape = (typeof AXIS_SHAPE)[keyof typeof AXIS_SHAPE];

/** The artefact's third entry (task 79.3): axis key → the module asking it, and its base and target members. */
const TARGETS = 'targets';

/** Everything one revision of the artefact registers, read and cached together. */
interface RegisteredShapes {
  readonly lists: Readonly<Record<AxisShape, ReadonlySet<string>>>;
  readonly targets: ReadonlyMap<string, TargetAxis>;
}

const NO_SHAPES: RegisteredShapes = {
  lists: { [AXIS_SHAPE.BREAKDOWN]: new Set(), [AXIS_SHAPE.CLASSIFICATION]: new Set() },
  targets: new Map(),
};

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

  private readonly cache = new Map<string, { revision: number; shapes: RegisteredShapes }>();

  constructor(private readonly configurationStore: ConfigurationStore) {}

  breakdownAxes(query: { readonly standard: string }): ReadonlySet<string> {
    return this.shapes(query).lists[AXIS_SHAPE.BREAKDOWN];
  }

  classificationAxes(query: { readonly standard: string }): ReadonlySet<string> {
    return this.shapes(query).lists[AXIS_SHAPE.CLASSIFICATION];
  }

  targetAxes(query: { readonly standard: string }): ReadonlyMap<string, TargetAxis> {
    return this.shapes(query).targets;
  }

  /**
   * Every shape the entry registers, read and cached together.
   *
   * **One read for all, because they come from one entry** — two cached reads of the same payload
   * is two things to invalidate and one revision to disagree about.
   */
  private shapes(query: { readonly standard: string }): RegisteredShapes {
    const entry = this.configurationStore.get({
      kind: DISCLOSURE_AXIS_SHAPE_CONFIG_KIND,
      scope: query.standard,
    });
    // No entry is not a defect: a standard nobody has registered shapes for has neither kind of
    // axis, which is the shape every module had before task 36.4.
    if (!entry) return NO_SHAPES;

    const key = `${DISCLOSURE_AXIS_SHAPE_CONFIG_KIND}/${query.standard}`;
    const cached = this.cache.get(key);
    if (cached?.revision === entry.revision) return cached.shapes;

    const shapes: RegisteredShapes = {
      lists: {
        [AXIS_SHAPE.BREAKDOWN]: this.read(entry.payload, AXIS_SHAPE.BREAKDOWN, key, entry.revision),
        [AXIS_SHAPE.CLASSIFICATION]: this.read(entry.payload, AXIS_SHAPE.CLASSIFICATION, key, entry.revision),
      },
      targets: this.readTargets(entry.payload, key, entry.revision),
    };
    this.cache.set(key, { revision: entry.revision, shapes });
    return shapes;
  }

  /**
   * The target axes (task 79.3), each validated whole: an entry missing its module or either member registers nothing,
   * because half a target axis would serve C3 a base year with no target, or a target with nothing to measure it from.
   *
   * **Fails to none, loudly, as the two lists do** — and the consequence is the one task 79.3 replaced: C3 shows B3's
   * reporting-year figures and asks neither year.
   */
  private readTargets(payload: unknown, key: string, revision: number): ReadonlyMap<string, TargetAxis> {
    const named: unknown = isRecord(payload) ? payload[TARGETS] : undefined;
    if (!isRecord(named)) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) carries no \`${TARGETS}\` object — no axis is asked at its ` +
          `base and target years, and each renders as a single undimensioned field instead.`,
      );
      return new Map();
    }
    const targets = new Map<string, TargetAxis>();
    const dropped: string[] = [];
    for (const [axis, registration] of Object.entries(named)) {
      const fields: Record<string, unknown> = isRecord(registration) ? registration : {};
      const { module, base, target } = fields;
      if (typeof module === 'string' && typeof base === 'string' && typeof target === 'string' && base !== target) {
        targets.set(axis, { key: axis, module, base, target });
      } else {
        dropped.push(axis);
      }
    }
    if (dropped.length > 0) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) registers ${dropped.join(', ')} under \`${TARGETS}\` ` +
          `without a module and two distinct members, dropped — each renders as a single undimensioned field instead.`,
      );
    }
    return targets;
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
