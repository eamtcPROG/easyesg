/**
 * An article section's body read as the small Markdown subset task 76 publishes (task 77; `architecture.md` §12.5.6's
 * task-76 row (2) and task-77 row (12)) — paragraphs, `- ` lists, `**strong**`, `*emphasis*` and `[a link](/path)`.
 * **Read here, with no library**: the subset is the whole of what the store admits, so a parser for all of Markdown
 * would be a dependency rendering syntax nobody may write. **Nothing becomes HTML**: the result is data the article
 * renders as React elements, so a stray `<` is text, and any other syntax reads as the characters it is.
 *
 * **A link goes to a path in this application or an `https:` address**, nothing else — a `javascript:` or a
 * protocol-relative `//` target is not a link, and its text is shown as written.
 */

export const INLINE = {
  TEXT: 'text',
  STRONG: 'strong',
  EMPHASIS: 'emphasis',
  LINK: 'link',
} as const;

export type Inline =
  | { readonly kind: typeof INLINE.TEXT; readonly text: string }
  | { readonly kind: typeof INLINE.STRONG; readonly children: readonly Inline[] }
  | { readonly kind: typeof INLINE.EMPHASIS; readonly children: readonly Inline[] }
  | {
      readonly kind: typeof INLINE.LINK;
      readonly href: string;
      /** An `https:` address, opened as one; otherwise a path in this application, in the reader's language. */
      readonly external: boolean;
      readonly children: readonly Inline[];
    };

export const BLOCK = {
  PARAGRAPH: 'paragraph',
  LIST: 'list',
} as const;

export type Block =
  | { readonly kind: typeof BLOCK.PARAGRAPH; readonly inlines: readonly Inline[] }
  | { readonly kind: typeof BLOCK.LIST; readonly items: readonly (readonly Inline[])[] };

const LIST_ITEM = /^\s*-\s+/u;

/** A body's blocks: separated by a blank line, a block whose every line opens `- ` being a list. */
export const markdownBlocks = (body: string): Block[] =>
  body
    .split(/\n\s*\n/u)
    .map((chunk) => chunk.split('\n').filter((line) => line.trim() !== ''))
    .filter((lines) => lines.length > 0)
    .map((lines): Block =>
      lines.every((line) => LIST_ITEM.test(line))
        ? { kind: BLOCK.LIST, items: lines.map((line) => markdownInlines(line.replace(LIST_ITEM, ''))) }
        : { kind: BLOCK.PARAGRAPH, inlines: markdownInlines(lines.map((line) => line.trim()).join(' ')) },
    );

/** A path in this application: `/`, never `//` or `/\`, which a browser reads as another host. */
const APP_PATH = /^\/(?![/\\])/u;
const HTTPS_ADDRESS = /^https:\/\/[^\s]+$/u;

/** Where a link may go: a path in this application or an `https:` address. */
const linkTarget = (href: string): { readonly href: string; readonly external: boolean } | null => {
  if (APP_PATH.test(href)) return { href, external: false };
  if (HTTPS_ADDRESS.test(href)) return { href, external: true };
  return null;
};

/** The subset's inline marks — `**strong**`, `*emphasis*`, `[a link](/path)` — and nothing else is one. */
const MARK = {
  STRONG: '**',
  EMPHASIS: '*',
  LINK_TEXT: '[',
  LINK_TARGET: '](',
  LINK_END: ')',
} as const;

/** A run of text with its inline marks read, left to right; an unclosed mark is the characters it is. */
export const markdownInlines = (text: string): Inline[] => {
  const inlines: Inline[] = [];
  let plain = '';
  const flush = () => {
    if (plain !== '') inlines.push({ kind: INLINE.TEXT, text: plain });
    plain = '';
  };

  let at = 0;
  while (at < text.length) {
    if (text.startsWith(MARK.STRONG, at)) {
      const from = at + MARK.STRONG.length;
      const end = text.indexOf(MARK.STRONG, from);
      if (end > from) {
        flush();
        inlines.push({ kind: INLINE.STRONG, children: markdownInlines(text.slice(from, end)) });
        at = end + MARK.STRONG.length;
        continue;
      }
    } else if (text.startsWith(MARK.EMPHASIS, at)) {
      const from = at + MARK.EMPHASIS.length;
      const end = text.indexOf(MARK.EMPHASIS, from);
      // A closing mark that opens a strong one is not this emphasis's end.
      if (end > from && !text.startsWith(MARK.STRONG, end)) {
        flush();
        inlines.push({ kind: INLINE.EMPHASIS, children: markdownInlines(text.slice(from, end)) });
        at = end + MARK.EMPHASIS.length;
        continue;
      }
    } else if (text.startsWith(MARK.LINK_TEXT, at)) {
      const from = at + MARK.LINK_TEXT.length;
      const close = text.indexOf(MARK.LINK_TARGET, from);
      const href = close === -1 ? -1 : close + MARK.LINK_TARGET.length;
      const end = href === -1 ? -1 : text.indexOf(MARK.LINK_END, href);
      const target = end === -1 ? null : linkTarget(text.slice(href, end));
      if (close > from && target !== null) {
        flush();
        inlines.push({ kind: INLINE.LINK, ...target, children: markdownInlines(text.slice(from, close)) });
        at = end + MARK.LINK_END.length;
        continue;
      }
    }
    plain += text[at];
    at += 1;
  }
  flush();
  return inlines;
};
