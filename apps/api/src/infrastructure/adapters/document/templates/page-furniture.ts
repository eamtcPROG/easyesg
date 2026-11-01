import type { ReportDocument } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';
import { cssString } from './css-string';
import { moduleName } from './module-name';

/** A section's id as a CSS identifier — the anchors' own spelling, which only ever holds letters and digits. */
const identifier = (id: string): string => id.replace(/[^A-Za-z0-9-]/gu, '');

/** Placeholders the page counter's words are formatted around, then replaced by CSS counters — private-use code points,
 * which no catalogue sentence holds. */
const PAGE = '\uE000';
const PAGES = '\uE001';

/**
 * The page counter's words with the counters in them — *Page 4 of 18* — as a CSS `content` value: the locale's sentence
 * formatted around two placeholders, then each placeholder replaced by the counter it stands for.
 */
function counterContent(words: DocumentWords): string {
  const sentence = words.t('furniture.page', { page: PAGE, pages: PAGES });
  return sentence
    .split(/([\uE000\uE001])/u)
    .filter((part) => part !== '')
    .map((part) => (part === PAGE ? 'counter(page)' : part === PAGES ? 'counter(pages)' : cssString(part)))
    .join(' ');
}

/**
 * The PDF's page furniture (UX-118; `EasyESG Exported Document.dc.html`'s body pages; §12.5.6's task-43 row (2), which
 * left the running header and the page numbers to the PDF): on every page after the cover, a header naming the
 * undertaking and the section, and a footer with the standard's version and the page counter.
 *
 * **CSS page-margin boxes over named pages**, which Chromium prints: each section the document forces is a named page
 * whose top-right box names it, so a module that runs onto a second page carries its name there too. The furniture is
 * in the page margins and nowhere in the content, so the preview — the same markup on screen, which has no margins —
 * shows none of it, and the PDF's finishing step marks it as the pagination it is.
 */
export function pageFurniture(input: { readonly document: ReportDocument; readonly words: DocumentWords }): string {
  const { document, words } = input;
  const sections: readonly (readonly [string, string])[] = [
    ['contents', words.t('contents.title')],
    ['omissions', words.t('furniture.omissions')],
    ...document.modules.map(
      (module) => [module.module, `${module.module} · ${moduleName(words, module.module)}`] as const,
    ),
    ['provenance', words.t('provenance.title')],
  ];
  const standard = words.t('furniture.standard', {
    version: document.taxonomyVersion,
    scope: words.t(`furniture.scope.${document.scope}`),
    language: document.locale.toUpperCase(),
  });
  return [
    `@page { @top-left { content: ${cssString(words.t('title', { undertaking: document.undertaking, year: String(document.fiscalYear) }))}; }`,
    `  @bottom-left { content: ${cssString(standard)}; } @bottom-right { content: ${counterContent(words)}; } }`,
    '@page :first { @top-left { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }',
    ...sections.flatMap(([id, title]) => [
      `@page section-${identifier(id)} { @top-right { content: ${cssString(title)}; } }`,
      `#${identifier(id)} { page: section-${identifier(id)}; }`,
    ]),
  ].join('\n');
}
