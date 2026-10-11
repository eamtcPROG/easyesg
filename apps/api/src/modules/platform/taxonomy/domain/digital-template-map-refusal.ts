import { CELL_VALUE_KIND, type CellWrite, patchWorkbook, XlsxPatchRefusedError } from '@easyesg/xlsx-patch';
import {
  type DigitalTemplateMap,
  TEMPLATE_GROUP,
  TEMPLATE_NOTES,
  TEMPLATE_PLACEMENT,
  type TemplateCell,
} from '@api/contracts/digital-template-map';
import { digitalTemplateMapShapeRefusal, readDigitalTemplateMap } from './digital-template-map';

/**
 * Why a `vsme_digital_template_map` may not be published, or `null` (task 46.1; `architecture.md` §12.5.6's task-46
 * row (1)): **a map is refused unless every cell it says the export writes is one the template lets it write**.
 *
 * The check is the package's own: one patch writing every such cell of the binary the map was read from, so a name
 * EFRAG ships as `#REF!`, a cell the template computes, a cell under a merge and a name that does not exist are each
 * refused by the rule the export itself would meet — not by a second opinion that could disagree with it. A table's
 * column is checked at its first row, as EFRAG's tables are uniform down their length.
 *
 * **The binary is the caller's to find** (`binaryOf`), by the version and file the map names and the digest it was read
 * from: this module reads no disk, and a map whose binary is not in the release is refused with that reason.
 */
export function digitalTemplateMapRefusal(input: {
  readonly payload: unknown;
  readonly binaryOf: (map: Pick<DigitalTemplateMap, 'templateVersion' | 'template'>) => Uint8Array | null;
}): string | null {
  const shape = digitalTemplateMapShapeRefusal(input.payload);
  if (shape !== null) return shape;
  const map = readDigitalTemplateMap(input.payload);
  if (map === null) return 'a Digital Template map that cannot be read';

  const template = input.binaryOf(map);
  if (template === null) {
    return `the map was read from ${map.templateVersion}/${map.template.file} with SHA-256 ${map.template.sha256}, which this release does not hold`;
  }
  const writes: CellWrite[] = writableTargetsOf(map).map((at) => ({ at, value: { kind: CELL_VALUE_KIND.TEXT, value: 'x' } }));
  try {
    patchWorkbook({ template, writes });
    return null;
  } catch (error) {
    if (error instanceof XlsxPatchRefusedError) return `the map names a cell the export may not write: ${error.message}`;
    throw error;
  }
}

/** Every cell the map says the export writes — each once, a table's at its first row. */
export function writableTargetsOf(map: DigitalTemplateMap): readonly TemplateCell[] {
  const cells = new Map<string, TemplateCell>();
  const add = (cell: TemplateCell) => cells.set(JSON.stringify(cell), cell);

  add(map.language.at);
  const { report } = map;
  for (const cell of [report.entityName, report.identifierScheme, report.identifier, report.currency]) add(cell);
  for (const day of [report.periodStart, report.periodEnd]) for (const cell of [day.year, day.month, day.day]) add(cell);
  Object.values(map.inputs).forEach(add);
  map.gates.forEach((gate) => add(gate.at));
  Object.values(map.omission).forEach((boxes) => boxes.forEach(add));
  for (const group of Object.values(map.groups)) {
    if (group.kind === TEMPLATE_GROUP.KEYED) add(group.key);
    if (group.kind === TEMPLATE_GROUP.CLASSIFIED) add(group.member);
  }
  if (map.notes.kind === TEMPLATE_NOTES.FOOTNOTES) [map.notes.text, map.notes.dimension, map.notes.concept].forEach(add);

  for (const placement of Object.values(map.elements)) {
    switch (placement.kind) {
      case TEMPLATE_PLACEMENT.CELL:
      case TEMPLATE_PLACEMENT.ROWS:
      case TEMPLATE_PLACEMENT.LIST:
        add(placement.at);
        if ('unit' in placement && placement.unit !== null) add(placement.unit.at);
        break;
      case TEMPLATE_PLACEMENT.MEMBERS:
        for (const [member, cell] of Object.entries(placement.cells)) if (!placement.computed.includes(member)) add(cell);
        break;
      case TEMPLATE_PLACEMENT.COLUMNS:
        for (const column of Object.values(placement.columns)) add({ ...placement.at, ...('name' in placement.at ? { column } : {}) });
        break;
      case TEMPLATE_PLACEMENT.COMPUTED:
        if (placement.unit !== undefined) add(placement.unit.at);
        break;
      case TEMPLATE_PLACEMENT.OMISSION:
        break;
    }
  }
  return [...cells.values()];
}
