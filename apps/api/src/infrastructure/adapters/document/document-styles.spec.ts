import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { documentStyles } from './document-styles';

/** The cascade's own file, read from the repository — the api does not depend on the design system. */
const TOKENS = readFileSync(join(__dirname, '../../../../../../packages/ui/src/styles/tokens.css'), 'utf8');
const DOCUMENT = readFileSync(join(__dirname, 'document.css'), 'utf8');

/** `--name: value;` declarations in a stylesheet's first `:root` block — the light scheme's, before any media query. */
function rootDeclarations(css: string): ReadonlyMap<string, string> {
  const root = /:root\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
  return new Map([...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/gu)].map(([, name, value]) => [name, value.trim()]));
}

describe('the document stylesheet (task 43; §12.5.6’s task-43 row (a))', () => {
  it('takes every cascade value it names from the cascade’s light scheme, unchanged', () => {
    const tokens = rootDeclarations(TOKENS);
    const mirrored = [...rootDeclarations(DOCUMENT)].filter(([name]) => !name.startsWith('--document-'));
    // The check is looking at something: the palette and the mono face are mirrored.
    expect(mirrored.map(([name]) => name)).toEqual(expect.arrayContaining(['--slate-900', '--pine-600', '--font-mono']));
    for (const [name, value] of mirrored) expect([name, value]).toEqual([name, tokens.get(name)]);
  });

  it('carries every face it sets inside it, as data — the Latin and Cyrillic subsets of each weight', () => {
    const styles = documentStyles();
    const faces = [...styles.matchAll(/@font-face\s*\{[^}]*\}/gu)].map(([face]) => face);
    // Source Serif 4 at 400 and 600, IBM Plex Mono at 400, four subsets each.
    expect(faces).toHaveLength(12);
    expect(faces.every((face) => face.includes('url(data:font/woff2;base64,'))).toBe(true);
    expect(styles).not.toMatch(/url\(\.\//u);
  });
});
