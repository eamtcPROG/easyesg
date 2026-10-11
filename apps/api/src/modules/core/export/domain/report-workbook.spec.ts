import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LABEL_STANDING } from '@easyesg/i18n';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import { CELL_TARGET, CELL_VALUE_KIND, type CellValue } from '@easyesg/xlsx-patch';
import type { DigitalTemplateMap, TemplateCell } from '@api/contracts/digital-template-map';
import { WORKBOOK_NOTE, type WorkbookNote } from '@api/contracts/report-workbook.port';
import { DISCLOSURE_ORIGIN, DISCLOSURE_STATE } from '@api/modules/core/disclosure/models/disclosure-value.model';
import type { DisclosureField } from '@api/modules/core/disclosure/models/wizard-step.model';
import { readDigitalTemplateMap } from '@api/modules/platform/taxonomy/domain/digital-template-map';
import { assembleReportWorkbook, type WorkbookSources } from './report-workbook';

const map = readDigitalTemplateMap(
  JSON.parse(readFileSync(resolve(process.cwd(), '../../config/seed/vsme-digital-template-map.1.3.0.json'), 'utf8')),
) as DigitalTemplateMap;
const named = (name: string, offset: { row?: number; column?: number } = {}): TemplateCell => ({ kind: CELL_TARGET.NAMED, name, ...offset });
const address = (sheet: string, cell: string): TemplateCell => ({ kind: CELL_TARGET.ADDRESS, sheet, cell });
const text = (value: string): CellValue => ({ kind: CELL_VALUE_KIND.TEXT, value });
const number = (value: string): CellValue => ({ kind: CELL_VALUE_KIND.NUMBER, value });
const yes: CellValue = { kind: CELL_VALUE_KIND.BOOLEAN, value: true };

/** A field as the step read serves it, answered — every member the export does not read left at its quiet value. */
const field = (elementKey: string, kind: DisclosureField['kind'], answer: Partial<DisclosureField> = {}): DisclosureField =>
  ({
    elementKey,
    dimensionKey: '',
    ordinal: 0,
    kind,
    origin: DISCLOSURE_ORIGIN.REPORTED,
    state: DISCLOSURE_STATE.OK,
    applicable: true,
    valueNumeric: null,
    valueText: null,
    valueBoolean: null,
    valueDate: null,
    unitCode: null,
    unitCodes: [],
    notAvailableReason: null,
    explanation: null,
    overriddenBy: null,
    options: null,
    ...answer,
  }) as DisclosureField;

const sources = (fields: DisclosureField[], overrides: Partial<WorkbookSources> = {}): WorkbookSources => ({
  report: {
    entityName: 'Brutăria Exportului',
    lei: null,
    idno: '1002600012345',
    reportingCurrency: 'MDL',
    periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
    periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
  },
  fields,
  inputs: [],
  inScope: new Set(fields.map((candidate) => candidate.elementKey)),
  run: null,
  findings: null,
  precision: { units: { tCO2e: 2, MWh: 2 }, elements: { EmployeeTurnoverRate: 2 } },
  labelStanding: LABEL_STANDING.OFFICIAL,
  facts: { locale: 'en', generatedAt: new Date('2026-10-11T09:00:00Z'), generatedBy: 'Ana Popescu' },
  ...overrides,
});

const writtenAt = (workbook: ReturnType<typeof assembleReportWorkbook>, at: TemplateCell): CellValue | undefined =>
  workbook.writes.find((write) => JSON.stringify(write.at) === JSON.stringify(at))?.value;
const notesOn = (workbook: ReturnType<typeof assembleReportWorkbook>, element: string): WorkbookNote['says'][] =>
  workbook.notes.filter((note) => note.element === element).map((note) => note.says);

/** What the EFRAG template is given for a report (task 46; FR-50; §12.5.6's task-46 row) — one rule a case. */
describe('the report as the Digital Template takes it', () => {
  describe('its own block', () => {
    it('sets the language cell to EFRAG’s English, whatever the export’s language (182/31; FR-50 AC-11)', () => {
      const workbook = assembleReportWorkbook(sources([], { facts: { locale: 'ru', generatedAt: new Date(), generatedBy: null } }), map);
      expect(writtenAt(workbook, named('template_selected_display_language'))).toEqual(text('English - Official [en]'));
    });

    it('writes the LEI under EFRAG’s LEI scheme where the entity has one (FR-50 AC-5)', () => {
      const workbook = assembleReportWorkbook(sources([], { report: { ...sources([]).report, lei: '5299001ABCDEFGH12345' } }), map);
      expect(writtenAt(workbook, named('template_reporting_entity_identifier_scheme'))).toEqual(text('LEI'));
      expect(writtenAt(workbook, named('template_reporting_entity_identifier'))).toEqual(text('5299001ABCDEFGH12345'));
    });

    it('writes the IDNO with the scheme left blank, EFRAG having no scheme for it (task-46 row (5))', () => {
      const workbook = assembleReportWorkbook(sources([]), map);
      expect(writtenAt(workbook, named('template_reporting_entity_identifier'))).toEqual(text('1002600012345'));
      expect(writtenAt(workbook, named('template_reporting_entity_identifier_scheme'))).toBeUndefined();
    });

    it('writes the entity, the currency and the period as the template’s day fields', () => {
      const workbook = assembleReportWorkbook(sources([]), map);
      expect(writtenAt(workbook, named('template_reporting_entity_name'))).toEqual(text('Brutăria Exportului'));
      expect(writtenAt(workbook, named('template_currency'))).toEqual(text('MDL'));
      expect(['D6', 'D7', 'D8', 'D10', 'D11', 'D12'].map((cell) => writtenAt(workbook, address('General Information', cell)))).toEqual(
        ['2026', '1', '1', '2026', '12', '31'].map(number),
      );
    });
  });

  describe('its figures', () => {
    it('rounds a reporter’s figure once, half-up, at its unit’s places, as the PDF does (FR-50 behaviour 9)', () => {
      const energy = field('TotalEnergyConsumption', DISCLOSURE_KIND.NUMERIC, { valueNumeric: '256.385', unitCode: 'MWh' });
      expect(writtenAt(assembleReportWorkbook(sources([energy]), map), named('TotalEnergyConsumption'))).toEqual(number('256.39'));
    });

    it('writes a calculated figure exact — EFRAG’s own format shows it at the PDF’s digits — and notes it at them (task-46 row (10))', () => {
      const scope = field('GrossScope1GreenhouseGasEmissions', DISCLOSURE_KIND.NUMERIC, {
        valueNumeric: '0.9699123256',
        unitCodes: ['tCO2e'],
        origin: DISCLOSURE_ORIGIN.CALCULATED,
      });
      const temporary = field('NumberOfTemporaryContractEmployees', DISCLOSURE_KIND.NUMERIC, { valueNumeric: '6' });
      const run = { factorSet: '2026.1', results: new Map([['GrossScope1GreenhouseGasEmissions', '0.9699123256']]) };
      const workbook = assembleReportWorkbook(sources([scope, temporary], { run }), map);
      expect(writtenAt(workbook, named('GrossScope1GreenhouseGasEmissions'))).toEqual(number('0.9699123256'));
      expect(notesOn(workbook, 'GrossScope1GreenhouseGasEmissions')).toEqual([{ kind: WORKBOOK_NOTE.FACTOR_SET, label: '2026.1' }]);
      expect(notesOn(workbook, 'NumberOfTemporaryContractEmployees')).toEqual([
        { kind: WORKBOOK_NOTE.OWN_FIGURE, figure: { value: '6', places: null, unit: null } },
      ]);
    });

    it('writes a nil return as a stated zero (FR-30; FR-50 AC-7)', () => {
      const fatalities = field('NumberOfFatalitiesAsAResultOfWorkRelatedInjuriesAndWorkRelatedIllHealth', DISCLOSURE_KIND.NUMERIC, {
        state: DISCLOSURE_STATE.NIL_RETURN,
      });
      const workbook = assembleReportWorkbook(sources([fatalities]), map);
      expect(writtenAt(workbook, named('NumberOfFatalitiesAsAResultOfWorkRelatedInjuriesAndWorkRelatedIllHealth'))).toEqual(number('0'));
    });

    it('writes nothing for a field not available, and notes its reason on its cell (FR-44 behaviour 6; 182/30)', () => {
      const energy = field('TotalEnergyConsumption', DISCLOSURE_KIND.NUMERIC, {
        state: DISCLOSURE_STATE.NOT_AVAILABLE,
        notAvailableReason: 'Shared meter with the landlord',
      });
      const workbook = assembleReportWorkbook(sources([energy]), map);
      expect(writtenAt(workbook, named('TotalEnergyConsumption'))).toBeUndefined();
      expect(workbook.notes).toEqual([
        {
          element: 'TotalEnergyConsumption',
          dimension: '',
          at: named('TotalEnergyConsumption'),
          says: { kind: WORKBOOK_NOTE.NOT_AVAILABLE, reason: 'Shared meter with the landlord' },
        },
      ]);
    });

    it('writes a company estimate and notes it — the figure it replaced, why, who — with the factor set (FR-36; 46.5)', () => {
      const scope = field('GrossScope1GreenhouseGasEmissions', DISCLOSURE_KIND.NUMERIC, {
        valueNumeric: '1.75',
        unitCode: 'tCO2e',
        origin: DISCLOSURE_ORIGIN.OVERRIDDEN,
        explanation: 'The supplier reissued the fuel statements',
        overriddenBy: { name: 'Ana Popescu' } as DisclosureField['overriddenBy'],
      });
      const run = { factorSet: 'Emission factor set 2026.1', results: new Map([['GrossScope1GreenhouseGasEmissions', '0.9699123256']]) };
      const workbook = assembleReportWorkbook(sources([scope], { run }), map);
      expect(writtenAt(workbook, named('GrossScope1GreenhouseGasEmissions'))).toEqual(number('1.75'));
      expect(notesOn(workbook, 'GrossScope1GreenhouseGasEmissions')).toEqual([
        {
          kind: WORKBOOK_NOTE.OVERRIDE,
          figure: { value: '1.75', places: 2, unit: 'tCO2e' },
          superseded: '0.9699123256',
          reason: 'The supplier reissued the fuel statements',
          person: 'Ana Popescu',
        },
        { kind: WORKBOOK_NOTE.FACTOR_SET, label: 'Emission factor set 2026.1' },
      ]);
    });

    it('writes a carried value exactly as the same value typed in — the mark is the platform’s, not a disclosure (FR-47 AC-4)', () => {
      const typed = field('Assets', DISCLOSURE_KIND.MONETARY, { valueNumeric: '800000' });
      const carried = { ...typed, carriedForward: true } as DisclosureField;
      expect(assembleReportWorkbook(sources([carried]), map)).toEqual(assembleReportWorkbook(sources([typed]), map));
    });

    it('writes a reporter’s text that opens like a formula as text (NFR-70; FR-50 AC-9)', () => {
      const labels = field('DescriptionOfSustainabilityRelatedCertificationsOrLabels', DISCLOSURE_KIND.TEXT_BLOCK, { valueText: '=SUM(A1:A9)' });
      expect(writtenAt(assembleReportWorkbook(sources([labels]), map), named('DescriptionOfSustainabilityRelatedCertificationsOrLabels'))).toEqual(
        text('=SUM(A1:A9)'),
      );
    });
  });

  describe('figures the template computes (182/32; task-46 row (3))', () => {
    it('writes the inputs of a figure the platform derives the same way, and nothing over the formula — B8’s turnover rate', () => {
      const rate = field('EmployeeTurnoverRate', DISCLOSURE_KIND.PERCENT, { valueNumeric: '0.1', origin: DISCLOSURE_ORIGIN.CALCULATED });
      const inputs = [
        { key: 'NumberOfEmployeesWhoLeftDuringTheReportingPeriod', derives: 'EmployeeTurnoverRate', value: '3', offered: null },
        { key: 'NumberOfEmployeesAtTheBeginningOfTheReportingPeriod', derives: 'EmployeeTurnoverRate', value: '40', offered: null },
        { key: 'NumberOfEmployeesAtTheEndOfTheReportingPeriod', derives: 'EmployeeTurnoverRate', value: '20', offered: null },
        // An offer the reporter never stored is not filed (task 36.10).
        { key: 'HoursWorkedByOneFullTimeEmployee', derives: 'RateOfRecordableWorkRelatedAccidentsInTheReportingPeriod', value: null, offered: '2000' },
      ];
      const workbook = assembleReportWorkbook(sources([rate], { inputs }), map);
      expect(['D134', 'D135', 'D136', 'D141'].map((cell) => writtenAt(workbook, address('Social Disclosures', cell)))).toEqual([
        number('3'),
        number('40'),
        number('20'),
        undefined,
      ]);
      expect(writtenAt(workbook, named('EmployeeTurnoverRate'))).toBeUndefined();
      expect(workbook.notes).toEqual([]);
    });

    it('writes no input of a figure the standard does not ask — B10’s pay gap below 150 employees (FR-28; NFR-18)', () => {
      const gap = field('PercentageGapInPayBetweenFemaleAndMaleEmployees', DISCLOSURE_KIND.PERCENT, {
        valueNumeric: '0.05',
        derived: true,
        applicable: false,
      });
      const inputs = [
        { key: 'AverageGrossHourlyPayLevelOfMaleEmployees', derives: 'PercentageGapInPayBetweenFemaleAndMaleEmployees', value: '60', offered: null },
        { key: 'AverageGrossHourlyPayLevelOfFemaleEmployees', derives: 'PercentageGapInPayBetweenFemaleAndMaleEmployees', value: '57', offered: null },
      ];
      const workbook = assembleReportWorkbook(sources([gap], { inputs }), map);
      expect(['D148', 'D149'].map((cell) => writtenAt(workbook, address('Social Disclosures', cell)))).toEqual([undefined, undefined]);
      const applies = assembleReportWorkbook(sources([{ ...gap, applicable: true }], { inputs }), map);
      expect(['D148', 'D149'].map((cell) => writtenAt(applies, address('Social Disclosures', cell)))).toEqual([number('60'), number('57')]);
    });

    it('notes the undertaking’s own figure for one the template computes from other cells — temporary contracts', () => {
      const temporary = field('NumberOfTemporaryContractEmployees', DISCLOSURE_KIND.NUMERIC, { valueNumeric: '5' });
      const workbook = assembleReportWorkbook(sources([temporary]), map);
      expect(writtenAt(workbook, named('NumberOfTemporaryContractEmployees'))).toBeUndefined();
      expect(notesOn(workbook, 'NumberOfTemporaryContractEmployees')).toEqual([
        { kind: WORKBOOK_NOTE.OWN_FIGURE, figure: { value: '5', places: null, unit: null } },
      ]);
    });

    it('notes fuel energy, which the template computes only through its own Fuel Converter, on the member’s cell', () => {
      const fuels = field('EnergyConsumptionFromFuels', DISCLOSURE_KIND.NUMERIC, { dimensionKey: 'RenewableEnergyMember', valueNumeric: '12.5', unitCode: 'MWh' });
      const workbook = assembleReportWorkbook(sources([fuels]), map);
      expect(workbook.notes.map((note) => [note.at, note.dimension, note.says.kind])).toEqual([
        [named('EnergyConsumptionFromFuels_RenewableEnergyMember'), 'RenewableEnergyMember', WORKBOOK_NOTE.OWN_FIGURE],
      ]);
    });
  });

  describe('units (task-46 row (6))', () => {
    it('writes B4’s three emissions in one unit, converting the one stored in tonnes exactly and noting it', () => {
      const air = field('AmountOfEmissionToAir', DISCLOSURE_KIND.NUMERIC, { dimensionKey: 'AmmoniaNH3Member', valueNumeric: '1.25', unitCode: 't' });
      const water = field('AmountOfEmissionToWater', DISCLOSURE_KIND.NUMERIC, { dimensionKey: 'AmmoniaNH3Member', valueNumeric: '300', unitCode: 'kg' });
      const workbook = assembleReportWorkbook(sources([air, water]), map);
      expect(writtenAt(workbook, named('AmountOfEmissionToAir_unit'))).toEqual(text('kilograms (kg)'));
      expect(writtenAt(workbook, named('TypeOfPollutantAxis', { row: 0 }))).toEqual(text('Ammonia (NH3)'));
      expect(writtenAt(workbook, named('AmountOfEmissionToAir', { row: 0 }))).toEqual(number('1250'));
      expect(writtenAt(workbook, named('AmountOfEmissionToWater', { row: 0 }))).toEqual(number('300'));
      expect(notesOn(workbook, 'AmountOfEmissionToAir')).toEqual([
        { kind: WORKBOOK_NOTE.CONVERTED, figure: { value: '1.25', places: null, unit: 't' }, written: 'kg' },
      ]);
    });

    it('writes B5’s square kilometres, which its cells do not offer, as hectares', () => {
      const sealed = field('TotalSealedArea', DISCLOSURE_KIND.NUMERIC, { valueNumeric: '0.5', unitCode: 'sqkm' });
      const workbook = assembleReportWorkbook(sources([sealed]), map);
      expect(writtenAt(workbook, named('TotalNatureOrientedAreaOffSite_unit'))).toEqual(text('hectares (ha)'));
      expect(writtenAt(workbook, named('TotalSealedArea'))).toEqual(number('50'));
    });

    it('writes a waste type’s mass in its row and states its volume beside it, the row having one unit (task-46 row (3))', () => {
      const waste = 'W-010101-Non-Hazardous-WastesFromMineralMetalliferousExcavationMember';
      const mass = field('WasteDivertedToRecycleOrReuseMass', DISCLOSURE_KIND.NUMERIC, { dimensionKey: waste, valueNumeric: '40', unitCode: 'kg' });
      const disposed = field('WasteDirectedToDisposalMass', DISCLOSURE_KIND.NUMERIC, { dimensionKey: waste, valueNumeric: '10', unitCode: 'kg' });
      const volume = field('WasteDivertedToRecycleOrReuseVolume', DISCLOSURE_KIND.NUMERIC, { dimensionKey: waste, valueNumeric: '2', unitCode: 'm3' });
      const workbook = assembleReportWorkbook(sources([mass, disposed, volume]), map);
      expect(writtenAt(workbook, named('WasteDirectedToDisposalMass_unit', { row: 0 }))).toEqual(text('kilograms (kg)'));
      expect(writtenAt(workbook, named('WasteDivertedToRecycleOrReuseMass', { row: 0 }))).toEqual(number('40'));
      expect(writtenAt(workbook, named('WasteDirectedToDisposalMass', { row: 0 }))).toEqual(number('10'));
      expect(notesOn(workbook, 'WasteDivertedToRecycleOrReuseVolume')).toEqual([
        { kind: WORKBOOK_NOTE.ALSO, figure: { value: '2', places: null, unit: 'm3' } },
      ]);
    });
  });

  describe('lists, sets and omissions', () => {
    it('writes each NACE code on its own row, as EFRAG’s dropdown spells it', () => {
      const nace = field('NaceSectorClassificationCodes', DISCLOSURE_KIND.ENUMERATION_SET, { valueText: 'nace:NACE_C1071 nace:NACE_G4722' });
      const workbook = assembleReportWorkbook(sources([nace]), map);
      expect(writtenAt(workbook, named('NaceSectorClassificationCodes', { row: 0 }))).toEqual(
        text('NACE C - 10.71 Manufacture of bread; manufacture of fresh pastry goods and cakes'),
      );
      expect(writtenAt(workbook, named('NaceSectorClassificationCodes', { row: 1 }))).toEqual(text('NACE G - 47.22 Retail sale of meat and meat products'));
    });

    it('notes the unchanged sections EFRAG’s list has no entry for, by their names, and writes the modules it has', () => {
      const unchanged = field('ListOfDisclosuresForWhichNoChangesAreReportedComparedToThePreviousPeriodReporting', DISCLOSURE_KIND.ENUMERATION_SET, {
        valueText: 'vsme:B4-PollutionOfAirWaterAndSoilMember vsme:B1ListOfSiteSMember',
        options: [{ value: 'vsme:B1ListOfSiteSMember', label: 'B1 - List of site(s)', code: null, hazardous: null }],
      });
      const workbook = assembleReportWorkbook(sources([unchanged]), map);
      expect(writtenAt(workbook, named('ListOfDisclosuresForWhichNoChangesAreReportedComparedToThePreviousPeriodReporting', { row: 0 }))).toEqual(
        text('B4 - Pollution of air, water and soil'),
      );
      expect(notesOn(workbook, 'ListOfDisclosuresForWhichNoChangesAreReportedComparedToThePreviousPeriodReporting')).toEqual([
        { kind: WORKBOOK_NOTE.NOT_LISTED, members: ['B1 - List of site(s)'] },
      ]);
    });

    it('ticks B2’s issues in their own columns and answers the template’s question above them (task-46 row (1))', () => {
      const issues = field('SustainabilityIssueAddressedByPracticePolicyAndOrFutureInitiative', DISCLOSURE_KIND.ENUMERATION_SET, {
        valueText: 'vsme:ClimateChangeMember vsme:CircularEconomyMember',
      });
      const workbook = assembleReportWorkbook(sources([issues]), map);
      expect(writtenAt(workbook, named('SustainabilityIssueAddressedByPracticePolicyAndOrFutureInitiative', { column: 0 }))).toEqual(yes);
      expect(writtenAt(workbook, named('SustainabilityIssueAddressedByPracticePolicyAndOrFutureInitiative', { column: 4 }))).toEqual(yes);
      expect(writtenAt(workbook, address('General Information', 'C512'))).toEqual(yes);
    });

    it('answers each of the template’s own questions as its group says — held, affirmed, or more than one', () => {
      const certification = field('DescriptionOfSustainabilityRelatedCertificationsOrLabels', DISCLOSURE_KIND.TEXT_BLOCK, { valueText: 'EU Ecolabel' });
      const site = (ordinal: number, inside: boolean) =>
        field('SiteLocatedInABiodiversitySensitiveArea', DISCLOSURE_KIND.BOOLEAN, { ordinal, valueBoolean: inside });
      const convictions = field('TotalNumberOfConvictionsForTheViolationOfAntiCorruptionAndAntiBriberyLaws', DISCLOSURE_KIND.NUMERIC, {
        state: DISCLOSURE_STATE.NIL_RETURN,
      });
      const employees = (country: string, count: string) =>
        field('NumberOfEmployeesForCountryOfEmploymentContract', DISCLOSURE_KIND.NUMERIC, { dimensionKey: country, valueNumeric: count });

      const outside = assembleReportWorkbook(sources([certification, site(0, false), site(1, false), convictions, employees('MD', '50')]), map);
      expect(writtenAt(outside, address('General Information', 'E396'))).toEqual(yes);
      expect(writtenAt(outside, address('Environmental Disclosures', 'G184'))).toBeUndefined();
      expect(writtenAt(outside, address('Governance Disclosures', 'H5'))).toBeUndefined();
      expect(writtenAt(outside, address('Social Disclosures', 'E27'))).toBeUndefined();

      const inside = assembleReportWorkbook(sources([site(0, false), site(1, true), employees('MD', '40'), employees('RO', '10')]), map);
      expect(writtenAt(inside, address('Environmental Disclosures', 'G184'))).toEqual(yes);
      expect(writtenAt(inside, address('Social Disclosures', 'E27'))).toEqual(yes);
      expect(writtenAt(inside, address('General Information', 'E396'))).toBeUndefined();
    });

    it('declares a module omitted through every ToC checkbox its sections have (FR-31; FR-50 AC-8)', () => {
      const omitted = field('ListOfOmittedDisclosuresDeemedToBeClassifiedOrSensitiveInformation', DISCLOSURE_KIND.ENUMERATION_SET, {
        valueText: 'vsme:B5-BiodiversityMember',
      });
      const workbook = assembleReportWorkbook(sources([omitted]), map);
      const toc = (cell: string) => writtenAt(workbook, address('Table of Contents & Validation', cell));
      expect([toc('D27'), toc('D28'), toc('D26'), toc('D30')]).toEqual([yes, yes, undefined, undefined]);
    });
  });

  describe('marks and statements', () => {
    it('notes an unresolved finding on its field, by its message, answered or not (FR-44; 182/30)', () => {
      const assets = field('Assets', DISCLOSURE_KIND.MONETARY);
      const finding = {
        rule: 'b1-assets',
        verdict: 'missing',
        field: { elementKey: 'Assets', dimensionKey: '', ordinal: 0 },
        related: [],
        message: 'validation.missing',
        params: {},
      } as const;
      const workbook = assembleReportWorkbook(sources([assets], { findings: [finding] }), map);
      expect(workbook.notes).toEqual([
        { element: 'Assets', dimension: '', at: named('Assets'), says: { kind: WORKBOOK_NOTE.FINDING, message: 'validation.missing', params: {} } },
      ]);
    });

    it('states, in a language whose labels are the platform’s, that its wording has no EFRAG standing — on B1’s basis (46.3)', () => {
      const workbook = assembleReportWorkbook(sources([], { labelStanding: LABEL_STANDING.PLATFORM_AUTHORED }), map);
      expect(workbook.notes).toEqual([
        { element: 'BasisForPreparation', dimension: '', at: named('BasisForPreparation'), says: { kind: WORKBOOK_NOTE.LABELS } },
      ]);
      expect(assembleReportWorkbook(sources([]), map).notes).toEqual([]);
    });

    it('writes nothing of a section the report withholds — its checkbox says so instead', () => {
      const site = field('AddressOfSite', DISCLOSURE_KIND.TEXT, { valueText: 'Strada Ismail 1' });
      const workbook = assembleReportWorkbook(sources([site], { inScope: new Set() }), map);
      expect(writtenAt(workbook, named('AddressOfSite', { row: 0 }))).toBeUndefined();
    });
  });

  describe('what it refuses', () => {
    it('an answered disclosure the template map places nowhere — a Comprehensive one, task 80.3’s', () => {
      const c1 = field('DescriptionOfSignificantGroupsOfProductsAndOrServicesOffered', DISCLOSURE_KIND.TEXT_BLOCK, { valueText: 'Bread' });
      expect(() => assembleReportWorkbook(sources([c1]), map)).toThrow(/places no DescriptionOfSignificantGroupsOfProductsAndOrServicesOffered/u);
    });

    it('a single choice EFRAG’s list has no string for', () => {
      const form = field('UndertakingsLegalForm', DISCLOSURE_KIND.ENUMERATION, { valueText: 'vsme:NoSuchFormMember' });
      expect(() => assembleReportWorkbook(sources([form]), map)).toThrow(/holds no string for vsme:NoSuchFormMember/u);
    });
  });
});
