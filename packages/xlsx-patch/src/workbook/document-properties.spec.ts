import { describe, expect, it } from 'vitest';
import { PATCH_REFUSAL } from '../patch-refusal.js';
import { refusalOf } from '../testing/refusal-of.js';
import { withApplication, withCoreProperties } from './document-properties.js';

/** EFRAG's `1.3.0` core properties, as the binary carries them. */
const CORE =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" ' +
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title></dc:title><dc:creator>Richard Boessen</dc:creator>' +
  '<cp:lastModifiedBy>Sergio Carosio</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2025-01-13T10:12:12Z</dcterms:created>' +
  '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-10T12:19:37Z</dcterms:modified></cp:coreProperties>';

describe('the file’s own properties (task 46)', () => {
  it('names the application that wrote the file, and changes nothing else of the part', () => {
    const app = '<Properties xmlns="x"><Application>Microsoft Excel</Application><DocSecurity>0</DocSecurity></Properties>';
    expect(withApplication(app, 'EasyESG & Co')).toBe('<Properties xmlns="x"><Application>EasyESG &amp; Co</Application><DocSecurity>0</DocSecurity></Properties>');
    expect(refusalOf(() => withApplication('<Properties/>', 'EasyESG'))).toBe(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK);
  });

  it('replaces the modifier and the moment where the part holds them, adds the language where it does not, and keeps the rest', () => {
    const patched = withCoreProperties(CORE, {
      language: 'ro',
      lastModifiedBy: 'Ana <Popescu>',
      modified: new Date(Date.UTC(2026, 9, 11, 14, 30, 5, 678)),
    });
    expect(patched).toBe(
      CORE.replace('<cp:lastModifiedBy>Sergio Carosio</cp:lastModifiedBy>', '<cp:lastModifiedBy>Ana &lt;Popescu&gt;</cp:lastModifiedBy>')
        .replace('<dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-10T12:19:37Z</dcterms:modified>', '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-11T14:30:05Z</dcterms:modified>')
        .replace('</cp:coreProperties>', '<dc:language>ro</dc:language></cp:coreProperties>'),
    );
    // EFRAG's own authorship stays as EFRAG wrote it.
    expect(patched).toContain('<dc:creator>Richard Boessen</dc:creator>');
  });

  it('leaves an element it is not given as it was', () => {
    expect(withCoreProperties(CORE, {})).toBe(CORE);
  });

  it('refuses a part that binds no prefix it would have to write under', () => {
    const unprefixed = '<coreProperties xmlns="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"></coreProperties>';
    expect(refusalOf(() => withCoreProperties(unprefixed, { language: 'en' }))).toBe(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK);
  });
});
