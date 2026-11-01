import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import { attributeOf, startTags } from './xml-text.js';

/**
 * The three edits that make a consumer recalculate a patched workbook when it opens it (AD-10).
 *
 * A written input leaves every formula reading it with a cached result computed from the old one. `fullCalcOnLoad`
 * tells the application to recompute everything on open, and the calc chain — Excel's record of the order it last
 * computed in — is dropped, so nothing reads an order written for a different workbook; Excel rebuilds it.
 *
 * **Dropping a part is three edits, not one**, which is where AD-10's "every other part byte for byte" needs its
 * qualification: the calc chain is named by the workbook's relationships and by the package's content types, and a
 * reference to a part that is gone is exactly what makes Excel offer to repair a file (NFR-20).
 */

export const CALC_CHAIN_RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain';

/** The workbook part with `fullCalcOnLoad="1"` on its `calcPr`, the rest of it untouched. */
export function withFullCalcOnLoad(workbookXml: string): string {
  const calcPr = startTags(workbookXml, 'calcPr')[0];
  if (calcPr === undefined) {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK, 'the workbook carries no calculation properties');
  }
  const tag = calcPr.tag;
  const rewritten =
    attributeOf(tag, 'fullCalcOnLoad') === null
      ? tag.replace(/\s*(\/?)>$/, ' fullCalcOnLoad="1"$1>')
      : tag.replace(/fullCalcOnLoad\s*=\s*(?:"[^"]*"|'[^']*')/, 'fullCalcOnLoad="1"');
  return workbookXml.slice(0, calcPr.index) + rewritten + workbookXml.slice(calcPr.index + tag.length);
}

/** A relationships part without its relationships of one type, and the targets they named. */
export function withoutRelationships(relationshipsXml: string, type: string): { readonly xml: string; readonly targets: readonly string[] } {
  const removed = startTags(relationshipsXml, 'Relationship').filter(({ tag }) => attributeOf(tag, 'Type') === type);
  return {
    xml: removed.reduceRight((xml, { tag, index }) => xml.slice(0, index) + xml.slice(elementEnd(xml, tag, index, 'Relationship')), relationshipsXml),
    targets: removed.map(({ tag }) => attributeOf(tag, 'Target') ?? ''),
  };
}

/** `[Content_Types].xml` without the override for one part — named as the package names it, `/xl/calcChain.xml`. */
export function withoutOverride(contentTypesXml: string, part: string): string {
  const removed = startTags(contentTypesXml, 'Override').filter(({ tag }) => attributeOf(tag, 'PartName') === `/${part}`);
  return removed.reduceRight((xml, { tag, index }) => xml.slice(0, index) + xml.slice(elementEnd(xml, tag, index, 'Override')), contentTypesXml);
}

/** Where an element ends: after its start tag when self-closing, after its end tag otherwise. */
function elementEnd(xml: string, tag: string, index: number, element: string): number {
  if (tag.endsWith('/>')) return index + tag.length;
  const close = `</${element}>`;
  return xml.indexOf(close, index) + close.length;
}
