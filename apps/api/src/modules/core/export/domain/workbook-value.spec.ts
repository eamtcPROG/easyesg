import { CELL_VALUE_KIND } from '@easyesg/xlsx-patch';
import { isChoiceKind } from '@easyesg/vsme';
import { TEMPLATE_ENCODING, TEMPLATE_PLACEMENT } from '@api/contracts/digital-template-map';
import { admittedMembers } from '@api/modules/core/disclosure/domain/admitted-members';
import { qualifiedDomainOf } from '@api/modules/core/disclosure/domain/qualified-domain';
import {
  TAXONOMY_STANDARD,
  VSME_DIGITAL_TEMPLATE_MAP_CONFIG_KIND,
} from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { readDigitalTemplateMap } from '@api/modules/platform/taxonomy/domain/digital-template-map';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { cellValueOf, isUnlisted } from './workbook-value';

const lists = { ListOfUndertakingsLegalFormsMember: { 'vsme:CooperativeMember': 'cooperative' } };

/** How an answer is spelled in a template cell (task 46.1; NFR-70). */
describe('an answer as a template cell takes it', () => {
  it('writes a number, text and a TRUE/FALSE cell as themselves', () => {
    expect(cellValueOf({ encoding: { as: TEMPLATE_ENCODING.NUMBER }, answer: { number: '12.5' }, lists })).toEqual({
      kind: CELL_VALUE_KIND.NUMBER,
      value: '12.5',
    });
    expect(cellValueOf({ encoding: { as: TEMPLATE_ENCODING.BOOLEAN }, answer: { yes: false }, lists })).toEqual({
      kind: CELL_VALUE_KIND.BOOLEAN,
      value: false,
    });
  });

  it('writes a reporter’s text that opens like a formula as the words they typed (NFR-70; FR-50 AC-9)', () => {
    expect(cellValueOf({ encoding: { as: TEMPLATE_ENCODING.TEXT }, answer: { text: '=HYPERLINK("x")' }, lists })).toEqual({
      kind: CELL_VALUE_KIND.TEXT,
      value: '=HYPERLINK("x")',
    });
  });

  it('writes a yes/no in EFRAG’s own words where its dropdown asks for them', () => {
    const encoding = { as: TEMPLATE_ENCODING.WORDS, true: 'YES', false: 'NO' } as const;
    expect(cellValueOf({ encoding, answer: { yes: true }, lists })).toEqual({ kind: CELL_VALUE_KIND.TEXT, value: 'YES' });
    expect(cellValueOf({ encoding, answer: { yes: false }, lists })).toEqual({ kind: CELL_VALUE_KIND.TEXT, value: 'NO' });
  });

  it('writes a member as EFRAG’s dropdown string, and names one the list does not hold', () => {
    const encoding = { as: TEMPLATE_ENCODING.LIST, list: 'ListOfUndertakingsLegalFormsMember' } as const;
    expect(cellValueOf({ encoding, answer: { member: 'vsme:CooperativeMember' }, lists })).toEqual({
      kind: CELL_VALUE_KIND.TEXT,
      value: 'cooperative',
    });
    expect(cellValueOf({ encoding, answer: { member: 'vsme:NoSuchMember' }, lists })).toEqual({ unlisted: 'vsme:NoSuchMember' });
  });

  it('refuses an answer of one shape under an encoding of another — a defect in the map', () => {
    expect(() => cellValueOf({ encoding: { as: TEMPLATE_ENCODING.NUMBER }, answer: { text: 'twelve' }, lists })).toThrow();
  });
});

/**
 * Task 258: a choice the write admits is one the export can write. Before it, a member outside its domain was stored and
 * a dropdown cell threw on it, failing the whole Excel job on every attempt. Held for every shipped map against the
 * taxonomy version it pairs with: every member the write admits for a field the template answers from one of its own
 * lists has EFRAG's string. A multi-member list (`list`) notes a member the template does not list, by design (task 46),
 * so it is not asked here.
 */
describe('every choice the write admits, a dropdown cell can write (task 258)', () => {
  const entries = readSeedEntries();
  const registry = new TaxonomyRegistryService(seedConfigurationStore(entries));
  const maps = entries
    .filter((entry) => entry.kind === VSME_DIGITAL_TEMPLATE_MAP_CONFIG_KIND)
    .map((entry) => readDigitalTemplateMap(entry.payload));

  it('reads both shipped maps', () => {
    expect(maps.map((map) => map?.templateVersion).sort()).toEqual(['1.2.0', '1.3.0']);
  });

  it.each(maps.map((map) => [map?.templateVersion, map] as const))('%s', (_, map) => {
    if (map === null) throw new Error('a shipped map does not read');
    const version = map.taxonomyVersion;
    const registered = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    if (registered === null) throw new Error(`${version} is registered and does not read`);
    const domains = admittedMembers({
      registered,
      axisOf: (key) => registry.axis({ standard: TAXONOMY_STANDARD.VSME, version, key }),
    });

    const asked = registered.elements.flatMap((element) => {
      const placement = map.elements[element.key];
      const single =
        placement !== undefined &&
        placement.kind !== TEMPLATE_PLACEMENT.LIST &&
        'encoding' in placement &&
        placement.encoding.as === TEMPLATE_ENCODING.LIST;
      return isChoiceKind(element.kind) && single ? [{ element, encoding: placement.encoding }] : [];
    });
    // B1's basis for preparation and for reporting, its two countries, its counting method and kind of headcount, and its
    // legal form: the seven single choices EFRAG's template asks through a dropdown.
    expect(asked).toHaveLength(7);
    for (const { element, encoding } of asked) {
      const members = [...(domains.get(qualifiedDomainOf(element) ?? '') ?? [])];
      expect(members.length).toBeGreaterThan(0);
      const unlisted = members.filter((member) =>
        isUnlisted(cellValueOf({ encoding, answer: { member }, lists: map.lists })),
      );
      expect({ element: element.key, unlisted }).toEqual({ element: element.key, unlisted: [] });
    }
  });
});
