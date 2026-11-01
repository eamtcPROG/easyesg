import { describe, expect, it } from 'vitest';
import { PATCH_REFUSAL } from '../patch-refusal.js';
import { readPart } from '../read-part.js';
import { COMMITTED_TEMPLATE, committedTemplate } from '../testing/committed-templates.js';
import { refusalOf } from '../testing/refusal-of.js';
import { NOTE_PART, sheetNotes, withNoteContentTypes } from './cell-notes.js';
import { attributeOf, startTags } from './xml-text.js';

/** `1.2.0`'s General Information sheet — the template with no Footnotes sheet, which is the only one notes reach. */
const template = committedTemplate(COMMITTED_TEMPLATE.V1_2_0);
const SHEET = 'xl/worksheets/sheet3.xml';
const sheetXml = readPart(template, SHEET) ?? '';
const relationshipsXml = readPart(template, 'xl/worksheets/_rels/sheet3.xml.rels');

const patch = () =>
  sheetNotes({
    sheet: 'General Information',
    sheetPart: SHEET,
    sheetXml,
    relationshipsXml,
    notes: [
      { cell: { column: 5, row: 283 }, text: 'Second, by position: R&D <costs> excluded\r\nnext line' },
      { cell: { column: 5, row: 282 }, text: 'First' },
    ],
    author: 'EasyESG',
    index: 1,
  });

describe('notes on a sheet’s cells (task 46; task-46 row (9))', () => {
  it('places its legacy drawing straight after the sheet’s own drawing, as the schema orders them, and changes nothing else', () => {
    const { sheetXml: patched } = patch();
    const drawing = startTags(sheetXml, 'drawing')[0];
    const after = drawing.index + drawing.tag.length;
    const legacy = startTags(patched, 'legacyDrawing')[0];
    expect(legacy.index).toBe(after);
    expect(patched.slice(0, after) + patched.slice(after + legacy.tag.length)).toBe(sheetXml);
  });

  it('relates the comments and the drawing from the sheet under ids the sheet has not used', () => {
    const { relationshipsXml: patched, sheetXml: patchedSheet } = patch();
    const before = startTags(relationshipsXml ?? '', 'Relationship').map(({ tag }) => attributeOf(tag, 'Id'));
    const added = startTags(patched, 'Relationship').slice(before.length).map(({ tag }) => tag);
    expect(added.map((tag) => attributeOf(tag, 'Type'))).toEqual([NOTE_PART.COMMENTS_RELATIONSHIP, NOTE_PART.DRAWING_RELATIONSHIP]);
    expect(added.map((tag) => attributeOf(tag, 'Target'))).toEqual(['../comments1.xml', '../drawings/vmlDrawing1.vml']);
    for (const tag of added) expect(before).not.toContain(attributeOf(tag, 'Id'));
    expect(attributeOf(startTags(patchedSheet, 'legacyDrawing')[0].tag, 'r:id')).toBe(attributeOf(added[1], 'Id'));
  });

  it('writes each note in reading order, its text as a cell’s text is written', () => {
    const { comments, drawing } = patch();
    expect(comments.part).toBe('xl/comments1.xml');
    expect(comments.xml).toContain('<authors><author>EasyESG</author></authors>');
    expect(comments.xml.indexOf('ref="E282"')).toBeLessThan(comments.xml.indexOf('ref="E283"'));
    expect(comments.xml).toContain('R&amp;D &lt;costs&gt; excluded_x000D_\nnext line');
    expect(drawing.part).toBe('xl/drawings/vmlDrawing1.vml');
    expect(drawing.xml).toContain('<x:Row>281</x:Row><x:Column>4</x:Column>');
    expect(drawing.xml).toContain('<o:idmap v:ext="edit" data="1"/>');
  });

  it('refuses a sheet that already carries a legacy drawing, rather than merging into one it did not write', () => {
    const run = () => sheetNotes({ sheet: 'x', sheetPart: SHEET, sheetXml: patch().sheetXml, relationshipsXml, notes: [], author: 'a', index: 2 });
    expect(refusalOf(run)).toBe(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK);
  });

  it('declares the VML extension once and each comments part by name', () => {
    const contentTypes = readPart(template, '[Content_Types].xml') ?? '';
    const once = withNoteContentTypes(contentTypes, ['xl/comments1.xml', 'xl/comments2.xml']);
    const twice = withNoteContentTypes(once, []);
    expect(twice).toBe(once);
    expect(startTags(once, 'Default').filter(({ tag }) => attributeOf(tag, 'Extension') === 'vml')).toHaveLength(1);
    expect(once).toContain(`<Override PartName="/xl/comments2.xml" ContentType="${NOTE_PART.COMMENTS_CONTENT_TYPE}"/>`);
  });
});
