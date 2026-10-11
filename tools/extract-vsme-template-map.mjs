/**
 * Turns a registered EFRAG Digital Template into the map the Excel export writes through (task 46.1;
 * `architecture.md` §12.5.6's task-46 row (1)).
 *
 *     node tools/extract-vsme-template-map.mjs <template-version>
 *
 * It writes `config/seed/vsme-digital-template-map.<template-version>.json`, the `vsme_digital_template_map`
 * artefact for that version, from four things the repository already holds: the binary under `config/efrag/`, its
 * registration (which taxonomy it is written against), that taxonomy's artefacts in `config/seed/` and its English
 * labels in `packages/i18n`. **Regenerate, never hand-edit**: a release of the template is a new run of this script.
 *
 * ## What the workbook says and what this script has to be told
 *
 * EFRAG names each element's cells after the element (`Assets`), a breakdown's after the element and its member
 * (`EnergyConsumptionFromFuels_RenewableEnergyMember`), a unit's with `_unit`, and a table's key column after its axis
 * (`TypeOfPollutantAxis`). Its dropdowns are data validations naming ranges of its *Enumeration Lists* sheet, which
 * hold the English strings a cell takes once the language cell reads English (182/31). Its computed figures are
 * formulas. All of that is read here, and none of it is restated.
 *
 * **What the workbook does not name is the `AUTHORED` table below**, and each entry is checked against the workbook
 * rather than trusted: a derivation input's cell is found by EFRAG's own label id in the row; a gate's by its label id;
 * a member whose English label is not EFRAG's dropdown string carries the string it maps to, and that string must be
 * one the dropdown holds.
 *
 * ## It asserts rather than defaults
 *
 * Every Basic Module element, and the four *any other* disclosures, must get a placement; every member of every
 * classification the export writes must find exactly one string in EFRAG's list; every cell a placement names must be
 * one the template does not compute — proven by patching every target through `@easyesg/xlsx-patch` itself, whose
 * refusals are the definition of a cell the export may not write. A run that cannot say where a value goes fails,
 * because a guessed cell is a figure filed in the wrong place with nothing to say so.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CELL_TARGET, CELL_VALUE_KIND, patchWorkbook, readPart } from '../packages/xlsx-patch/dist/esm/index.js';

const [, , templateVersion] = process.argv;
if (!templateVersion || !/^\d+\.\d+\.\d+$/.test(templateVersion)) {
  console.error('usage: extract-vsme-template-map.mjs <template-version>   e.g. 1.3.0');
  process.exit(2);
}

const ROOT = resolve(import.meta.dirname, '..');
const json = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const fail = (message) => {
  console.error(`extract-vsme-template-map ${templateVersion}: ${message}`);
  process.exit(1);
};

const registration = json(`config/seed/vsme-digital-template.${templateVersion}.json`);
const taxonomyVersion = registration.taxonomyVersion;
const template = new Uint8Array(readFileSync(join(ROOT, 'config/efrag', templateVersion, registration.file)));
const taxonomy = json(`config/seed/vsme-taxonomy.${taxonomyVersion}.json`);
const naceClassification = json(`config/seed/vsme-nace-classification.${taxonomyVersion}.json`);
const wasteClassification = json(`config/seed/vsme-waste-classification.${taxonomyVersion}.json`);
const derivations = json('config/seed/disclosure-derivation.vsme.json').derivations;
const elementLabels = json(`packages/i18n/catalogues/disclosure/${taxonomyVersion}/en.json`);
const memberLabels = json(`packages/i18n/catalogues/disclosure/${taxonomyVersion}/members/en.json`);

/**
 * What the workbook does not name. Keyed by nothing version-specific: EFRAG's label ids and its English strings are
 * stable across `1.2.0` and `1.3.0`, and a release that changes one fails the run on the check beside each.
 */
const AUTHORED = {
  /** A derivation input (task 36.10) is a row EFRAG labels and does not name; its value is column D of that row. */
  inputs: {
    NumberOfEmployeesWhoLeftDuringTheReportingPeriod: 'template_label_number_of_employees_who_left_during_the_reporting_period',
    NumberOfEmployeesAtTheBeginningOfTheReportingPeriod: 'template_label_number_of_employees_at_the_beginning_of_the_reporting_period',
    NumberOfEmployeesAtTheEndOfTheReportingPeriod: 'template_label_number_of_employees_at_the_end_of_the_reporting_period',
    HoursWorkedByOneFullTimeEmployee: 'template_label_number_of_hours_worked_by_one_fulltime_employee_in_the_reporting_period',
    AverageGrossHourlyPayLevelOfMaleEmployees: 'template_label_average_gross_hourly_pay_level_of_male_employees',
    AverageGrossHourlyPayLevelOfFemaleEmployees: 'template_label_average_gross_hourly_pay_level_of_female_employees',
    NumberOfEmployeesCoveredByCollectiveBargainingAgreements: 'template_label_number_of_employees_covered_by_collective_bargaining_agreements',
  },
  /**
   * A yes/no the template asks before a group of disclosures and the taxonomy has no element for — every one the Basic
   * Module's sheets ask, the Comprehensive Module's being task 80.3's and *previous period unchanged* having nothing to
   * answer it (182/33). The value is the row's yes/no cell, right of the label, and **how the group answers it is the
   * question's**: `held` where holding any of the group's values is the answer, `affirmed` where only a yes or a figure
   * above zero is, and `several` where it asks about more than one member. Otherwise EFRAG's own answer stands. Left
   * alone on purpose: B1's consent to an OpenStreetMap lookup, which is the reader's to give.
   */
  gates: [
    {
      label: 'template_label_has_the_undertaking_obtained_any_sustainability_related_certification_or_label',
      when: ['DescriptionOfSustainabilityRelatedCertificationsOrLabels'],
      answer: 'held',
    },
    {
      label: 'template_label_has_the_undertaking_obtained_the_necessary_information_to_provide_an_energy_consumption_breakdown',
      when: ['EnergyConsumptionFromElectricity', 'EnergyConsumptionFromSelfGeneratedElectricity', 'EnergyConsumptionFromFuels'],
      answer: 'held',
    },
    {
      label: 'template_label_is_the_undertaking_disclosing_entity_specific_information_on_scope_3_emissions',
      when: ['GrossScope3GreenhouseGasEmissions'],
      answer: 'held',
    },
    {
      label: 'template_label_required_by_law_or_other_national_regulations_to_report_to_competent_authorities_its_emissions_of_pollutants',
      when: ['AmountOfEmissionToAir', 'AmountOfEmissionToWater', 'AmountOfEmissionToSoil'],
      answer: 'held',
    },
    {
      label: 'template_label_does_the_undertaking_have_sites_that_are_located_in_or_near_biodiversity_sensitive_areas',
      when: ['AreaOfSiteInBiodiversitySensitiveArea', 'SiteLocatedInABiodiversitySensitiveArea', 'SiteLocatedNearABiodiversitySensitiveArea'],
      answer: 'affirmed',
    },
    {
      label: 'template_label_does_the_undertaking_have_production_processes_in_place_which_significantly_consume_water',
      when: ['WaterDischargeFromUndertakingProductionProcesses'],
      answer: 'held',
    },
    {
      label: 'template_label_does_the_undertaking_operate_in_a_sector_using_significant_material_flows',
      when: ['NameOfMaterialUsed', 'WeightOfMaterialUsed', 'VolumeOfMaterialUsed'],
      answer: 'held',
    },
    {
      label: 'template_label_undertaking_operating_in_more_than_one_country',
      when: ['NumberOfEmployeesForCountryOfEmploymentContract'],
      answer: 'several',
    },
    {
      label: 'template_label_has_the_undertaking_incurred_in_convictions_and_fines_in_the_reporting_period',
      when: ['TotalNumberOfConvictionsForTheViolationOfAntiCorruptionAndAntiBriberyLaws', 'TotalAmountOfFinesForTheViolationOfAnticorruptionAndAntibriberyLaws'],
      answer: 'affirmed',
    },
  ],
  /**
   * B2's question — *has the undertaking put in place practices, policies or future initiatives* — is the yes/no left
   * of the set its answers fill, in both releases, and is answered yes when any of B2's three elements is.
   */
  setGates: {
    SustainabilityIssueAddressedByPracticePolicyAndOrFutureInitiative: [
      'SustainabilityIssueAddressedByPracticePolicyAndOrFutureInitiative',
      'PracticePolicyAndOrFutureInitiativeIsPubliclyAvailable',
      'UndertakingHasSetATargetWhichIsRelatedToAPolicy',
    ],
  },
  /**
   * A table key column EFRAG ships without its dropdown: B7's waste types. Both releases put the
   * `enum_ListTypeOfWastes` validation on `D437:F437` — the materials table's third row — rather than on the waste
   * table's `D323:F422`, whose own status formulas name the list. The list is read from that name and checked like any
   * other.
   */
  unvalidatedKeys: {
    TypeOfWasteAxis: 'enum_ListTypeOfWastes',
  },
  /**
   * A yes/no whose `YES`/`NO` list EFRAG ships on the wrong cell: B10's minimum-wage answer, whose `enum_ListYesNo`
   * validation sits on `C143`, a B9 label, in both releases. `1.3.0` ships `YES` in the answer's own cell, which is the
   * intent; `1.2.0` ships it empty, and its status formula tests only for blank.
   */
  wordsWithoutValidation: ['EmployeesReceivePayEqualOrAboveMinimumWageDeterminedByNationalLawOrCollectiveAgreement'],
  /**
   * Members whose English label is not the string EFRAG's dropdown holds — each right side must be a string the list
   * holds, checked below. Every other member matches its label, compared without case or punctuation.
   */
  aliases: {
    ConsolidatedMember: 'Sustainability report prepared on a consolidated basis',
    IndividualMember: 'Sustainability report prepared on an individual basis',
    OtherUndertakingsLegalFormMember: 'other (please specify the legal form in the row below)',
    AverageDuringTheReportingPeriodMember: 'As an average across the reporting period',
    AtTheEndOfTheReportingPeriodMember: 'At the end of the reporting period',
    // EFRAG's taxonomy labels it *Abestos*; its own template's pollutant list spells it right.
    AsbestosMember: 'Asbestos',
  },
};

// ── Reading the workbook ────────────────────────────────────────────────────────────────────────────────────────

const unescape = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
const attr = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const part = (name) => readPart(template, name) ?? fail(`the workbook has no ${name}`);

const sharedStrings = [...(readPart(template, 'xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
  unescape([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => text[1]).join('')),
);

const workbookXml = part('xl/workbook.xml');
const workbookRels = part('xl/_rels/workbook.xml.rels');
const sheetParts = new Map(
  [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)].map(([, tag]) => {
    const id = attr(tag, 'r:id');
    const target = [...workbookRels.matchAll(/<Relationship\b([^>]*)\/>/g)].find(([, rel]) => attr(rel, 'Id') === id)?.[1];
    const path = attr(target ?? '', 'Target') ?? fail(`sheet ${attr(tag, 'name')} has no part`);
    return [unescape(attr(tag, 'name')), path.startsWith('/') ? path.slice(1) : `xl/${path}`];
  }),
);

/** Workbook-scoped defined names to their references. */
const names = new Map(
  [...workbookXml.matchAll(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g)]
    .filter(([, tags]) => attr(tags, 'localSheetId') === null)
    .map(([, tags, reference]) => [attr(tags, 'name'), unescape(reference)]),
);

const column = (letters) => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
const letters = (n) => (n <= 0 ? '' : letters(Math.floor((n - 1) / 26)) + String.fromCharCode(65 + ((n - 1) % 26)));
const parseCell = (text) => {
  const match = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(text);
  return match ? { column: column(match[1]), row: Number(match[2]) } : null;
};
const address = ({ column: c, row }) => `${letters(c)}${row}`;

/** A defined name as a sheet and a rectangle, or `null` for a `#REF!` or anything that is not one range. */
const rangeOf = (name) => {
  const reference = names.get(name);
  if (reference === undefined) return null;
  const separator = reference.lastIndexOf('!');
  const sheet = reference.slice(0, separator).replace(/^'(.*)'$/, '$1').replaceAll("''", "'");
  const [first, last = first] = reference.slice(separator + 1).split(':');
  const start = parseCell(first);
  const end = parseCell(last);
  return start && end ? { sheet, start, end, rows: end.row - start.row + 1, columns: end.column - start.column + 1 } : null;
};

/** Every cell of a sheet: its type, its formula (or `null`) and its value as Excel caches it. */
const cellsCache = new Map();
const cellsOf = (sheet) => {
  if (cellsCache.has(sheet)) return cellsCache.get(sheet);
  const xml = part(sheetParts.get(sheet) ?? fail(`no sheet ${sheet}`));
  const cells = new Map();
  for (const [, tag, body = ''] of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const type = attr(tag, 't');
    const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(body)?.[1] ?? (/<f\b[^>]*\/>/.test(body) ? '' : null);
    let value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? null;
    if (value !== null) value = type === 's' ? sharedStrings[Number(value)] : unescape(value);
    cells.set(attr(tag, 'r'), { type, formula: formula === null ? null : unescape(formula), value });
  }
  const validations = [];
  for (const [, tags, body] of xml.matchAll(/<dataValidation\b([^>]*)>([\s\S]*?)<\/dataValidation>/g)) {
    validations.push({ sqref: attr(tags, 'sqref') ?? '', type: attr(tags, 'type'), formula: unescape(/<formula1>([\s\S]*?)<\/formula1>/.exec(body)?.[1] ?? '') });
  }
  for (const [, tags, body] of xml.matchAll(/<x14:dataValidation\b([^>]*)>([\s\S]*?)<\/x14:dataValidation>/g)) {
    validations.push({
      sqref: /<xm:sqref>([^<]*)<\/xm:sqref>/.exec(body)?.[1] ?? '',
      type: attr(tags, 'type'),
      formula: unescape(/<xm:f>([\s\S]*?)<\/xm:f>/.exec(body)?.[1] ?? ''),
    });
  }
  const entry = { cells, validations };
  cellsCache.set(sheet, entry);
  return entry;
};

const cellAt = (sheet, position) => cellsOf(sheet).cells.get(address(position)) ?? null;
const isFormula = (sheet, position) => cellAt(sheet, position)?.formula != null;

/** The validation covering one cell, or `null`. */
const validationAt = (sheet, position) =>
  cellsOf(sheet).validations.find(({ sqref }) =>
    sqref.split(/\s+/).some((area) => {
      const [first, last = first] = area.split(':');
      const start = parseCell(first);
      const end = parseCell(last);
      return start && end && position.row >= start.row && position.row <= end.row && position.column >= start.column && position.column <= end.column;
    }),
  ) ?? null;

/** The strings a list validation offers: a named range, a sheet range, or EFRAG's inline `"a, b"` list. */
const listOf = (formula) => {
  if (formula.startsWith('"')) return formula.slice(1, -1).split(',').map((item) => item.trim());
  const range = names.has(formula) ? rangeOf(formula) : rangeFromReference(formula);
  if (range === null) fail(`a list validation names ${formula}, which is not a range`);
  const out = [];
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    const value = cellAt(range.sheet, { column: range.start.column, row })?.value;
    if (value !== null && value !== undefined && value !== '') out.push(value);
  }
  return out;
};
function rangeFromReference(reference) {
  const separator = reference.lastIndexOf('!');
  if (separator < 0) return null;
  const sheet = reference.slice(0, separator).replace(/^'(.*)'$/, '$1');
  const [first, last = first] = reference.slice(separator + 1).split(':');
  const start = parseCell(first);
  const end = parseCell(last);
  return start && end ? { sheet, start, end } : null;
}

/** The row of a sheet whose column C carries EFRAG's label id — by its formula, which is the label's reference. */
const rowLabelled = (sheet, labelId) => {
  const rows = [...cellsOf(sheet).cells.entries()]
    .filter(([ref, cell]) => ref.startsWith('C') && /^C\d+$/.test(ref) && cell.formula !== null && cell.formula.trim().startsWith(labelId))
    .map(([ref]) => parseCell(ref).row);
  return rows.length === 1 ? rows[0] : null;
};

// ── Matching members to EFRAG's strings ─────────────────────────────────────────────────────────────────────────

/** Compared without case, punctuation or spacing — EFRAG's lists and its labels differ in nothing else that matters. */
const key = (text) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

/**
 * One string per member, no string matched twice — and every member matched, or the run fails naming what did not.
 *
 * **`partial` is for the one list EFRAG offers narrower than its domain**: B1's *disclosures with no change since the
 * previous period* is a set over the 51 sections and modules, and the template's dropdown offers the modules alone.
 * Members it cannot hold are left out of the map — the export states them in a footnote (task-46 row (3)) — and the
 * run still fails if any string in EFRAG's list is matched by no member, which is how a renamed label would show.
 */
function matchAll({ domain, members, strings, labelOf, partial = false }) {
  const byKey = new Map(strings.map((text) => [key(text), text]));
  const out = {};
  const used = new Set();
  const missing = [];
  for (const member of members) {
    const alias = AUTHORED.aliases[member];
    const wanted = alias ?? labelOf(member);
    const found = wanted === undefined ? undefined : alias !== undefined ? (strings.includes(alias) ? alias : undefined) : byKey.get(key(wanted));
    if (found === undefined || used.has(found)) missing.push(`${member} (${wanted ?? 'no label'})`);
    else {
      out[member] = found;
      used.add(found);
    }
  }
  if (!partial && missing.length > 0) fail(`${domain}: no string in EFRAG's list for ${missing.join('; ')} — among ${strings.join(' | ').slice(0, 400)}`);
  const unused = strings.filter((text) => !used.has(text));
  if (partial && unused.length > 0) fail(`${domain}: EFRAG's list offers ${unused.join(' | ')}, which no member matches`);
  return out;
}

/** The one domain whose dropdown is narrower than the domain itself — see `matchAll`. */
const PARTIAL_DOMAINS = new Set(['ListOfDisclosuresMember']);

/** NACE: `NACE G - 47.22 Retail sale of meat…` and `NACE G - WHOLESALE AND RETAIL TRADE…`, matched by code. */
function naceList(strings) {
  const byCode = new Map();
  for (const text of strings) {
    const match = /^NACE ([A-Z]) - (\d{2}(?:\.\d{1,2})?)?/.exec(text);
    if (match === null) continue;
    byCode.set(match[2] ?? match[1], text);
  }
  const out = {};
  const missing = [];
  for (const [member, entry] of Object.entries(naceClassification.members)) {
    const text = byCode.get(entry.code);
    if (text === undefined) missing.push(`${member} (${entry.code})`);
    else out[`nace:${member}`] = text;
  }
  if (missing.length > 0) fail(`NACE: no string for ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ` and ${missing.length - 20} more` : ''}`);
  return out;
}

/** The EU List of Waste: `    01 01 01 - Non-Hazardous - Wastes from…`, matched by its code. */
function wasteList(strings) {
  const byCode = new Map();
  for (const text of strings) {
    const match = /^\s*(\d{2}(?: \d{2}){0,2})\s+-\s/.exec(text);
    if (match !== null) byCode.set(match[1], text);
  }
  const out = {};
  const missing = [];
  for (const [member, entry] of Object.entries(wasteClassification.members)) {
    const text = byCode.get(entry.code);
    if (text === undefined) missing.push(`${member} (${entry.code})`);
    else out[member] = text;
  }
  if (missing.length > 0) fail(`waste: no string for ${missing.slice(0, 20).join(', ')}`);
  return out;
}

/**
 * ISO 3166: the list's names, each beside its `country:XX` in the next column of *Enumeration Lists* — keyed by that
 * qualified name, which is how an enumeration answer is stored; a table keyed by the bare code qualifies its key first.
 */
function countryList(listName) {
  const range = rangeOf(listName) ?? fail(`no ${listName}`);
  const out = {};
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    const name = cellAt(range.sheet, { column: range.start.column, row })?.value;
    const code = cellAt(range.sheet, { column: range.start.column + 1, row })?.value;
    if (name && code?.startsWith('country:')) out[code] = name;
  }
  const axis = taxonomy.axes.CountryOfEmploymentContractAxis.members;
  const missing = axis.filter((code) => out[`country:${code}`] === undefined);
  if (missing.length > 0) fail(`countries: no name for ${missing.join(', ')}`);
  return out;
}

/** A unit's string to its code — `kilograms (kg)` → `kg`, `squared meters (m2)` → `m2`. */
const unitCodeOf = (text) => {
  const match = /\(([^)]+)\)\s*$/.exec(text);
  if (match === null) fail(`a unit string ${JSON.stringify(text)} carries no code`);
  return match[1].replace('m²', 'm2').replace('m³', 'm3');
};

// ── Building the map ────────────────────────────────────────────────────────────────────────────────────────────

const lists = {};
const nameAt = (name, offset = {}) => ({ name, ...(offset.row ? { row: offset.row } : {}), ...(offset.column ? { column: offset.column } : {}) });

/** The list a cell's validation offers, registered once under a key the elements share. */
function listFor(listKey, strings, build) {
  if (lists[listKey] === undefined) lists[listKey] = build(strings);
  return listKey;
}

/** How a yes/no is written in one cell: a TRUE/FALSE cell, or EFRAG's `YES`/`NO` words. */
function yesNoEncoding(sheet, position) {
  const validation = validationAt(sheet, position);
  if (validation?.type === 'list' && validation.formula === 'enum_ListYesNo') {
    const [yes, no] = listOf('enum_ListYesNo');
    return { as: 'words', true: yes, false: no };
  }
  if (validation?.type === 'list' && validation.formula === 'enum_list_true_false') return { as: 'boolean' };
  if (validation?.type === 'custom' && /=TRUE/.test(validation.formula)) return { as: 'boolean' };
  const cached = cellAt(sheet, position);
  if (cached?.type === 'b') return { as: 'boolean' };
  if (cached?.type === 's' && ['YES', 'NO'].includes(cached.value)) {
    const [yes, no] = listOf('enum_ListYesNo');
    return { as: 'words', true: yes, false: no };
  }
  return fail(`${sheet}!${address(position)} is a yes/no with no encoding the template states`);
}

/** The encoding of one element's cell, from its kind and the cell's own validation. */
function encodingFor(elementKey, element, sheet, position) {
  switch (element.kind) {
    case 'numeric':
    case 'monetary':
    case 'percent':
    case 'year':
      return { as: 'number' };
    case 'text':
    case 'text_block':
      return { as: 'text' };
    case 'boolean':
      if (AUTHORED.wordsWithoutValidation.includes(elementKey) && validationAt(sheet, position) === null) {
        const [yes, no] = listOf('enum_ListYesNo');
        return { as: 'words', true: yes, false: no };
      }
      return yesNoEncoding(sheet, position);
    case 'enumeration':
    case 'enumeration_set': {
      const validation = validationAt(sheet, position);
      if (validation === null || validation.type !== 'list') fail(`${elementKey} at ${sheet}!${address(position)} has no list to choose from`);
      const strings = listOf(validation.formula);
      if (element.domain === 'country:CountryDomain') return { as: 'list', list: listFor('country', strings, () => countryList('enum_ListCountriesName')) };
      if (element.domain?.startsWith('nace:')) return { as: 'list', list: listFor('nace', strings, naceList) };
      const domain = taxonomy.enumerations[`vsme:${element.domain}`] ?? fail(`${elementKey}'s domain ${element.domain} is not in the taxonomy`);
      return {
        as: 'list',
        list: listFor(element.domain, strings, (offered) =>
          Object.fromEntries(
            Object.entries(
              matchAll({
                domain: element.domain,
                members: domain.members,
                strings: offered,
                labelOf: (member) => memberLabels[member] ?? elementLabels[member],
                partial: PARTIAL_DOMAINS.has(element.domain),
              }),
            ).map(
              ([member, text]) => [`vsme:${member}`, text],
            ),
          ),
        ),
      };
    }
    default:
      return fail(`${elementKey} is a ${element.kind}, which the Basic Module does not hold`);
  }
}

/**
 * Which unit name first claimed each unit cell. **Several elements share one**: B4's three emissions all name `C78`,
 * B5's land-use totals `C293` — so the map gives them one spelling of the target, and the export, seeing the same
 * target, knows the figures must agree on a unit (task-46 row (6)).
 */
const unitCells = new Map();

/** The unit a figure's cell is written beside, where the template names one — `null` where the taxonomy fixes it. */
function unitFor(elementKey) {
  const range = rangeOf(`${elementKey}_unit`);
  if (range === null) return null;
  if (isFormula(range.sheet, range.start)) return { computed: true };
  const validation = validationAt(range.sheet, range.start) ?? fail(`${elementKey}_unit offers no unit list`);
  const strings = listOf(validation.formula);
  const listKey = `unit:${validation.formula}`;
  if (lists[listKey] === undefined) lists[listKey] = Object.fromEntries(strings.map((text) => [unitCodeOf(text), text]));
  const cell = `${range.sheet}!${address(range.start)}:${range.rows}`;
  if (!unitCells.has(cell)) unitCells.set(cell, `${elementKey}_unit`);
  return { at: nameAt(unitCells.get(cell)), list: listKey, perRow: range.rows > 1 };
}

/**
 * Which element's name first claimed each table column. **A mass and a volume share one** — B7's waste is written in
 * kilogrammes or cubic metres in the same column, its row's unit saying which, and so are its materials — so the map
 * names a shared column once, and the export, seeing two elements at one column, knows one row holds one of them.
 */
const tableColumns = new Map();
const columnName = (elementKey, range) => {
  const id = `${range.sheet}!${address(range.start)}:${range.rows}`;
  if (!tableColumns.has(id)) tableColumns.set(id, elementKey);
  return tableColumns.get(id);
};

/** Which elements the Basic Module's export places: B1 … B11, and the four that belong to no module. */
const basic = Object.entries(taxonomy.elements).filter(
  ([, element]) => element.modules.length === 0 || element.modules.some((module) => /^B\d+$/.test(module)),
);

const groups = {};
const elements = {};
const gatesOut = [];
const derived = new Set(derivations.map(({ element }) => element));

/** A table's key column: its axis's own name, or for B5 the column whose list is B1's site identifiers. */
function groupFor(axis, range) {
  const candidates = [...names.keys()].filter((name) => /Axis$/.test(name) && rangeOf(name) !== null);
  for (const name of candidates) {
    const keyRange = rangeOf(name);
    if (keyRange.sheet !== range.sheet || keyRange.start.row !== range.start.row || keyRange.end.row !== range.end.row) continue;
    const typed = taxonomy.axes[axis]?.typed === true;
    const prefilled = cellAt(keyRange.sheet, keyRange.start)?.value === '1';
    const groupKey = name;
    if (groups[groupKey] === undefined) {
      if (typed && prefilled) groups[groupKey] = { kind: 'ordinal', axis, rows: keyRange.rows };
      else if (typed) groups[groupKey] = { kind: 'keyed', axis, key: nameAt(name), rows: keyRange.rows };
      else {
        const formula = validationAt(keyRange.sheet, keyRange.start)?.formula ?? AUTHORED.unvalidatedKeys[axis] ?? fail(`${name} offers no list`);
        const strings = listOf(formula);
        const list =
          axis === 'TypeOfPollutantAxis'
            ? listFor('pollutant', strings, (offered) =>
                matchAll({ domain: 'pollutant', members: taxonomy.axes[axis].members, strings: offered, labelOf: (member) => memberLabels[member] }),
              )
            : axis === 'TypeOfWasteAxis'
              ? listFor('waste', strings, wasteList)
              : axis === 'CountryOfEmploymentContractAxis'
                ? listFor('country', strings, () => countryList('enum_ListCountriesName'))
                : fail(`no list for axis ${axis}`);
        // A member stored bare on an axis drawn from another taxonomy — `MD` on B8's country axis — is qualified to
        // the list's key, `country:MD`.
        const memberTaxonomy = taxonomy.axes[axis]?.memberTaxonomy;
        groups[groupKey] = { kind: 'classified', axis, member: nameAt(name), list, rows: keyRange.rows, ...(memberTaxonomy ? { qualify: `${memberTaxonomy}:` } : {}) };
      }
    }
    return groupKey;
  }
  return fail(`no key column shares rows ${range.start.row}…${range.end.row} on ${range.sheet} for ${axis}`);
}

for (const [elementKey, element] of basic) {
  if (elementKey === 'ListOfOmittedDisclosuresDeemedToBeClassifiedOrSensitiveInformation') {
    elements[elementKey] = { kind: 'omission' };
    continue;
  }
  const memberNames = [...names.keys()].filter((name) => name.startsWith(`${elementKey}_`) && name.endsWith('Member'));
  const own = rangeOf(elementKey);
  const axis = element.axes?.[0] ?? null;

  if (memberNames.length > 0) {
    // A breakdown, or B3's reporting scopes: one cell per member, the element's own name the undimensioned figure.
    const cells = {};
    const computed = [];
    const entries = [
      ...(own === null ? [] : [['', elementKey]]),
      ...memberNames.map((name) => [name.slice(elementKey.length + 1), name]),
    ];
    // B3's scopes keep only the current period: the base year and the target are C3's (task 80.3).
    const forBasic = axis === 'ReportingScopesAxis' ? entries.filter(([member]) => member === '' || member === 'CurrentlyStatedMember') : entries;
    let encoding = null;
    for (const [member, name] of forBasic) {
      const range = rangeOf(name) ?? fail(`${name} does not resolve`);
      const dimension = member === 'CurrentlyStatedMember' ? '' : member;
      // Every member's cell is named — a computed one too, which a cell note (task-46 row (9)) is attached to.
      cells[dimension] = nameAt(name);
      if (isFormula(range.sheet, range.start)) computed.push(dimension);
      else encoding ??= encodingFor(elementKey, element, range.sheet, range.start);
    }
    elements[elementKey] = { kind: 'members', cells, computed, derived: derived.has(elementKey), encoding: encoding ?? { as: 'number' } };
    continue;
  }

  if (own === null) fail(`${elementKey} has no defined name in the template`);

  if (element.kind === 'enumeration_set') {
    if (own.columns > 1 && own.rows === 1) {
      const domain = taxonomy.enumerations[`vsme:${element.domain}`];
      const headers = [];
      for (let c = own.start.column; c <= own.end.column; c += 1) headers.push(cellAt(own.sheet, { column: c, row: own.start.row - 1 })?.value ?? '');
      const byHeader = matchAll({ domain: element.domain, members: domain.members, strings: headers, labelOf: (member) => memberLabels[member] });
      const columns = Object.fromEntries(Object.entries(byHeader).map(([member, header]) => [`vsme:${member}`, headers.indexOf(header)]));
      const gate = { sheet: own.sheet, cell: address({ column: own.start.column - 1, row: own.start.row }) };
      if (!/=TRUE/.test(validationAt(own.sheet, parseCell(gate.cell))?.formula ?? '')) fail(`${elementKey}'s question left of it is not a yes/no`);
      elements[elementKey] = { kind: 'columns', at: nameAt(elementKey), columns, encoding: yesNoEncoding(own.sheet, own.start) };
      gatesOut.push({ at: gate, when: AUTHORED.setGates[elementKey] ?? fail(`no gate group for ${elementKey}`), answer: 'held' });
      continue;
    }
    elements[elementKey] = { kind: 'list', at: nameAt(elementKey), rows: own.rows, encoding: encodingFor(elementKey, element, own.sheet, own.start) };
    continue;
  }

  if (axis !== null) {
    const group = groupFor(axis, own);
    const formula = isFormula(own.sheet, own.start);
    elements[elementKey] = formula
      ? { kind: 'computed', at: nameAt(elementKey), group, derived: derived.has(elementKey) }
      : { kind: 'rows', group, at: nameAt(columnName(elementKey, own)), encoding: encodingFor(elementKey, element, own.sheet, own.start), unit: unitFor(elementKey) };
    continue;
  }

  if (isFormula(own.sheet, own.start)) {
    const unit = unitFor(elementKey);
    elements[elementKey] = { kind: 'computed', at: nameAt(elementKey), derived: derived.has(elementKey), ...(unit && !unit.computed ? { unit } : {}) };
    continue;
  }
  elements[elementKey] = { kind: 'cell', at: nameAt(elementKey), encoding: encodingFor(elementKey, element, own.sheet, own.start), unit: unitFor(elementKey) };
}

// ── The rest of the map ─────────────────────────────────────────────────────────────────────────────────────────

/** The language cell, and the entry of its list that selects EFRAG's official English (182/31). */
const language = (() => {
  const range = rangeOf('template_selected_display_language') ?? fail('no language cell');
  const validation = validationAt(range.sheet, range.start) ?? fail('the language cell offers no list');
  const english = listOf(validation.formula).filter((option) => /\[en\]\s*$/.test(option));
  if (english.length !== 1) fail(`the language list holds ${english.length} English entries`);
  return { at: nameAt('template_selected_display_language'), value: english[0] };
})();

/** The report's own block: the entity, its identifier and scheme, the currency and the period's six day fields. */
const report = (() => {
  const periodCells = (name) => {
    const range = rangeOf(name) ?? fail(`no ${name}`);
    const formula = cellAt(range.sheet, range.start)?.formula ?? fail(`${name} is not computed from day fields`);
    const refs = [...new Set([...formula.matchAll(/\b([A-Z]{1,2}\d+)\b/g)].map((m) => m[1]))];
    if (refs.length !== 3) fail(`${name} reads ${refs.length} cells, not a year, a month and a day`);
    const [year, month, day] = refs.map((cell) => ({ sheet: range.sheet, cell }));
    for (const field of [year, month, day]) if (isFormula(range.sheet, parseCell(field.cell))) fail(`${range.sheet}!${field.cell} is computed`);
    return { year, month, day };
  };
  const schemes = listOf(validationAt(rangeOf('template_reporting_entity_identifier_scheme').sheet, rangeOf('template_reporting_entity_identifier_scheme').start)?.formula ?? fail('no scheme list'));
  if (!schemes.includes('LEI')) fail(`the identifier schemes ${schemes.join(', ')} offer no LEI`);
  return {
    entityName: nameAt('template_reporting_entity_name'),
    identifierScheme: nameAt('template_reporting_entity_identifier_scheme'),
    identifier: nameAt('template_reporting_entity_identifier'),
    leiScheme: 'LEI',
    currency: nameAt('template_currency'),
    periodStart: periodCells('template_reporting_period_startdate'),
    periodEnd: periodCells('template_reporting_period_enddate'),
  };
})();

/** The derivation inputs' cells: column D of the row EFRAG labels. */
const inputs = Object.fromEntries(
  Object.entries(AUTHORED.inputs).map(([inputKey, labelId]) => {
    const row = rowLabelled('Social Disclosures', labelId) ?? fail(`no row labelled ${labelId}`);
    const cell = `D${row}`;
    if (isFormula('Social Disclosures', parseCell(cell))) fail(`Social Disclosures!${cell} is computed`);
    return [inputKey, { sheet: 'Social Disclosures', cell }];
  }),
);
const declaredInputs = new Set(derivations.flatMap(({ operands }) => Object.values(operands).filter((o) => o.from === 'input').map((o) => o.key)));
for (const inputKey of declaredInputs) if (inputs[inputKey] === undefined) fail(`derivation input ${inputKey} has no cell`);

/** The template's own yes/no questions before a group, each found by its label and checked to be a yes/no. */
for (const gate of AUTHORED.gates) {
  let found = null;
  for (const sheet of ['General Information', 'Environmental Disclosures', 'Social Disclosures', 'Governance Disclosures']) {
    const row = rowLabelled(sheet, gate.label);
    if (row === null) continue;
    const yesNo = [...cellsOf(sheet).cells.entries()].find(([ref, cell]) => parseCell(ref)?.row === row && cell.type === 'b' && cell.formula === null);
    if (yesNo) found = { sheet, cell: yesNo[0] };
  }
  if (found === null) fail(`no yes/no labelled ${gate.label}`);
  gatesOut.push({ at: found, when: gate.when, answer: gate.answer });
}
for (const gate of gatesOut) {
  if (!['held', 'affirmed', 'several'].includes(gate.answer)) fail(`the gate at ${gate.at.sheet}!${gate.at.cell} says no way of answering it`);
  for (const elementKey of gate.when) if (elements[elementKey] === undefined) fail(`the gate at ${gate.at.sheet}!${gate.at.cell} names ${elementKey}, which the map places nowhere`);
}

/** The ToC's checkboxes, each matched to the member of the omission domain whose label its row carries. */
const omission = (() => {
  const sheet = 'Table of Contents & Validation';
  const { cells } = cellsOf(sheet);
  const rows = [...cells.entries()]
    .filter(([ref, cell]) => /^B\d+$/.test(ref) && cell.formula !== null && cell.value)
    .map(([ref, cell]) => ({ row: parseCell(ref).row, label: cell.value }));
  const checkbox = (row) => cells.get(`D${row}`) ?? null;
  const members = taxonomy.enumerations['vsme:ListOfDisclosuresMember'].members;
  const out = {};
  const missing = [];
  for (const member of members) {
    const label = memberLabels[member] ?? elementLabels[member];
    // A row's label is the member's own, or — for the introduction's *any other* disclosure — contains it.
    const matches = rows.filter((candidate) => key(candidate.label).includes(key(label ?? '#')) || key(label ?? '#').startsWith(key(candidate.label)));
    const exact = matches.filter((candidate) => key(candidate.label) === key(label ?? '#'));
    const boxed = matches.filter((candidate) => checkbox(candidate.row) !== null);
    if (exact.length !== 1 && boxed.length > 1) fail(`omission: ${member} matches ToC rows ${boxed.map((r) => r.row).join(', ')}`);
    const row = (exact.length === 1 ? exact : boxed)[0];
    const box = row ? checkbox(row.row) : null;
    if (!row || box === null) {
      missing.push(member);
      continue;
    }
    if (box.formula === null) out[member] = [{ sheet, cell: `D${row.row}` }];
    else {
      // A module's own box is computed from its sections' — `COUNTIF(D13:D16,TRUE)=ROWS(D13:D16)` — so its member
      // sets every section box the formula reads.
      const span = /COUNTIF\((D\d+):(D\d+),TRUE\)/.exec(box.formula) ?? fail(`ToC D${row.row} computes ${box.formula}`);
      const leaves = [];
      for (let r = parseCell(span[1]).row; r <= parseCell(span[2]).row; r += 1) {
        if (checkbox(r)?.formula === null) leaves.push({ sheet, cell: `D${r}` });
      }
      out[member] = leaves;
    }
  }
  if (missing.length > 0) fail(`omission: no ToC checkbox for ${missing.join(', ')}`);
  return out;
})();

/** Where a note goes: EFRAG's Footnotes sheet where the template has one (1.3.0), a cell note where it has not. */
const notes = (() => {
  if (!names.has('footnote_text')) return { kind: 'cell_notes' };
  const labels = rangeOf('template_footnote_labels_taxonomy') ?? fail('no footnote label list');
  const offered = [];
  for (let row = labels.start.row; row <= labels.end.row; row += 1) offered.push(cellAt(labels.sheet, { column: 2, row })?.value ?? '');
  const byKey = new Map(offered.map((text) => [key(text), text]));
  const out = {};
  const missing = [];
  for (const [elementKey] of basic) {
    const text = byKey.get(key(elementLabels[elementKey] ?? '#')) ?? byKey.get(key((elementLabels[elementKey] ?? '#').replace(/ on the reporting period$/, '')));
    if (text === undefined) missing.push(elementKey);
    else out[elementKey] = text;
  }
  if (missing.length > 0) fail(`footnotes: no label for ${missing.join(', ')}`);
  // A footnote is a block: its text one merged cell down several rows, the cells it explains one per row beside it —
  // `B4:B13` in `1.3.0`, so a footnote names up to ten cells and the sheet holds a hundred and fifty-two.
  const textRange = rangeOf('footnote_text') ?? fail('no footnote text column');
  const merges = [...part(sheetParts.get(textRange.sheet)).matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g)];
  const first = merges.find(([, from]) => from === address(textRange.start)) ?? fail('the first footnote text is not one merged block');
  const rowsPerNote = parseCell(first[2]).row - textRange.start.row + 1;
  if (textRange.rows % rowsPerNote !== 0) fail(`the footnote column's ${textRange.rows} rows are not blocks of ${rowsPerNote}`);
  return {
    kind: 'footnotes',
    text: nameAt('footnote_text'),
    dimension: nameAt('footnote_ref_dimension'),
    concept: nameAt('footnote_ref_concept'),
    rowsPerNote,
    capacity: textRange.rows / rowsPerNote,
    labels: out,
  };
})();

// ── Proving it: every target the map names is a cell the package will write ────────────────────────────────────

const toTarget = (at) => (at.name ? { kind: CELL_TARGET.NAMED, ...at } : { kind: CELL_TARGET.ADDRESS, ...at });
const probe = [];
const sample = { kind: CELL_VALUE_KIND.TEXT, value: 'x' };
const add = (at) => probe.push({ at: toTarget(at), value: sample });
add(language.at);
for (const at of [report.entityName, report.identifierScheme, report.identifier, report.currency, ...Object.values(report.periodStart), ...Object.values(report.periodEnd)]) add(at);
for (const at of Object.values(inputs)) add(at);
for (const gate of gatesOut) add(gate.at);
for (const boxes of Object.values(omission)) for (const at of boxes) if (!probe.some((p) => p.at.sheet === at.sheet && p.at.cell === at.cell)) add(at);
const seenUnits = new Set();
for (const placement of Object.values(elements)) {
  if (placement.kind === 'cell') add(placement.at);
  if (placement.kind === 'members') Object.entries(placement.cells).filter(([member]) => !placement.computed.includes(member)).forEach(([, at]) => add(at));
  for (const unit of [placement.unit].filter((u) => u && !u.computed)) {
    const id = JSON.stringify(unit.at);
    if (!seenUnits.has(id)) {
      seenUnits.add(id);
      add(unit.at);
    }
  }
}
try {
  patchWorkbook({ template, writes: probe });
} catch (error) {
  fail(`a target the map names is not writable: ${error.message}`);
}

const map = {
  templateVersion,
  taxonomyVersion,
  // The binary this map was read from: the registry refuses a map whose binary is not the registered one.
  template: { file: registration.file, sha256: registration.sha256 },
  language,
  report,
  notes,
  elements: Object.fromEntries(Object.entries(elements).sort(([a], [b]) => a.localeCompare(b))),
  groups,
  inputs,
  gates: gatesOut,
  omission,
  lists: Object.fromEntries(Object.entries(lists).sort(([a], [b]) => a.localeCompare(b))),
};
const out = join(ROOT, `config/seed/vsme-digital-template-map.${templateVersion}.json`);
writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`);
console.log(
  `wrote ${out}: ${Object.keys(elements).length} elements, ${Object.keys(groups).length} tables, ${Object.keys(lists).length} lists ` +
    `(${Object.values(lists).reduce((n, list) => n + Object.keys(list).length, 0)} strings), notes as ${notes.kind}`,
);
