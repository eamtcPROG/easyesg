import { posix } from 'node:path';
import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import { attributeOf, readAttributes, startTags } from './xml-text.js';

/** Where a workbook's parts are, as its own relationships say — never as a convention assumes. */
export interface WorkbookParts {
  /** The workbook part, `xl/workbook.xml` in every Excel file and still read rather than assumed. */
  readonly workbook: string;
  /** The workbook part's relationships, which name its sheets, its calc chain and the rest. */
  readonly relationships: string;
  /** Each worksheet's name, as the workbook spells it, to its part. Chart sheets hold no cells and are not here. */
  readonly sheets: ReadonlyMap<string, string>;
}

const RELATIONSHIP_TYPE = {
  OFFICE_DOCUMENT: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  WORKSHEET: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
} as const;
const RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const ROOT_RELATIONSHIPS = '_rels/.rels';

const refuse = (message: string): never => {
  throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK, message);
};

/**
 * Follows the package's relationships to the workbook and its worksheets (ECMA-376 Part 2, OPC).
 *
 * `read` answers a part's text, or `null` where the archive has no such part. The sheet's relationship attribute is
 * read under whatever prefix the workbook binds to the relationships namespace — `r:` in every file Excel writes, and
 * still read from the declaration, because a prefix is the document's choice.
 */
export function locateWorkbookParts(read: (part: string) => string | null): WorkbookParts {
  const rootRelationships = read(ROOT_RELATIONSHIPS) ?? refuse('the package has no root relationships');
  const workbook = targetOf(rootRelationships, RELATIONSHIP_TYPE.OFFICE_DOCUMENT, '') ?? refuse('no office document');
  const relationships = relationshipsPartOf(workbook);

  const workbookXml = read(workbook) ?? refuse(`the workbook part ${workbook} is missing`);
  const relationshipsXml = read(relationships) ?? refuse(`the workbook's relationships ${relationships} are missing`);

  const rootTag = startTags(workbookXml, 'workbook')[0]?.tag ?? refuse('the workbook part has no workbook element');
  const prefix =
    readAttributes(rootTag).find((attribute) => attribute.name.startsWith('xmlns:') && attribute.value === RELATIONSHIPS_NAMESPACE)
      ?.name.slice('xmlns:'.length) ?? refuse('the workbook binds no prefix to the relationships namespace');

  const worksheetTargets = new Map(
    startTags(relationshipsXml, 'Relationship')
      .filter(({ tag }) => attributeOf(tag, 'Type') === RELATIONSHIP_TYPE.WORKSHEET)
      .map(({ tag }) => [attributeOf(tag, 'Id') ?? '', resolveTarget(posix.dirname(workbook), attributeOf(tag, 'Target') ?? '')]),
  );

  const sheets = new Map<string, string>();
  for (const { tag } of startTags(workbookXml, 'sheet')) {
    const name = attributeOf(tag, 'name') ?? refuse('a sheet has no name');
    const part = worksheetTargets.get(attributeOf(tag, `${prefix}:id`) ?? '');
    if (part !== undefined) sheets.set(name, part);
  }
  return { workbook, relationships, sheets };
}

/** `xl/workbook.xml` keeps its relationships at `xl/_rels/workbook.xml.rels`. */
export function relationshipsPartOf(part: string): string {
  return posix.join(posix.dirname(part), '_rels', `${posix.basename(part)}.rels`);
}

/** The target of the first relationship of a type, resolved against the source part's directory. */
export function targetOf(relationshipsXml: string, type: string, base: string): string | null {
  const tag = startTags(relationshipsXml, 'Relationship').find(({ tag: candidate }) => attributeOf(candidate, 'Type') === type)?.tag;
  const target = tag === undefined ? null : attributeOf(tag, 'Target');
  return target === null ? null : resolveTarget(base, target);
}

/** A relationship target as a part name: relative to the source's directory, or rooted where it starts with `/`. */
export function resolveTarget(base: string, target: string): string {
  return target.startsWith('/') ? posix.normalize(target).slice(1) : posix.normalize(posix.join(base, target));
}
