import { LABEL_STANDING, type LabelStanding, roundHalfUp } from '@easyesg/i18n';
import { ENTITY_FIELD, type Finding } from '@easyesg/validation';
import { CELL_VALUE_KIND, type CellValue } from '@easyesg/xlsx-patch';
import {
  type DigitalTemplateMap,
  offsetCell,
  TEMPLATE_PLACEMENT,
  type TemplateCell,
  type TemplatePlacement,
  type TemplateUnit,
} from '@api/contracts/digital-template-map';
import {
  type NotedFigure,
  type ReportWorkbook,
  WORKBOOK_NOTE,
  type WorkbookFacts,
  type WorkbookNote,
  type WorkbookNoteText,
  type WorkbookWrite,
} from '@api/contracts/report-workbook.port';
import type { LegalDate } from '@api/contracts/types/time';
import { DISCLOSURE_ORIGIN } from '@api/modules/core/disclosure/models/disclosure-value.model';
import type { DerivationInputField, DisclosureField } from '@api/modules/core/disclosure/models/wizard-step.model';
import { FIELD_HOLDING, holdingOf } from './workbook-answers';
import { type FigurePrecision, presentedPlaces, presentedUnit } from '@api/modules/core/disclosure/domain/figure-precision';
import { gateIsAffirmed, type HeldAnswers } from './workbook-gates';
import { tableRows, type TableRows } from './workbook-rows';
import { convertFigure, isConvertible, placedUnit } from './workbook-units';
import { cellValueOf, isUnlisted, type WorkbookAnswer } from './workbook-value';

/** What the workbook is assembled from — what the document reads, less the prior period the template has no cell for. */
export interface WorkbookSources {
  readonly report: {
    readonly entityName: string;
    readonly lei: string | null;
    readonly idno: string | null;
    readonly reportingCurrency: string;
    readonly periodStart: LegalDate;
    readonly periodEnd: LegalDate;
  };
  /** Every field of the modules the document prints (`modulesToRead`), in the document's language. */
  readonly fields: readonly DisclosureField[];
  /** The derivation inputs those modules read (task 36.10). */
  readonly inputs: readonly DerivationInputField[];
  /** The elements a validation run evaluates — what a declared section withholds is not among them (FR-31). */
  readonly inScope: ReadonlySet<string>;
  /** The latest calculator run: its factor set's label and each computed figure — `null` where none has run. */
  readonly run: { readonly factorSet: string | null; readonly results: ReadonlyMap<string, string> } | null;
  /** The last validation run's findings — `null` where none has run. */
  readonly findings: readonly Finding[] | null;
  /** The digits each figure is shown to (FR-29; task-46 row (10)) — what a note states, and a reporter's figure rounds to. */
  readonly precision: FigurePrecision;
  /** Whose words the labels are in the export's language at the pinned version (UX-98, T-14). */
  readonly labelStanding: LabelStanding | null;
  readonly facts: WorkbookFacts;
}

/** The element every report gives, on which task 46.3's statement is footnoted (task-46 row (7)). */
const ALWAYS_REPORTED = 'BasisForPreparation';

/**
 * The report as the EFRAG Digital Template takes it (task 46; FR-50; `architecture.md` §12.5.6's task-46 row) —
 * pure, so every rule about where a value goes and when a figure needs a note is a unit case.
 *
 * - **The template's own cells, by its own map**: the language cell set to EFRAG's English (182/31); the entity, its
 *   LEI — or its IDNO with no scheme, EFRAG having none for it (row (5)) — the currency and the period's day fields;
 *   then every answered disclosure where the map places it, a member as EFRAG's dropdown string, a yes/no as the cell
 *   asks for it. **No prior-period value** (182/33): the template has no cell for one.
 * - **A reporter's figure rounds once, at its unit's places** (FR-29, task-182 row (3)), as the PDF rounds it; **one
 *   the platform calculated, derived or had replaced is written exact** (row (10)) — EFRAG's own cell formats show it at
 *   the digits the PDF prints, and the template's formulas compute from it exactly. One the template computes is left
 *   to its formula (182/32), its inputs written, and the undertaking's own figure noted unless the platform derives it
 *   from those very inputs (row (3)). **A figure stored with no unit is in its element's one admitted unit**, where it
 *   admits one — B3's calculated tonnes.
 * - **A cell's unit governs every figure it covers**: written in one unit it offers, converted exactly where a figure
 *   was stored in another, the stored figure noted (row (6)).
 * - **Every gap is marked** (FR-44, 182/30): an omitted section is its ToC checkbox; a field not available, an
 *   unresolved finding and a company estimate are notes on the figure, with the factor set a calculated figure used
 *   and — where the export's language has no EFRAG labels — task 46.3's statement (row (7)).
 *
 * **A value the map cannot place is refused**, never dropped: an answered element with no placement (a Comprehensive
 * disclosure, task 80.3's), a member a single choice's list does not hold, a table the report outgrows.
 */
export function assembleReportWorkbook(sources: WorkbookSources, map: DigitalTemplateMap): ReportWorkbook {
  const writes = new Map<string, WorkbookWrite>();
  const notes: WorkbookNote[] = [];
  const write = (at: TemplateCell, value: CellValue) => {
    const key = cellKey(at);
    if (writes.has(key)) throw new Error(`the workbook writes ${key} twice`);
    writes.set(key, { at, value });
  };
  const text = (value: string): CellValue => ({ kind: CELL_VALUE_KIND.TEXT, value });
  const number = (value: string): CellValue => ({ kind: CELL_VALUE_KIND.NUMBER, value });
  const note = (field: { readonly elementKey: string }, dimension: string, at: TemplateCell, says: WorkbookNoteText) =>
    notes.push({ element: field.elementKey, dimension, at, says });
  /** A field's unit: the one stored, or its element's one admitted unit where none is (task-46 row (10)). */
  const unitOf = (field: DisclosureField): string | null => presentedUnit(field);
  /** The places a field's figure is shown to, in `unitCode` where it is written in another unit than its own. */
  const placesOf = (field: DisclosureField, unitCode: string | null): number | null =>
    presentedPlaces({ field: { ...field, unitCode }, precision: sources.precision });
  /** The decimal a cell is given: a reporter's figure rounded once, a computed one exact (row (10)). */
  const rounded = (field: DisclosureField, value: string, unitCode: string | null = unitOf(field)): string => {
    const places = isComputed(field) ? null : placesOf(field, unitCode);
    return places === null ? value : roundHalfUp(value, places);
  };
  /** A figure as a note states it — at the digits the PDF prints it to. */
  const figureOf = (field: DisclosureField, value: string, unitCode: string | null = unitOf(field)): NotedFigure => ({
    value,
    places: placesOf(field, unitCode),
    unit: unitCode,
  });

  // ── The report's own block ─────────────────────────────────────────────────────────────────────────────────────
  write(map.language.at, text(map.language.value));
  const { report } = sources;
  write(map.report.entityName, text(report.entityName));
  if (report.lei !== null) {
    write(map.report.identifierScheme, text(map.report.leiScheme));
    write(map.report.identifier, text(report.lei));
  } else if (report.idno !== null) {
    write(map.report.identifier, text(report.idno));
  }
  write(map.report.currency, text(report.reportingCurrency));
  for (const [day, date] of [
    [map.report.periodStart, report.periodStart.date],
    [map.report.periodEnd, report.periodEnd.date],
  ] as const) {
    const [year, month, dayOfMonth] = date.split('-').map((part) => String(Number(part)));
    write(day.year, number(year));
    write(day.month, number(month));
    write(day.day, number(dayOfMonth));
  }

  // ── Which fields are written, and the tables they fill ─────────────────────────────────────────────────────────
  const placementOf = (field: DisclosureField): TemplatePlacement => {
    const placement = map.elements[field.elementKey];
    if (placement === undefined) {
      throw new Error(`template ${map.templateVersion} places no ${field.elementKey}; a Comprehensive disclosure is task 80.3's`);
    }
    return placement;
  };
  const written = sources.fields.filter((field) => field.applicable && sources.inScope.has(field.elementKey));
  const held = new Map(written.map((field) => [field, holdingOf(field)]));
  const answered = written.filter((field) => held.get(field)?.kind === FIELD_HOLDING.ANSWERS);

  const tables = new Map<string, TableRows>();
  for (const [groupKey, group] of Object.entries(map.groups)) {
    const onTable = answered.filter((field) => {
      const placement = map.elements[field.elementKey];
      return placement !== undefined && 'group' in placement && placement.group === groupKey;
    });
    const rows = tableRows({ group, fields: onTable, lists: map.lists });
    tables.set(groupKey, rows);
    rows.keys.forEach((key) => write(key.at, key.value));
  }

  /** Where a field's figure sits — the row of its table included — or `null` where its table gives it none. */
  const placeOf = (field: DisclosureField): { readonly at: TemplateCell; readonly dimension: string } | null => {
    const placement = placementOf(field);
    switch (placement.kind) {
      case TEMPLATE_PLACEMENT.CELL:
      case TEMPLATE_PLACEMENT.LIST:
      case TEMPLATE_PLACEMENT.COLUMNS:
        return { at: placement.at, dimension: field.dimensionKey };
      case TEMPLATE_PLACEMENT.MEMBERS: {
        const at = placement.cells[field.dimensionKey];
        return at === undefined ? null : { at, dimension: field.dimensionKey };
      }
      case TEMPLATE_PLACEMENT.ROWS:
      case TEMPLATE_PLACEMENT.COMPUTED: {
        if (!('group' in placement) || placement.group === undefined) return { at: placement.at, dimension: field.dimensionKey };
        const rows = tables.get(placement.group);
        const row = rows?.rowOf(field) ?? null;
        return row === null || rows === undefined ? null : { at: offsetCell(placement.at, { row }), dimension: rows.dimensionOf(field) };
      }
      case TEMPLATE_PLACEMENT.OMISSION:
        return null;
    }
  };

  // ── Units: what each unit cell is written in, and each figure in it ────────────────────────────────────────────
  const unitFigures = new Map<string, { readonly unit: TemplateUnit; readonly fields: DisclosureField[] }>();
  const unitOfPlacement = (placement: TemplatePlacement): TemplateUnit | null =>
    'unit' in placement && placement.unit !== undefined && placement.unit !== null ? placement.unit : null;
  for (const field of answered) {
    const placement = placementOf(field);
    const unit = unitOfPlacement(placement);
    if (unit === null || unit.perRow || placement.kind === TEMPLATE_PLACEMENT.COMPUTED) continue;
    const key = cellKey(unit.at);
    const entry = unitFigures.get(key) ?? { unit, fields: [] };
    entry.fields.push(field);
    unitFigures.set(key, entry);
  }
  /** The unit each shared unit cell is written in, by the cell. */
  const placedUnits = new Map<string, string>();
  for (const [key, { unit, fields }] of unitFigures) {
    const offered = Object.keys(map.lists[unit.list] ?? {});
    const stored = [...new Set(fields.map(unitOf).filter((code): code is string => code !== null))];
    if (stored.length === 0) continue;
    const placed = placedUnit({ stored, offered });
    if (placed === null) throw new Error(`the unit cell ${key} offers ${offered.join(', ')}, and its figures are in ${stored.join(', ')}`);
    placedUnits.set(key, placed);
    write(unit.at, text(map.lists[unit.list][placed]));
  }

  /** The unit each row's own unit cell is written in — B7's waste and materials — by the cell. */
  const rowUnits = new Map<string, string>();

  /**
   * The decimal written for a figure, in its cell's unit — and the note its conversion owes, if any. `null` where its
   * row's unit cell already holds another unit, so the row cannot hold it too.
   */
  const figureFor = (field: DisclosureField, decimal: string, placement: TemplatePlacement, at: TemplateCell, dimension: string): string | null => {
    const unit = unitOfPlacement(placement);
    const stored = unitOf(field);
    if (unit === null) return rounded(field, decimal);
    if (unit.perRow) {
      if (stored === null) {
        note(field, dimension, at, { kind: WORKBOOK_NOTE.NO_UNIT, figure: figureOf(field, decimal, null) });
        return decimal;
      }
      const listed = map.lists[unit.list]?.[stored];
      if (listed === undefined) throw new Error(`the unit list ${unit.list} holds no ${stored}`);
      const unitAt = offsetCell(unit.at, { row: 'name' in at ? (at.row ?? 0) : 0 });
      const already = rowUnits.get(cellKey(unitAt));
      if (already !== undefined && already !== stored) return null;
      if (already === undefined) {
        rowUnits.set(cellKey(unitAt), stored);
        write(unitAt, text(listed));
      }
      return rounded(field, decimal);
    }
    const placed = placedUnits.get(cellKey(unit.at)) ?? null;
    if (stored === null) {
      if (placed !== null) note(field, dimension, at, { kind: WORKBOOK_NOTE.NO_UNIT, figure: figureOf(field, decimal, null) });
      return decimal;
    }
    if (placed === null || placed === stored || !isConvertible(stored)) return rounded(field, decimal);
    note(field, dimension, at, { kind: WORKBOOK_NOTE.CONVERTED, figure: figureOf(field, decimal), written: placed });
    return rounded(field, convertFigure({ value: decimal, from: stored, to: placed }), placed);
  };

  // ── Every field ────────────────────────────────────────────────────────────────────────────────────────────────
  /** The cells two elements share — B7's mass and volume — and which element took each first. */
  const sharedCells = new Map<string, string>();
  /** Every field answered, as the template's own yes/no questions read them. */
  const heldAnswers: HeldAnswers[] = [];

  for (const field of written) {
    const holding = held.get(field) ?? { kind: FIELD_HOLDING.NOTHING };
    if (holding.kind === FIELD_HOLDING.NOTHING) continue;
    const placement = placementOf(field);
    const place = placeOf(field);

    if (holding.kind === FIELD_HOLDING.NOT_AVAILABLE) {
      const where = place?.at ?? firstCellOf(placement);
      if (where !== null) note(field, place?.dimension ?? field.dimensionKey, where, { kind: WORKBOOK_NOTE.NOT_AVAILABLE, reason: holding.reason });
      continue;
    }
    const answers = holding.answers;
    heldAnswers.push({ elementKey: field.elementKey, dimensionKey: field.dimensionKey, answers });

    switch (placement.kind) {
      case TEMPLATE_PLACEMENT.OMISSION: {
        const boxes = new Map<string, TemplateCell>();
        for (const answer of answers) {
          const member = memberOf(answer).replace(/^[a-z0-9]+:/u, '');
          const cells = map.omission[member];
          if (cells === undefined) throw new Error(`no ToC checkbox stands for the omission ${member}`);
          cells.forEach((cell) => boxes.set(cellKey(cell), cell));
        }
        boxes.forEach((cell) => write(cell, { kind: CELL_VALUE_KIND.BOOLEAN, value: true }));
        continue;
      }
      case TEMPLATE_PLACEMENT.LIST: {
        const unlisted: string[] = [];
        let row = 0;
        for (const answer of answers) {
          const value = cellValueOf({ encoding: placement.encoding, answer, lists: map.lists });
          if (isUnlisted(value)) {
            const label = optionLabel(field, value.unlisted);
            if (label !== '') unlisted.push(label);
            continue;
          }
          if (row >= placement.rows) throw new Error(`${field.elementKey} holds ${placement.rows} rows, and the report chooses more`);
          write(offsetCell(placement.at, { row }), value);
          row += 1;
        }
        if (unlisted.length > 0) note(field, '', placement.at, { kind: WORKBOOK_NOTE.NOT_LISTED, members: unlisted });
        continue;
      }
      case TEMPLATE_PLACEMENT.COLUMNS: {
        for (const answer of answers) {
          const member = memberOf(answer);
          const column = placement.columns[member];
          if (column === undefined) throw new Error(`${field.elementKey} has no column for ${member}`);
          const value = cellValueOf({ encoding: placement.encoding, answer: { yes: true }, lists: map.lists });
          if (!isUnlisted(value)) write(offsetCell(placement.at, { column }), value);
        }
        continue;
      }
      case TEMPLATE_PLACEMENT.COMPUTED: {
        if (!placement.derived && place !== null) ownFigure(field, answers[0], place);
        // The template computes the figure and still asks its unit — B7's waste totals (row (b)).
        const stored = unitOf(field);
        if (placement.unit !== undefined && stored !== null && map.lists[placement.unit.list]?.[stored] !== undefined) {
          write(placement.unit.at, text(map.lists[placement.unit.list][stored]));
        }
        continue;
      }
      case TEMPLATE_PLACEMENT.MEMBERS:
        if (place === null) throw new Error(`template ${map.templateVersion} has no cell for ${field.elementKey} ${field.dimensionKey}`);
        if (placement.computed.includes(field.dimensionKey)) {
          if (!placement.derived) ownFigure(field, answers[0], place);
          continue;
        }
        writeAnswer(field, placement, answers[0], place);
        continue;
      case TEMPLATE_PLACEMENT.CELL:
      case TEMPLATE_PLACEMENT.ROWS:
        if (place === null) continue;
        writeAnswer(field, placement, answers[0], place);
        continue;
    }
  }

  function ownFigure(field: DisclosureField, answer: WorkbookAnswer, place: { readonly at: TemplateCell; readonly dimension: string }): void {
    if (!('number' in answer)) return;
    note(field, place.dimension, place.at, { kind: WORKBOOK_NOTE.OWN_FIGURE, figure: figureOf(field, answer.number) });
  }

  function writeAnswer(
    field: DisclosureField,
    placement: TemplatePlacement & { readonly encoding: CellValueEncoding },
    answer: WorkbookAnswer,
    place: { readonly at: TemplateCell; readonly dimension: string },
  ): void {
    const key = cellKey(place.at);
    const taken = sharedCells.get(key);
    if (taken !== undefined && taken !== field.elementKey) {
      // The template has one cell where the platform holds two figures — the second is stated beside the first.
      if ('number' in answer) note(field, place.dimension, place.at, { kind: WORKBOOK_NOTE.ALSO, figure: figureOf(field, answer.number) });
      return;
    }
    const figure = 'number' in answer ? figureFor(field, answer.number, placement, place.at, place.dimension) : null;
    if ('number' in answer && figure === null) {
      // The row's unit cell already says another unit — the figure is stated beside the row instead.
      note(field, place.dimension, place.at, { kind: WORKBOOK_NOTE.ALSO, figure: figureOf(field, answer.number) });
      return;
    }
    sharedCells.set(key, field.elementKey);
    const decimal = figure === null ? answer : { number: figure };
    const value = cellValueOf({ encoding: placement.encoding, answer: decimal, lists: map.lists });
    if (isUnlisted(value)) throw new Error(`EFRAG's list for ${field.elementKey} holds no string for ${value.unlisted}`);
    write(place.at, value);
    if (field.origin === DISCLOSURE_ORIGIN.OVERRIDDEN && 'number' in answer) {
      note(field, place.dimension, place.at, {
        kind: WORKBOOK_NOTE.OVERRIDE,
        figure: figureOf(field, answer.number),
        superseded: sources.run?.results.get(field.elementKey) ?? null,
        reason: field.explanation,
        person: field.overriddenBy?.name ?? null,
      });
    }
    const factorSet = sources.run?.factorSet ?? null;
    if (factorSet !== null && sources.run?.results.has(field.elementKey) === true) {
      note(field, place.dimension, place.at, { kind: WORKBOOK_NOTE.FACTOR_SET, label: factorSet });
    }
  }

  // ── Findings, inputs, gates and the statement ──────────────────────────────────────────────────────────────────
  const byAddress = new Map(written.map((field) => [`${field.elementKey}|${field.dimensionKey}|${field.ordinal}`, field]));
  for (const finding of sources.findings ?? []) {
    // The entity's IDNO, which the record answers and no disclosure holds, is noted on the template's identifier cell —
    // the cell it would be written in (task 210; §12.5.6's task-210 row (e)).
    if (finding.field.elementKey === ENTITY_FIELD.IDNO) {
      note(finding.field, '', map.report.identifier, { kind: WORKBOOK_NOTE.FINDING, message: finding.message, params: finding.params });
      continue;
    }
    const field = byAddress.get(`${finding.field.elementKey}|${finding.field.dimensionKey}|${finding.field.ordinal}`);
    if (field === undefined) continue;
    const place = placeOf(field);
    const where = place?.at ?? firstCellOf(placementOf(field));
    if (where !== null) {
      note(field, place?.dimension ?? field.dimensionKey, where, { kind: WORKBOOK_NOTE.FINDING, message: finding.message, params: finding.params });
    }
  }

  // An input is written only where the figure it derives is: one the standard does not ask of this undertaking — B10's
  // pay gap below 150 employees (FR-28) — is not printed by the PDF, and its inputs would have the template compute it.
  const writtenElements = new Set(written.map((field) => field.elementKey));
  for (const input of sources.inputs) {
    const at = map.inputs[input.key];
    if (input.value !== null && at !== undefined && writtenElements.has(input.derives)) write(at, number(input.value));
  }

  for (const gate of map.gates) {
    if (gateIsAffirmed({ gate, held: heldAnswers })) write(gate.at, { kind: CELL_VALUE_KIND.BOOLEAN, value: true });
  }

  if (sources.labelStanding === LABEL_STANDING.PLATFORM_AUTHORED) {
    const statement = map.elements[ALWAYS_REPORTED];
    if (statement?.kind !== TEMPLATE_PLACEMENT.CELL) throw new Error(`template ${map.templateVersion} has no cell for ${ALWAYS_REPORTED}`);
    notes.push({ element: ALWAYS_REPORTED, dimension: '', at: statement.at, says: { kind: WORKBOOK_NOTE.LABELS } });
  }

  return { writes: [...writes.values()], notes, facts: sources.facts };
}

type CellValueEncoding = Extract<TemplatePlacement, { readonly encoding: unknown }>['encoding'];

/** One spelling of a cell, so a cell written twice under one spelling is caught here rather than by the package. */
const cellKey = (at: TemplateCell): string =>
  'name' in at ? `${at.name}[${at.row ?? 0},${at.column ?? 0}]` : `${at.sheet}!${at.cell}`;

/** The first cell an element's placement names — where a note goes when its own row cannot be told. */
function firstCellOf(placement: TemplatePlacement): TemplateCell | null {
  switch (placement.kind) {
    case TEMPLATE_PLACEMENT.MEMBERS:
      return Object.values(placement.cells)[0] ?? null;
    case TEMPLATE_PLACEMENT.OMISSION:
      return null;
    default:
      return placement.at;
  }
}

const memberOf = (answer: WorkbookAnswer): string => {
  if (!('member' in answer)) throw new Error('a set holds members');
  return answer.member;
};

/**
 * A member as the reader's language names it — the field's own option label, its code where it has no label, and
 * nothing where it has neither: a member's key is an internal identifier no reader is shown.
 */
const optionLabel = (field: Pick<DisclosureField, 'options'>, member: string): string => {
  const option = field.options?.find((candidate) => candidate.value === member);
  return option?.label ?? option?.code ?? '';
};

/**
 * A figure the platform calculated or derived, or one replacing a calculated figure — written exact, so the template's
 * formulas compute from what the platform computed and EFRAG's own formats show it at the PDF's digits (row (10)). The
 * wizard's rule for a figure it shows rounded (task 39.3).
 */
const isComputed = (field: Pick<DisclosureField, 'derived' | 'origin'>): boolean =>
  field.derived || field.origin !== DISCLOSURE_ORIGIN.REPORTED;
