import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The document's stylesheet with its fonts inside it (task 43; §12.5.6's task-43 row (a)) — read once per process.
 *
 * **The fonts travel in the markup**, as data, so the preview and the PDF read the same bytes and the renderer waits on
 * no late web font (OQ-38's constraint): Source Serif 4 at the two weights the document sets — the body and its
 * headings — and IBM Plex Mono for its versions, codes and marks, each in the Latin and Cyrillic subsets the three
 * locales write in. The faces are the `@fontsource` packages' own, with only their source rewritten.
 *
 * **The stylesheet is plain CSS** (row (3)), copied beside the compiled file by `nest-cli.json`'s assets.
 */
const FACES = [
  { from: '@fontsource/source-serif-4', weights: ['400', '600'] },
  { from: '@fontsource/ibm-plex-mono', weights: ['400'] },
] as const;

/** The subsets Romanian, English and Russian are written in. */
const SUBSETS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'] as const;

const FONT_FACE = /@font-face\s*\{[^}]*\}/gu;
const WOFF2 = /url\(\.\/files\/([^)]+\.woff2)\)/u;
const SOURCE = /src:[^;]*;/u;

let styles: string | undefined;

export function documentStyles(): string {
  styles ??= [...FACES.flatMap((face) => face.weights.map((weight) => facesOf(face.from, weight))), stylesheet()].join(
    '\n',
  );
  return styles;
}

/** One weight's `@font-face` rules, each subset's file inlined, every other subset dropped. */
function facesOf(from: string, weight: string): string {
  const css = require.resolve(`${from}/${weight}.css`);
  const kept = [...readFileSync(css, 'utf8').matchAll(FONT_FACE)].flatMap(([rule]) => {
    const file = WOFF2.exec(rule)?.[1];
    if (file === undefined || !SUBSETS.some((subset) => file.endsWith(`-${subset}-${weight}-normal.woff2`))) return [];
    const data = readFileSync(join(dirname(css), 'files', file)).toString('base64');
    return [rule.replace(SOURCE, `src: url(data:font/woff2;base64,${data}) format('woff2');`)];
  });
  if (kept.length !== SUBSETS.length) {
    throw new Error(`The document's ${from} ${weight} faces are incomplete: ${kept.length} of ${SUBSETS.length} subsets`);
  }
  return kept.join('\n');
}

function stylesheet(): string {
  return readFileSync(join(__dirname, 'document.css'), 'utf8');
}
