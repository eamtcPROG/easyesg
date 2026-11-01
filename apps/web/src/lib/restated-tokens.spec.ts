import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESTATED_TOKEN } from './restated-tokens';

const TOKENS = readFileSync(join(import.meta.dirname, '../../../../packages/ui/src/styles/tokens.css'), 'utf8');

/** A tier-1 token's value as `tokens.css` declares it. */
const tokenValue = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`, 'u').exec(TOKENS);
  if (!match?.[1]) throw new Error(`tokens.css declares no --${name}`);
  return match[1];
};

/** Tasks 82 and 152: each restated value is the token it names, so a token that moves fails here. */
describe('the token values restated for the manifest and the browser chrome', () => {
  it.each([
    ['ACCENT_LIGHT', 'pine-600'],
    ['ACCENT_DARK', 'pine-dark-400'],
    ['PAGE_GROUND_LIGHT', 'slate-50'],
  ] as const)('%s is --%s', (restated, token) => {
    expect(RESTATED_TOKEN[restated].toUpperCase()).toBe(tokenValue(token).toUpperCase());
  });
});
