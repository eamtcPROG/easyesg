import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The console's token values restated in `index.html` (tasks 82, 152) — a `<meta>` and a mask icon cannot read a
 * custom property — held to `packages/ui`'s `tokens.css`, so a token that moves fails here instead of leaving the
 * browser chrome behind. **In `src/test/`** because its subject is the entry document, which no feature owns.
 */
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8');
const TOKENS = read('../../../../packages/ui/src/styles/tokens.css');
const INDEX = read('../../index.html');

const tokenValue = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`, 'u').exec(TOKENS);
  if (!match?.[1]) throw new Error(`tokens.css declares no --${name}`);
  return match[1].toUpperCase();
};

const themeColorFor = (scheme: string): string | undefined =>
  new RegExp(
    `<meta name="theme-color" media="\\(prefers-color-scheme: ${scheme}\\)" content="(#[0-9A-Fa-f]{6})"`,
    'u',
  )
    .exec(INDEX)?.[1]
    ?.toUpperCase();

describe('the token values index.html restates', () => {
  it('colours the browser chrome with --accent in each scheme', () => {
    expect(themeColorFor('light')).toBe(tokenValue('pine-600'));
    expect(themeColorFor('dark')).toBe(tokenValue('pine-dark-400'));
  });

  it('colours the pinned-tab glyph with the light accent', () => {
    expect(/<link rel="mask-icon"[^>]*color="(#[0-9A-Fa-f]{6})"/u.exec(INDEX)?.[1]?.toUpperCase()).toBe(
      tokenValue('pine-600'),
    );
  });
});
