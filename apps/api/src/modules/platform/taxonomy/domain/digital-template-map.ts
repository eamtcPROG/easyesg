import { CELL_TARGET } from '@easyesg/xlsx-patch';
import {
  type DigitalTemplateMap,
  TEMPLATE_ENCODING,
  TEMPLATE_GATE,
  TEMPLATE_GROUP,
  TEMPLATE_NOTES,
  TEMPLATE_PLACEMENT,
  type TemplateCell,
  type TemplateDay,
  type TemplateEncoding,
  type TemplateGateAnswer,
  type TemplateGroup,
  type TemplateNotes,
  type TemplatePlacement,
  type TemplateUnit,
} from '@api/contracts/digital-template-map';

/**
 * The `vsme_digital_template_map` payload, read (task 46.1; `architecture.md` §12.5.6's task-46 row (1)).
 *
 * **Read whole or not at all**, as the registration it belongs to is: a map with one placement wrong answers `null`,
 * the registry treats the template as having none, and publication refuses the same payload — so a broken map is
 * stopped where its operator is present, never found by an export writing a figure into the wrong cell. **Every
 * reference inside it must resolve too**: a placement's table, an encoding's list and a unit's list are names within the
 * map, and a name that names nothing is a map no export could follow.
 */
export function readDigitalTemplateMap(payload: unknown): DigitalTemplateMap | null {
  try {
    return mapOf(payload);
  } catch (error) {
    if (error instanceof Unreadable) return null;
    throw error;
  }
}

/** Why a payload is not a map, or `null` — the reader's own verdict, so publication and reading agree. */
export function digitalTemplateMapShapeRefusal(payload: unknown): string | null {
  try {
    mapOf(payload);
    return null;
  } catch (error) {
    if (error instanceof Unreadable) return `a Digital Template map is the extractor's output, read whole: ${error.message}`;
    throw error;
  }
}

/** A part of the payload that is not what a map holds there. Internal: the reader answers `null`, the refusal a reason. */
class Unreadable extends Error {}

const TEMPLATE_VERSION = /^\d+\.\d+\.\d+$/;
const TAXONOMY_VERSION = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.xlsx$/;
const A1 = /^[A-Z]{1,3}[1-9]\d{0,6}$/;
const GATE_ANSWERS: ReadonlySet<unknown> = new Set(Object.values(TEMPLATE_GATE));

const record = (value: unknown, where: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Unreadable(`${where} is not an object`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, where: string, pattern?: RegExp): string => {
  if (typeof value !== 'string' || value === '' || (pattern !== undefined && !pattern.test(value))) {
    throw new Unreadable(`${where} is not ${pattern === undefined ? 'text' : `of the form ${String(pattern)}`}`);
  }
  return value;
};
const count = (value: unknown, where: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Unreadable(`${where} is not a count`);
  return value;
};
const positive = (value: unknown, where: string): number => {
  const n = count(value, where);
  if (n === 0) throw new Unreadable(`${where} is zero`);
  return n;
};
const flag = (value: unknown, where: string): boolean => {
  if (typeof value !== 'boolean') throw new Unreadable(`${where} is not true or false`);
  return value;
};
const texts = (value: unknown, where: string): string[] => {
  if (!Array.isArray(value)) throw new Unreadable(`${where} is not a list`);
  return value.map((item, index) => text(item, `${where}[${index}]`));
};
/** A dimension as the store holds it — a member's key, or `''` for the undimensioned figure (§7.3). */
const dimensions = (value: unknown, where: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Unreadable(`${where} is not a list of dimensions`);
  return value as string[];
};
const entries = <T>(value: unknown, where: string, each: (item: unknown, at: string) => T): Record<string, T> =>
  Object.fromEntries(Object.entries(record(value, where)).map(([key, item]) => [key, each(item, `${where}.${key}`)]));

function cellOf(value: unknown, where: string): TemplateCell {
  const raw = record(value, where);
  if ('name' in raw) {
    const offset = (key: 'row' | 'column') => (raw[key] === undefined ? {} : { [key]: count(raw[key], `${where}.${key}`) });
    return { kind: CELL_TARGET.NAMED, name: text(raw.name, `${where}.name`), ...offset('row'), ...offset('column') };
  }
  return { kind: CELL_TARGET.ADDRESS, sheet: text(raw.sheet, `${where}.sheet`), cell: text(raw.cell, `${where}.cell`, A1) };
}

function encodingOf(value: unknown, where: string, lists: ReadonlySet<string>): TemplateEncoding {
  const raw = record(value, where);
  switch (raw.as) {
    case TEMPLATE_ENCODING.NUMBER:
    case TEMPLATE_ENCODING.TEXT:
    case TEMPLATE_ENCODING.BOOLEAN:
      return { as: raw.as };
    case TEMPLATE_ENCODING.WORDS:
      return { as: raw.as, true: text(raw.true, `${where}.true`), false: text(raw.false, `${where}.false`) };
    case TEMPLATE_ENCODING.LIST:
      return { as: raw.as, list: listName(raw.list, `${where}.list`, lists) };
    default:
      throw new Unreadable(`${where}.as is no encoding`);
  }
}

function listName(value: unknown, where: string, lists: ReadonlySet<string>): string {
  const name = text(value, where);
  if (!lists.has(name)) throw new Unreadable(`${where} names ${name}, a list the map does not hold`);
  return name;
}

function unitOf(value: unknown, where: string, lists: ReadonlySet<string>): TemplateUnit | null {
  if (value === null) return null;
  const raw = record(value, where);
  return { at: cellOf(raw.at, `${where}.at`), list: listName(raw.list, `${where}.list`, lists), perRow: flag(raw.perRow, `${where}.perRow`) };
}

function placementOf(
  value: unknown,
  where: string,
  names: { readonly lists: ReadonlySet<string>; readonly groups: ReadonlySet<string> },
): TemplatePlacement {
  const raw = record(value, where);
  const group = (key: unknown) => {
    const name = text(key, `${where}.group`);
    if (!names.groups.has(name)) throw new Unreadable(`${where}.group names ${name}, a table the map does not hold`);
    return name;
  };
  switch (raw.kind) {
    case TEMPLATE_PLACEMENT.CELL:
      return {
        kind: raw.kind,
        at: cellOf(raw.at, `${where}.at`),
        encoding: encodingOf(raw.encoding, `${where}.encoding`, names.lists),
        unit: unitOf(raw.unit, `${where}.unit`, names.lists),
      };
    case TEMPLATE_PLACEMENT.MEMBERS: {
      const cells = entries(raw.cells, `${where}.cells`, cellOf);
      const computed = dimensions(raw.computed, `${where}.computed`);
      if (computed.some((member) => cells[member] === undefined)) throw new Unreadable(`${where} computes a member it has no cell for`);
      return {
        kind: raw.kind,
        cells,
        computed,
        derived: flag(raw.derived, `${where}.derived`),
        encoding: encodingOf(raw.encoding, `${where}.encoding`, names.lists),
      };
    }
    case TEMPLATE_PLACEMENT.ROWS:
      return {
        kind: raw.kind,
        group: group(raw.group),
        at: cellOf(raw.at, `${where}.at`),
        encoding: encodingOf(raw.encoding, `${where}.encoding`, names.lists),
        unit: unitOf(raw.unit, `${where}.unit`, names.lists),
      };
    case TEMPLATE_PLACEMENT.LIST:
      return {
        kind: raw.kind,
        at: cellOf(raw.at, `${where}.at`),
        rows: count(raw.rows, `${where}.rows`),
        encoding: encodingOf(raw.encoding, `${where}.encoding`, names.lists),
      };
    case TEMPLATE_PLACEMENT.COLUMNS:
      return {
        kind: raw.kind,
        at: cellOf(raw.at, `${where}.at`),
        columns: entries(raw.columns, `${where}.columns`, count),
        encoding: encodingOf(raw.encoding, `${where}.encoding`, names.lists),
      };
    case TEMPLATE_PLACEMENT.OMISSION:
      return { kind: raw.kind };
    case TEMPLATE_PLACEMENT.COMPUTED:
      return {
        kind: raw.kind,
        at: cellOf(raw.at, `${where}.at`),
        ...(raw.group === undefined ? {} : { group: group(raw.group) }),
        derived: flag(raw.derived, `${where}.derived`),
        ...(raw.unit === undefined ? {} : { unit: unitOf(raw.unit, `${where}.unit`, names.lists) ?? undefined }),
      };
    default:
      throw new Unreadable(`${where}.kind is no placement`);
  }
}

function groupOf(value: unknown, where: string, lists: ReadonlySet<string>): TemplateGroup {
  const raw = record(value, where);
  const axis = text(raw.axis, `${where}.axis`);
  const rows = count(raw.rows, `${where}.rows`);
  switch (raw.kind) {
    case TEMPLATE_GROUP.ORDINAL:
      return { kind: raw.kind, axis, rows };
    case TEMPLATE_GROUP.KEYED:
      return { kind: raw.kind, axis, key: cellOf(raw.key, `${where}.key`), rows };
    case TEMPLATE_GROUP.CLASSIFIED:
      return {
        kind: raw.kind,
        axis,
        member: cellOf(raw.member, `${where}.member`),
        list: listName(raw.list, `${where}.list`, lists),
        rows,
        ...(raw.qualify === undefined ? {} : { qualify: text(raw.qualify, `${where}.qualify`) }),
      };
    default:
      throw new Unreadable(`${where}.kind is no table`);
  }
}

function notesOf(value: unknown, where: string): TemplateNotes {
  const raw = record(value, where);
  if (raw.kind === TEMPLATE_NOTES.CELL_NOTES) return { kind: raw.kind };
  if (raw.kind !== TEMPLATE_NOTES.FOOTNOTES) throw new Unreadable(`${where}.kind is no kind of note`);
  return {
    kind: raw.kind,
    text: cellOf(raw.text, `${where}.text`),
    dimension: cellOf(raw.dimension, `${where}.dimension`),
    concept: cellOf(raw.concept, `${where}.concept`),
    rowsPerNote: positive(raw.rowsPerNote, `${where}.rowsPerNote`),
    capacity: positive(raw.capacity, `${where}.capacity`),
    labels: entries(raw.labels, `${where}.labels`, (label, at) => text(label, at)),
  };
}

const dayOf = (value: unknown, where: string): TemplateDay => {
  const raw = record(value, where);
  return { year: cellOf(raw.year, `${where}.year`), month: cellOf(raw.month, `${where}.month`), day: cellOf(raw.day, `${where}.day`) };
};

function mapOf(payload: unknown): DigitalTemplateMap {
  const raw = record(payload, 'the map');
  const lists = entries(raw.lists, 'lists', (list, where) => entries(list, where, (item, at) => text(item, at)));
  const listNames = new Set(Object.keys(lists));
  const groups = entries(raw.groups, 'groups', (group, where) => groupOf(group, where, listNames));
  const names = { lists: listNames, groups: new Set(Object.keys(groups)) };
  const template = record(raw.template, 'template');
  const language = record(raw.language, 'language');
  const report = record(raw.report, 'report');
  if (!Array.isArray(raw.gates)) throw new Unreadable('gates is not a list');
  const elements = entries(raw.elements, 'elements', (placement, where) => placementOf(placement, where, names));
  return {
    templateVersion: text(raw.templateVersion, 'templateVersion', TEMPLATE_VERSION),
    taxonomyVersion: text(raw.taxonomyVersion, 'taxonomyVersion', TAXONOMY_VERSION),
    template: { file: text(template.file, 'template.file', FILE_NAME), sha256: text(template.sha256, 'template.sha256', SHA256) },
    language: { at: cellOf(language.at, 'language.at'), value: text(language.value, 'language.value') },
    report: {
      entityName: cellOf(report.entityName, 'report.entityName'),
      identifierScheme: cellOf(report.identifierScheme, 'report.identifierScheme'),
      identifier: cellOf(report.identifier, 'report.identifier'),
      leiScheme: text(report.leiScheme, 'report.leiScheme'),
      currency: cellOf(report.currency, 'report.currency'),
      periodStart: dayOf(report.periodStart, 'report.periodStart'),
      periodEnd: dayOf(report.periodEnd, 'report.periodEnd'),
    },
    notes: notesOf(raw.notes, 'notes'),
    elements,
    groups,
    inputs: entries(raw.inputs, 'inputs', cellOf),
    gates: raw.gates.map((gate: unknown, index) => {
      const entry = record(gate, `gates[${index}]`);
      if (!GATE_ANSWERS.has(entry.answer)) throw new Unreadable(`gates[${index}].answer is no way of answering a gate`);
      const when = texts(entry.when, `gates[${index}].when`);
      const unplaced = when.find((elementKey) => elements[elementKey] === undefined);
      if (unplaced !== undefined) throw new Unreadable(`gates[${index}].when names ${unplaced}, an element the map places nowhere`);
      return { at: cellOf(entry.at, `gates[${index}].at`), when, answer: entry.answer as TemplateGateAnswer };
    }),
    omission: entries(raw.omission, 'omission', (cells, where) => {
      if (!Array.isArray(cells) || cells.length === 0) throw new Unreadable(`${where} sets no checkbox`);
      return cells.map((cell: unknown, index) => cellOf(cell, `${where}[${index}]`));
    }),
    lists,
  };
}
