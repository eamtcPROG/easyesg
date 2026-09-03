import { Logger } from '@nestjs/common';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { DISCLOSURE_APPLICABILITY_CONFIG_KIND } from '../constants/disclosure.constants';
import { APPLICABILITY_CONDITION } from '../models/applicability.model';
import { ApplicabilityRulesService } from './applicability-rules.service';

/**
 * FR-28's rules as configuration (task 91.3; FR-72, AD-4, UC-81).
 *
 * Two halves. The first is what the reader does with a payload — including the ones an operator can
 * publish by mistake, where the direction of failure is the decision §12.5.6 records. The second
 * holds the **shipped** artefact against the taxonomy versions it names elements from, because
 * `disclosure-applicability.vsme.json` is written by hand: an element key EFRAG renames would
 * otherwise govern nothing, silently, and every conditional field would simply always apply.
 */
describe('ApplicabilityRulesService (FR-28, FR-72)', () => {
  const build = (payload: Record<string, unknown> | undefined, revision = 1) => {
    const store = {
      get: (query: { kind: string; scope: string }) =>
        payload === undefined || query.kind !== DISCLOSURE_APPLICABILITY_CONFIG_KIND
          ? undefined
          : { kind: query.kind, scope: query.scope, revision, payload },
    } as unknown as ConfigurationStore;
    return new ApplicabilityRulesService(store);
  };

  const rule = (condition: unknown, elements: unknown = ['EmployeeTurnoverRate']) => ({
    elements,
    condition,
  });
  const threshold = { kind: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST, elementKey: 'NumberOfEmployees', threshold: '50' };

  let logged: string[] = [];

  beforeEach(() => {
    // The fail-open paths log at `error` on purpose. Captured rather than silenced: that the line
    // is written, and what it names, is half of what makes dropping a rule safe.
    logged = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads a registered rule set, narrowing each condition to the vocabulary', () => {
    const rules = build({
      rules: [
        rule(threshold),
        rule({ kind: APPLICABILITY_CONDITION.ANY_ROW_ANSWERED, elementKeys: ['CityOfSite'] }),
        rule({ kind: APPLICABILITY_CONDITION.MEMBER_WITHIN, elementKey: 'NaceSectorClassificationCodes', members: ['nace:NACE_C'] }),
      ],
    }).rulesFor({ standard: TAXONOMY_STANDARD.VSME });

    expect(rules.map((entry) => entry.condition.kind)).toEqual([
      APPLICABILITY_CONDITION.NUMERIC_AT_LEAST,
      APPLICABILITY_CONDITION.ANY_ROW_ANSWERED,
      APPLICABILITY_CONDITION.MEMBER_WITHIN,
    ]);
    expect(logged).toEqual([]);
  });

  it('answers nothing for a standard with no entry, and logs nothing about it', () => {
    expect(build(undefined).rulesFor({ standard: TAXONOMY_STANDARD.VSME })).toEqual([]);
    // Not an error: a standard with no conditional disclosures has no rules, and every field
    // applies. Logging it would make the ordinary case noisy.
    expect(logged).toEqual([]);
  });

  describe('a payload an operator can publish by mistake fails OPEN', () => {
    it.each([
      ['rules that are not a list', { rules: { first: threshold } }],
      ['no rules key at all', { thresholds: [] }],
    ])('%s: every disclosure stays applicable, loudly', (_name, payload) => {
      expect(build(payload).rulesFor({ standard: TAXONOMY_STANDARD.VSME })).toEqual([]);
      expect(logged).toHaveLength(1);
    });

    it.each([
      ['an unknown condition kind', rule({ kind: 'employee_count_over', elementKey: 'x', threshold: '5' })],
      ['a threshold that is a number, not decimal text', rule({ ...threshold, threshold: 50 })],
      // Dropped here rather than left to compare as unmet: an unreadable threshold that hid its
      // field would be the one direction of failure a reporter cannot notice.
      ['a threshold no comparison can read', rule({ ...threshold, threshold: 'fifty' })],
      ['a condition that is not an object', rule('at least fifty')],
      ['no elements to govern', rule(threshold, [])],
      ['elements that are not strings', rule(threshold, [{ key: 'EmployeeTurnoverRate' }])],
      ['a member list that is empty', rule({ kind: APPLICABILITY_CONDITION.MEMBER_WITHIN, elementKey: 'x', members: [] })],
    ])('%s: that rule alone is dropped, and named', (_name, broken) => {
      const rules = build({ rules: [rule(threshold), broken] }).rulesFor({ standard: TAXONOMY_STANDARD.VSME });
      // The good rule survives — one unreadable row must not remove the rest, which is the
      // classifier's rule applied here.
      expect(rules).toHaveLength(1);
      expect(logged).toHaveLength(1);
      // Named, not merely counted: a line that does not say which rule went is a line nobody can act on.
      expect(logged[0]).toContain('index 1');
    });
  });

  it('re-reads on a new revision and not before, so a publish takes effect with no restart (FR-72)', () => {
    let revision = 1;
    let payload: Record<string, unknown> = { rules: [rule(threshold)] };
    const store = {
      get: () => ({ kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND, scope: 'vsme', revision, payload }),
    } as unknown as ConfigurationStore;
    const service = new ApplicabilityRulesService(store);

    expect(service.rulesFor({ standard: TAXONOMY_STANDARD.VSME })[0]?.condition).toMatchObject({ threshold: '50' });

    // Same revision, changed payload: the cache is authoritative, which is what makes the read
    // affordable on every request.
    payload = { rules: [rule({ ...threshold, threshold: '20' })] };
    expect(service.rulesFor({ standard: TAXONOMY_STANDARD.VSME })[0]?.condition).toMatchObject({ threshold: '50' });

    revision = 2;
    expect(service.rulesFor({ standard: TAXONOMY_STANDARD.VSME })[0]?.condition).toMatchObject({ threshold: '20' });
  });
});

describe('the shipped rules, against the shipped taxonomy versions', () => {
  const entries = readSeedEntries();
  const registry = new TaxonomyRegistryService(seedConfigurationStore(entries));
  const versions = registry.registeredVersions({ standard: TAXONOMY_STANDARD.VSME });
  const rules = new ApplicabilityRulesService(seedConfigurationStore(entries)).rulesFor({ standard: TAXONOMY_STANDARD.VSME });

  it('registers FR-28’s four rules, and reads all four', () => {
    expect(rules).toHaveLength(4);
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });

  it.each(versions)('%s names every element the rules govern and read', (version) => {
    const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    const byKey = new Map((taxonomy?.elements ?? []).map((element) => [element.key, element]));

    for (const entry of rules) {
      for (const key of entry.elements) {
        // A governed element the version does not carry would make its rule govern nothing.
        expect({ key, present: byKey.has(key) }).toEqual({ key, present: true });
      }
      // Every driver is a B1 element: FR-28 says applicability is evaluated "from B1 inputs", and
      // a rule reading a later module's answer would make B1's precedence (UX-9) meaningless.
      const drivers =
        entry.condition.kind === APPLICABILITY_CONDITION.ANY_ROW_ANSWERED
          ? entry.condition.elementKeys
          : [entry.condition.elementKey];
      for (const key of drivers) expect({ key, module: byKey.get(key)?.module }).toEqual({ key, module: 'B1' });
    }
  });

  it.each(versions)('%s declares every NACE section the water rule names, at the domain’s root', (version) => {
    const within = rules.flatMap((entry) =>
      entry.condition.kind === APPLICABILITY_CONDITION.MEMBER_WITHIN ? [entry.condition] : [],
    );
    expect(within).toHaveLength(1);

    const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    const element = taxonomy?.elements.find((candidate) => candidate.key === within[0]?.elementKey);
    const enumeration = taxonomy?.enumerations.find((candidate) => candidate.key === element?.domain);
    const members = new Map((enumeration?.members ?? []).map((member) => [`nace:${member.key}`, member]));

    for (const member of within[0]?.members ?? []) {
      // Declared, and a *section*: a rule naming a class would silently match only that class,
      // since descent is what relates the stored answer to it.
      expect({ member, declared: members.has(member) }).toEqual({ member, declared: true });
      expect({ member, parent: members.get(member)?.parent ?? null }).toEqual({ member, parent: null });
    }

    // **And the artefact actually carries descent**, without which every assertion above is
    // trivially true: a reader that answered `parent: null` for everything would make each listed
    // section a root and nothing a descendant of it, so the rule would match only exact sections
    // and no reporter's class (gate-integrity review, 3 Sep 2026). Bakery products, the fixture
    // entity's own activity, four levels under manufacturing.
    const ancestors = (from: string): string[] => {
      const chain: string[] = [];
      let current = members.get(from)?.parent ?? null;
      while (current !== null && chain.length < 8) {
        chain.push(`nace:${current}`);
        current = members.get(`nace:${current}`)?.parent ?? null;
      }
      return chain;
    };
    expect(ancestors('nace:NACE_C1071')).toEqual(['nace:NACE_C107', 'nace:NACE_C10', 'nace:NACE_C']);
  });
});
