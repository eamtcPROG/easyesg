import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CELL_TARGET } from '@easyesg/xlsx-patch';
import { TEMPLATE_PLACEMENT } from '@api/contracts/digital-template-map';
import { committedTemplate } from '../services/committed-template';
import { digitalTemplateMapShapeRefusal, readDigitalTemplateMap } from './digital-template-map';
import { digitalTemplateMapRefusal, writableTargetsOf } from './digital-template-map-refusal';

const EFRAG = resolve(process.cwd(), '../../config/efrag');
const shipped = (version: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(process.cwd(), `../../config/seed/vsme-digital-template-map.${version}.json`), 'utf8')) as Record<
    string,
    unknown
  >;
const binaryOf = (map: { templateVersion: string; template: { file: string; sha256: string } }) =>
  committedTemplate({ directory: EFRAG, ...map });

/** The shipped map with one element's placement replaced — how each refusal below is reached on purpose. */
const withElement = (key: string, placement: unknown): Record<string, unknown> => {
  const map = shipped('1.3.0');
  return { ...map, elements: { ...(map.elements as Record<string, unknown>), [key]: placement } };
};

/**
 * The map's reader and its publication check (task 46.1; `architecture.md` §12.5.6's task-46 row (1)): read whole or
 * not at all, every reference inside it resolving, and every cell it says the export writes one the template lets it
 * write — by the package's own refusals, over the binary the map was read from.
 */
describe('the Digital Template map', () => {
  it.each(['1.2.0', '1.3.0'])('reads the shipped %s map, its cells the package’s own targets', (version) => {
    const map = readDigitalTemplateMap(shipped(version));
    expect(map?.templateVersion).toBe(version);
    expect(map?.language.at).toEqual({ kind: CELL_TARGET.NAMED, name: 'template_selected_display_language' });
    expect(map?.report.periodStart.year).toEqual({ kind: CELL_TARGET.ADDRESS, sheet: 'General Information', cell: 'D6' });
    expect(map?.elements.Assets).toEqual({
      kind: TEMPLATE_PLACEMENT.CELL,
      at: { kind: CELL_TARGET.NAMED, name: 'Assets' },
      encoding: { as: 'number' },
      unit: null,
    });
  });

  it('answers null, and refuses with a reason, for a map whose references name nothing', () => {
    const unknownList = withElement('Assets', { kind: 'cell', at: { name: 'Assets' }, encoding: { as: 'list', list: 'no-such-list' }, unit: null });
    const unknownTable = withElement('AddressOfSite', { kind: 'rows', group: 'NoSuchAxis', at: { name: 'AddressOfSite' }, encoding: { as: 'text' }, unit: null });
    const memberWithoutCell = withElement('EnergyConsumptionFromFuels', {
      kind: 'members',
      cells: {},
      computed: ['RenewableEnergyMember'],
      derived: false,
      encoding: { as: 'number' },
    });
    const notAnAddress = withElement('Assets', { kind: 'cell', at: { sheet: 'General Information', cell: 'E 282' }, encoding: { as: 'number' }, unit: null });
    const noSuchKind = withElement('Assets', { kind: 'somewhere' });
    const gate = { at: { sheet: 'General Information', cell: 'E396' }, when: ['DescriptionOfSustainabilityRelatedCertificationsOrLabels'] };
    const unansweredGate = { ...shipped('1.3.0'), gates: [gate] };
    const gateOnNothing = { ...shipped('1.3.0'), gates: [{ ...gate, when: ['NoSuchElement'], answer: 'held' }] };
    for (const payload of [unknownList, unknownTable, memberWithoutCell, notAnAddress, noSuchKind, unansweredGate, gateOnNothing, null, 'a map', []]) {
      expect(readDigitalTemplateMap(payload)).toBeNull();
      expect(digitalTemplateMapShapeRefusal(payload)).toEqual(expect.stringContaining('read whole'));
    }
    expect(digitalTemplateMapShapeRefusal(unknownList)).toContain('no-such-list');
    expect(digitalTemplateMapShapeRefusal(gateOnNothing)).toContain('NoSuchElement');
  });

  describe('its publication check', () => {
    it.each(['1.2.0', '1.3.0'])('admits the shipped %s map against the binary it was read from', (version) => {
      expect(digitalTemplateMapRefusal({ payload: shipped(version), binaryOf })).toBeNull();
    });

    it('refuses a map that names a cell the template computes — B8’s turnover rate, as if it were an input (182/32)', () => {
      const payload = withElement('Assets', { kind: 'cell', at: { name: 'EmployeeTurnoverRate' }, encoding: { as: 'number' }, unit: null });
      expect(readDigitalTemplateMap(payload)).not.toBeNull();
      expect(digitalTemplateMapRefusal({ payload, binaryOf })).toMatch(/a cell the export may not write: .*formula/u);
    });

    it('refuses a map that names a name EFRAG ships broken, or none at all', () => {
      const broken = withElement('Assets', { kind: 'cell', at: { name: 'enum_ListNACECode' }, encoding: { as: 'number' }, unit: null });
      const missing = withElement('Assets', { kind: 'cell', at: { name: 'NoSuchElement' }, encoding: { as: 'number' }, unit: null });
      expect(digitalTemplateMapRefusal({ payload: broken, binaryOf })).toContain('a cell the export may not write');
      expect(digitalTemplateMapRefusal({ payload: missing, binaryOf })).toContain('no name NoSuchElement');
    });

    it('refuses a map read from a binary the release does not hold', () => {
      const payload = { ...shipped('1.3.0'), template: { file: 'VSME-Digital-Template-1.3.0.xlsx', sha256: '0'.repeat(64) } };
      expect(digitalTemplateMapRefusal({ payload, binaryOf })).toContain('which this release does not hold');
    });

    it('checks a table at its first row, a set’s every column and a breakdown’s written members only', () => {
      const map = readDigitalTemplateMap(shipped('1.3.0'));
      if (map === null) throw new Error('the shipped map does not read');
      const targets = writableTargetsOf(map).map((cell) => JSON.stringify(cell));
      expect(targets).toContain(JSON.stringify({ kind: CELL_TARGET.NAMED, name: 'AddressOfSite' }));
      expect(targets).toContain(
        JSON.stringify({ kind: CELL_TARGET.NAMED, name: 'SustainabilityIssueAddressedByPracticePolicyAndOrFutureInitiative', column: 9 }),
      );
      expect(targets).not.toContain(JSON.stringify({ kind: CELL_TARGET.NAMED, name: 'EnergyConsumptionFromFuels_RenewableEnergyMember' }));
      expect(new Set(targets).size).toBe(targets.length);
    });
  });
});
