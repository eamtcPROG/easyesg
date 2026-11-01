import { describe, expect, it } from 'vitest';
import { BLOCK, INLINE, markdownBlocks, markdownInlines } from './article-markdown';

const text = (value: string) => ({ kind: INLINE.TEXT, text: value });

describe('markdownBlocks (S-33; task 77)', () => {
  it('reads paragraphs separated by a blank line, a paragraph’s lines joined', () => {
    expect(markdownBlocks('Prima frază\ncontinuă aici.\n\nA doua.')).toEqual([
      { kind: BLOCK.PARAGRAPH, inlines: [text('Prima frază continuă aici.')] },
      { kind: BLOCK.PARAGRAPH, inlines: [text('A doua.')] },
    ]);
  });

  it('reads a block whose every line opens with a dash as a list', () => {
    expect(markdownBlocks('Două lucruri:\n\n- primul;\n- **al doilea**.')).toEqual([
      { kind: BLOCK.PARAGRAPH, inlines: [text('Două lucruri:')] },
      {
        kind: BLOCK.LIST,
        items: [[text('primul;')], [{ kind: INLINE.STRONG, children: [text('al doilea')] }, text('.')]],
      },
    ]);
  });

  it('keeps a block that only begins with a dash a paragraph', () => {
    expect(markdownBlocks('- un rând\nși continuarea lui')).toEqual([
      { kind: BLOCK.PARAGRAPH, inlines: [text('- un rând și continuarea lui')] },
    ]);
  });
});

describe('markdownInlines (S-33; task 77)', () => {
  it('reads strong, emphasis and a link, nested', () => {
    expect(markdownInlines('Citiți **[ghidul](/help/ghid)** acum, *pe scurt*.')).toEqual([
      text('Citiți '),
      {
        kind: INLINE.STRONG,
        children: [{ kind: INLINE.LINK, href: '/help/ghid', external: false, children: [text('ghidul')] }],
      },
      text(' acum, '),
      { kind: INLINE.EMPHASIS, children: [text('pe scurt')] },
      text('.'),
    ]);
  });

  it('opens an https address as one', () => {
    expect(markdownInlines('[EFRAG](https://www.efrag.org/vsme)')).toEqual([
      { kind: INLINE.LINK, href: 'https://www.efrag.org/vsme', external: true, children: [text('EFRAG')] },
    ]);
  });

  it.each([['javascript:alert(1)'], ['//evil.example'], ['/\\evil.example'], ['http://plain.example'], ['mailto:a@b.md']])(
    'shows a link to %s as the characters it is',
    (href) => {
      expect(markdownInlines(`[aici](${href})`)).toEqual([text(`[aici](${href})`)]);
    },
  );

  it('reads an unclosed mark as the characters it is, and HTML as text', () => {
    expect(markdownInlines('5 * 3 și **fără sfârșit')).toEqual([text('5 * 3 și **fără sfârșit')]);
    expect(markdownInlines('<b>nu</b>')).toEqual([text('<b>nu</b>')]);
  });
});
