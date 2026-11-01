import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMAIL_PALETTE } from './email-palette';

/** The cascade's own file, read from the repository — the api does not depend on the design system. */
const TOKENS = readFileSync(join(__dirname, '../../../../../../packages/ui/src/styles/tokens.css'), 'utf8');

/** `--name: value;` declarations in the stylesheet's first `:root` block — the light scheme's, before any media query. */
function rootDeclarations(css: string): ReadonlyMap<string, string> {
  const root = /:root\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
  return new Map([...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/gu)].map(([, name, value]) => [name, value.trim()]));
}

describe('the email palette (task 225; §12.5.6’s task-225 row (4))', () => {
  it('takes every value it names from the cascade’s light scheme, unchanged', () => {
    const tokens = rootDeclarations(TOKENS);
    // The check is looking at something: the band, the button and a state hue are among what it compares.
    expect(Object.keys(EMAIL_PALETTE)).toEqual(expect.arrayContaining(['--pine-800', '--pine-600', '--amber-tint']));
    for (const [name, value] of Object.entries(EMAIL_PALETTE)) expect([name, value]).toEqual([name, tokens.get(name)]);
  });
});
