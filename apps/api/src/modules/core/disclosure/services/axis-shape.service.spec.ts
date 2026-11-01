import { Logger } from '@nestjs/common';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { DISCLOSURE_AXIS_SHAPE_CONFIG_KIND } from '../constants/disclosure.constants';
import { AxisShapeService } from './axis-shape.service';

/**
 * Which explicit axes are breakdowns, as configuration (task 36.4; AD-4, DR-3).
 *
 * `ApplicabilityRulesService`'s spec in both halves, because the service is that service's shape and
 * a shape copied without its gate is the failure `apps/api/CLAUDE.md` names: *"a fail-soft design is
 * only safe when a gate reads the log"*. The first half is what the reader does with a payload an
 * operator can publish by mistake; the second holds the **shipped** artefact against the taxonomy
 * versions it names axes from.
 *
 * The second half is the one that would have caught a real regression. `disclosure-axis-shape.vsme.json`
 * is written by hand and names an axis key EFRAG owns: renamed at a release, or mistyped on a
 * republish, it registers nothing — and the failure is *silent by design*, since an unregistered
 * axis is exactly the single undimensioned row every module had before this task. B3 would quietly
 * go back to three fields where the standard asks for nine, with every other gate green.
 */
describe('AxisShapeService (task 36.4, AD-4)', () => {
  const build = (payload: unknown, revision = 1) => {
    const store = {
      get: (query: { kind: string; scope: string }) =>
        payload === undefined || query.kind !== DISCLOSURE_AXIS_SHAPE_CONFIG_KIND
          ? undefined
          : { kind: query.kind, scope: query.scope, revision, payload },
    } as unknown as ConfigurationStore;
    return new AxisShapeService(store);
  };

  let logged: string[] = [];

  beforeEach(() => {
    // The fail-closed paths log at `error` on purpose. Captured rather than silenced: that the line
    // is written, and what it names, is half of what makes answering "no breakdowns" safe.
    logged = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  const axes = (service: AxisShapeService) =>
    [...service.breakdownAxes({ standard: TAXONOMY_STANDARD.VSME })].sort();

  /** The second registered list (task 36.5) — the axes a reporter selects rows from. */
  const classifications = (service: AxisShapeService) =>
    [...service.classificationAxes({ standard: TAXONOMY_STANDARD.VSME })].sort();

  /** Both lists at once, which is how the shipped artefact is asserted. */
  const shapesOf = (service: AxisShapeService) => ({
    breakdown: axes(service),
    classification: classifications(service),
  });

  /** The third registration (task 79.3) — the axes one module asks at a base and a target member. */
  const targetsOf = (service: AxisShapeService) =>
    [...service.targetAxes({ standard: TAXONOMY_STANDARD.VSME }).values()];

  /** C3's registration as the seed writes it, for the cases about something else. */
  const SCOPES = {
    ReportingScopesAxis: { module: 'C3', base: 'BaselineYearMember', target: 'TargetYearMember' },
  };

  it('reads a registered shape as its named axes, logging nothing', () => {
    const service = build({
      breakdown: ['BreakdownOfEnergyConsumptionAxis'],
      classification: ['TypeOfPollutantAxis', 'TypeOfWasteAxis'],
      targets: SCOPES,
    });
    // **The two lists are kept apart, which is the whole of the shape's meaning** — one axis in the
    // wrong list is B3 rendered as a picker or B4 rendered as 282 fields.
    expect(shapesOf(service)).toEqual({
      breakdown: ['BreakdownOfEnergyConsumptionAxis'],
      classification: ['TypeOfPollutantAxis', 'TypeOfWasteAxis'],
    });
    expect(targetsOf(service)).toEqual([
      { key: 'ReportingScopesAxis', module: 'C3', base: 'BaselineYearMember', target: 'TargetYearMember' },
    ]);
    expect(logged).toEqual([]);
  });

  it('answers neither shape for a standard nobody has registered shapes for, and says nothing', () => {
    // Absence is not a defect: it is the shape every module had before task 36.4, so it is the one
    // path here that must NOT log — an error line an operator cannot act on trains them to ignore
    // the ones they can.
    expect(shapesOf(build(undefined))).toEqual({ breakdown: [], classification: [] });
    expect(targetsOf(build(undefined))).toEqual([]);
    expect(logged).toEqual([]);
  });

  it('reads one list where the other is absent, and says which is missing', () => {
    // A payload registering breakdowns and no classifications is not malformed — it is task 36.4's
    // own artefact, before 36.5 added the second list. It must still answer the first.
    const service = build({ breakdown: ['BreakdownOfEnergyConsumptionAxis'], targets: SCOPES });
    expect(shapesOf(service)).toEqual({
      breakdown: ['BreakdownOfEnergyConsumptionAxis'],
      classification: [],
    });
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('`classification`');
  });

  describe('a payload an operator can publish by mistake', () => {
    it.each([
      ['neither list, under a name nobody reads', { axes: ['BreakdownOfEnergyConsumptionAxis'] }],
      ['a list as a string rather than an array', { breakdown: 'BreakdownOfEnergyConsumptionAxis' }],
      ['a payload that is not an object at all', ['BreakdownOfEnergyConsumptionAxis']],
    ])('fails closed on %s, and logs what it did', (_case, payload) => {
      expect(shapesOf(build(payload))).toEqual({ breakdown: [], classification: [] });
      expect(targetsOf(build(payload))).toEqual([]);
      // **One line per registration**, because they degrade independently and an operator fixing one
      // needs to know the others are also unread — a single line naming the entry would understate it.
      // Six: two builds above, three registrations each.
      expect(logged).toHaveLength(6);
      for (const line of logged) {
        // Each must name the entry AND the consequence — `apps/api/CLAUDE.md` on fail-soft design.
        expect(line).toContain(DISCLOSURE_AXIS_SHAPE_CONFIG_KIND);
        expect(line).toContain('undimensioned');
      }
      expect(logged.join(' ')).toContain('`breakdown`');
      expect(logged.join(' ')).toContain('`classification`');
      expect(logged.join(' ')).toContain('`targets`');
    });

    it('drops a non-string axis, keeps the rest, and says how many it dropped', () => {
      const service = build({
        breakdown: ['BreakdownOfEnergyConsumptionAxis', 42, null],
        classification: ['TypeOfPollutantAxis'],
        targets: {},
      });
      expect(axes(service)).toEqual(['BreakdownOfEnergyConsumptionAxis']);
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain('2 non-string');
      expect(logged[0]).toContain('`breakdown`');
    });

    it('fails one list closed without taking the other with it', () => {
      // The two are read from one entry and cached together, so a malformed half must degrade only
      // itself: B4 losing its picker is a defect, and B3 losing its breakdown at the same time is
      // two — which is what a single early return would have produced.
      const service = build({
        breakdown: ['BreakdownOfEnergyConsumptionAxis'],
        classification: 'nope',
        targets: SCOPES,
      });
      expect(shapesOf(service)).toEqual({
        breakdown: ['BreakdownOfEnergyConsumptionAxis'],
        classification: [],
      });
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain('`classification`');
      expect(targetsOf(service)).toHaveLength(1);
    });

    it('drops a target axis registered without its module or two distinct members, and keeps the others', () => {
      // Half a target axis is worse than none: a base year with no target asks for a figure nothing compares it to.
      const service = build({
        breakdown: [],
        classification: [],
        targets: {
          ...SCOPES,
          NoModule: { base: 'BaselineYearMember', target: 'TargetYearMember' },
          OneMember: { module: 'C3', base: 'BaselineYearMember', target: 'BaselineYearMember' },
          NotAnObject: 'C3',
        },
      });
      expect(targetsOf(service).map((axis) => axis.key)).toEqual(['ReportingScopesAxis']);
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain('NoModule, OneMember, NotAnObject');
      expect(logged[0]).toContain('undimensioned');
    });
  });

  it('re-reads when the revision moves, so a publication needs no invalidation', () => {
    // The cache is keyed on the revision rather than cleared by one, which is only safe if a new
    // revision is actually a new key. A store answering a second revision must not serve the first.
    let revision = 1;
    const store = {
      get: (query: { kind: string; scope: string }) => ({
        kind: query.kind,
        scope: query.scope,
        revision,
        payload: {
          breakdown: revision === 1 ? ['BreakdownOfEnergyConsumptionAxis'] : ['TypeOfPollutantAxis'],
          classification: [],
        },
      }),
    } as unknown as ConfigurationStore;
    const service = new AxisShapeService(store);

    expect(axes(service)).toEqual(['BreakdownOfEnergyConsumptionAxis']);
    revision = 2;
    expect(axes(service)).toEqual(['TypeOfPollutantAxis']);
  });

  describe('the shipped shapes, against the shipped taxonomy versions', () => {
    const entries = readSeedEntries();
    const registry = new TaxonomyRegistryService(seedConfigurationStore(entries));
    const versions = registry.registeredVersions({ standard: TAXONOMY_STANDARD.VSME });

    const shipped = () => {
      const entry = entries.find(
        (candidate) =>
          candidate.kind === DISCLOSURE_AXIS_SHAPE_CONFIG_KIND && candidate.scope === TAXONOMY_STANDARD.VSME,
      );
      expect(entry).toBeDefined();
      return new AxisShapeService({
        get: (query: { kind: string; scope: string }) =>
          query.kind === DISCLOSURE_AXIS_SHAPE_CONFIG_KIND && query.scope === TAXONOMY_STANDARD.VSME
            ? { ...entry, revision: 1 }
            : undefined,
      } as unknown as ConfigurationStore);
    };

    it('registers exactly the axes whose shape somebody has decided', () => {
      // Exact rather than `> 0`: the counts are knowable, and the block below passes vacuously on
      // empty lists — the shape a mistyped republish leaves behind. **This assertion has now done
      // its job twice**: it failed when task 36.8 registered B7's waste axis and again when 36.9
      // registered B8's countries, which is exactly what it was written to do — a screen changing
      // shape is a decision, and it should not be silent. C3's reporting scopes were the last, registered by task 79.3.
      //
      // **`ReportingScopesAxis` is in NEITHER list and that is the third shape** (task 36.5): its
      // members are baseline year / target year / currently stated, so on B3 the default member is
      // the answer and one undimensioned row is right. Moving it into `classification` would put a
      // year picker over eight emissions disclosures, and this assertion is what would say so. **It is
      // the target axis instead** (task 79.3): C3 asks it at the base and the target year beside that row.
      expect(shapesOf(shipped())).toEqual({
        breakdown: ['BreakdownOfEnergyConsumptionAxis'],
        classification: ['CountryOfEmploymentContractAxis', 'TypeOfPollutantAxis', 'TypeOfWasteAxis'],
      });
      expect(targetsOf(shipped())).toEqual([
        { key: 'ReportingScopesAxis', module: 'C3', base: 'BaselineYearMember', target: 'TargetYearMember' },
      ]);
      expect(logged).toEqual([]);
    });

    it.each(versions)('%s declares every axis the shipped shape names, and none of them typed', (version) => {
      const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
      expect(taxonomy).not.toBeNull();

      // **Both lists**, because a typo in either is silent in the same way: an unregistered axis
      // keeps one undimensioned row, which is a legitimate shape and therefore indistinguishable
      // from a mistake.
      for (const key of [...axes(shipped()), ...classifications(shipped())]) {
        const axis = registry.axis({ standard: TAXONOMY_STANDARD.VSME, version, key });
        // Declared: an axis this version does not carry expands nothing, silently.
        expect({ version, key, declared: axis !== null }).toEqual({ version, key, declared: true });
        // And explicit: a typed axis has no members to expand into, so registering one is a
        // contradiction — the use case resolves it to no rows, which reads as the same silence.
        expect({ version, key, typed: axis?.typed }).toEqual({ version, key, typed: false });
      }
    });

    it.each(versions)('%s carries each target axis with both its members, on elements its module presents', (version) => {
      // A target registration names four things EFRAG owns — an axis, two of its members and a module — and each, renamed
      // at a release, would leave C3 asking a year nothing stores or nothing at all, silently.
      const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
      for (const target of targetsOf(shipped())) {
        const axis = registry.axis({ standard: TAXONOMY_STANDARD.VSME, version, key: target.key });
        expect({ version, key: target.key, declared: axis !== null, typed: axis?.typed }).toEqual({
          version,
          key: target.key,
          declared: true,
          typed: false,
        });
        const members = axis?.members.map((member) => member.key) ?? [];
        expect(members).toEqual(expect.arrayContaining([target.base, target.target]));
        const on = (taxonomy?.elements ?? []).filter((element) => element.axes.includes(target.key));
        // The eight emissions, each presented by the module asking the axis and by at least one other: the
        // undimensioned row is that other module's, and an element only the target module presents would have no one
        // answering its reporting year.
        expect(on).toHaveLength(8);
        for (const element of on) {
          expect({ key: element.key, presented: element.modules.includes(target.module) }).toEqual({
            key: element.key,
            presented: true,
          });
          expect(element.modules.length).toBeGreaterThan(1);
        }
      }
    });
  });
});
