import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '@easyesg/i18n';

/**
 * **Every message key a `DomainError` carries resolves in every locale.**
 *
 * This gate exists because its absence cost nine broken messages across four tasks. `translate`
 * returns `undefined` for a key the catalogue lacks, and `ProblemDetailsFilter` then *omits*
 * `detail` — which is the right failure (an internal identifier must never reach a reader,
 * CLAUDE.md) and an invisible one. The refusal still had a `title` from its problem slug, still
 * had the right status, and still passed every e2e assertion, because those assert `type` and
 * status. What it did not have was NFR-79's second and third parts: what the consequence is, and
 * what to do next. Nine refusals shipped saying nothing.
 *
 * Nothing saw it. Not `pnpm test`, not the e2e suites, not the expansion harness — the parity
 * gate in `packages/i18n` compares the three catalogues **to each other**, so nine keys missing
 * from all three are perfectly consistent. Consistency was never the property that mattered here;
 * *coverage of what the code actually asks for* is.
 *
 * **It reads the source rather than importing it**, and that is deliberate. Importing every error
 * module would boot half the module graph into a hermetic unit test and would still only see the
 * classes something happened to import. A regex over `super('…')` in `errors/*.ts` sees every one
 * that exists, including a file nothing imports yet — which is exactly the case that would
 * otherwise ship wordless.
 */
const MODULES_ROOT = join(__dirname, '../../modules');
const SUPER_CALL = /\bsuper\(\s*'([a-z][\w.]*\.[\w.]+)'/gu;

/** Every `errors/*.ts` under `modules/`, found by walking rather than by a maintained list. */
function errorFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return errorFiles(path);
    return entry.name.endsWith('.errors.ts') ? [path] : [];
  });
}

const declaredKeys = (): string[] => {
  const keys = new Set<string>();
  for (const file of errorFiles(MODULES_ROOT)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(SUPER_CALL)) keys.add(match[1]);
  }
  return [...keys].sort();
};

const catalogue = (locale: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../../../packages/i18n/catalogues/${locale}.json`), 'utf8'),
  ) as Record<string, unknown>;

const resolves = (messages: Record<string, unknown>, key: string): boolean => {
  let node: unknown = messages;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' && node.length > 0;
};

describe('every DomainError message key is in every catalogue (NFR-79)', () => {
  const keys = declaredKeys();

  it('finds the keys at all — a rule matching nothing looks exactly like one that passes', () => {
    // The guard `boundaries:prove` taught this repository, applied to a regex: if the pattern or
    // the file convention ever changes, this fails instead of silently checking an empty set.
    expect(keys.length).toBeGreaterThan(20);
    expect(keys).toContain('identity.social.last_credential');
  });

  it.each(LOCALES)('%s carries every declared key', (locale) => {
    const messages = catalogue(locale);
    const missing = keys.filter((key) => !resolves(messages, key));
    // Named in the failure, so the fix is the message rather than a hunt for it.
    expect(missing).toEqual([]);
  });
});
