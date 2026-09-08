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

  it('reads a registered shape as its named axes, logging nothing', () => {
    const service = build({ breakdown: ['BreakdownOfEnergyConsumptionAxis', 'TypeOfPollutantAxis'] });
    expect(axes(service)).toEqual(['BreakdownOfEnergyConsumptionAxis', 'TypeOfPollutantAxis']);
    expect(logged).toEqual([]);
  });

  it('answers no breakdowns for a standard nobody has registered shapes for, and says nothing', () => {
    // Absence is not a defect: it is the shape every module had before this task, so it is the one
    // path here that must NOT log — an error line an operator cannot act on trains them to ignore
    // the ones they can.
    expect(axes(build(undefined))).toEqual([]);
    expect(logged).toEqual([]);
  });

  describe('a payload an operator can publish by mistake', () => {
    it.each([
      ['no `breakdown` member', { axes: ['BreakdownOfEnergyConsumptionAxis'] }],
      ['`breakdown` as a string rather than an array', { breakdown: 'BreakdownOfEnergyConsumptionAxis' }],
      ['a payload that is not an object at all', ['BreakdownOfEnergyConsumptionAxis']],
    ])('fails closed on %s, and logs what it did', (_case, payload) => {
      expect(axes(build(payload))).toEqual([]);
      expect(logged).toHaveLength(1);
      // The line must name the entry AND the consequence — `apps/api/CLAUDE.md` on fail-soft design.
      expect(logged[0]).toContain(DISCLOSURE_AXIS_SHAPE_CONFIG_KIND);
      expect(logged[0]).toContain('undimensioned');
    });

    it('drops a non-string axis, keeps the rest, and says how many it dropped', () => {
      const service = build({ breakdown: ['BreakdownOfEnergyConsumptionAxis', 42, null] });
      expect(axes(service)).toEqual(['BreakdownOfEnergyConsumptionAxis']);
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain('2 non-string');
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
        payload: { breakdown: revision === 1 ? ['BreakdownOfEnergyConsumptionAxis'] : ['TypeOfPollutantAxis'] },
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

    it('registers exactly the energy axis, so a second one is a decision somebody took', () => {
      // Exact rather than `> 0`: the count is knowable, and the block below passes vacuously on an
      // empty `breakdown` — the shape a mistyped republish leaves behind. Registering B4's
      // pollutants (36.5) or C3's reporting scopes (79.x) fails here, which is the point: those are
      // decisions about how a screen works, and a screen changing shape should not be silent.
      expect(axes(shipped())).toEqual(['BreakdownOfEnergyConsumptionAxis']);
      expect(logged).toEqual([]);
    });

    it.each(versions)('%s declares every axis the shipped shape names, and none of them typed', (version) => {
      const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
      expect(taxonomy).not.toBeNull();

      for (const key of axes(shipped())) {
        const axis = registry.axis({ standard: TAXONOMY_STANDARD.VSME, version, key });
        // Declared: an axis this version does not carry expands nothing, silently.
        expect({ version, key, declared: axis !== null }).toEqual({ version, key, declared: true });
        // And explicit: a typed axis has no members to expand into, so registering one is a
        // contradiction — the use case resolves it to no rows, which reads as the same silence.
        expect({ version, key, typed: axis?.typed }).toEqual({ version, key, typed: false });
      }
    });
  });
});
