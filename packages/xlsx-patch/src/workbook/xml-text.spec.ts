import { describe, expect, it } from 'vitest';
import { attributeOf, escapeXml, readAttributes, startTags, unescapeXml } from './xml-text.js';

describe('the XML this package reads without a parser', () => {
  it('reads a tag’s attributes, decoded, with their raw text kept for re-emission', () => {
    expect(readAttributes(`<c r="E282" s='57' xr:uid="{A&amp;B}"/>`)).toEqual([
      { name: 'r', value: 'E282', raw: 'r="E282"' },
      { name: 's', value: '57', raw: "s='57'" },
      { name: 'xr:uid', value: '{A&B}', raw: 'xr:uid="{A&amp;B}"' },
    ]);
    expect(attributeOf('<sheet name="Table of Contents &amp; Validation"/>', 'name')).toBe('Table of Contents & Validation');
    expect(attributeOf('<sheet name="x"/>', 'state')).toBeNull();
  });

  it('decodes the predefined entities and character references, and leaves anything else alone', () => {
    expect(unescapeXml('&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos; &#65;&#x42; &nbsp;')).toBe(`<a> & "b" 'c' AB &nbsp;`);
  });

  it('escapes what element content and a double-quoted attribute cannot hold', () => {
    expect(escapeXml(`a & <b> "c" 'd'`)).toBe(`a &amp; &lt;b&gt; &quot;c&quot; 'd'`);
  });

  it('finds an element’s start tags and not a longer element sharing its prefix', () => {
    const xml = '<sheets><sheet name="a"/><sheet name="b"></sheet></sheets><sheetPr/>';
    expect(startTags(xml, 'sheet').map(({ tag }) => attributeOf(tag, 'name'))).toEqual(['a', 'b']);
    expect(startTags(xml, 'sheets')).toHaveLength(1);
  });
});
