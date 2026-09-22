import { EXPANSION_FLAG } from '@easyesg/i18n';
import type { DisclosureCatalogue } from './disclosure-catalogues';

/**
 * The disclosure catalogues under UX-94's +40% harness (task 51.3; §12.5.6's task-51.3 row).
 *
 * **Its own file because the flag is read at module load**, so a case cannot turn it on after the
 * import that already read it: each one below resets the registry and re-imports, which is not a
 * shape to mix into `disclosure-label.artefact.spec.ts`, whose subject is the shipped artefacts and
 * which must keep reading them unpadded.
 *
 * **The pair of arms is the proof.** Padding that never turned off would satisfy a suite that only
 * ever looked at the padded one — and the defect this task fixed was the mirror of that: a padded
 * screen reading an unpadded api, with every assertion green because nothing compared the two.
 */
const load = (flag: string | undefined): Readonly<Record<string, DisclosureCatalogue>> => {
  if (flag === undefined) delete process.env[EXPANSION_FLAG];
  else process.env[EXPANSION_FLAG] = flag;

  let catalogues: Readonly<Record<string, DisclosureCatalogue>> = {};
  jest.isolateModules(() => {
    // The flag is read at load, so the module is evaluated again per arm; a static import would read
    // it once for the whole file and both arms would answer the same.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    const reloaded = require('./disclosure-catalogues') as typeof import('./disclosure-catalogues');
    catalogues = reloaded.DISCLOSURE_CATALOGUES;
  });
  return catalogues;
};

describe('disclosure labels under the +40% harness (task 51.3)', () => {
  const VERSION = '2026-05-01';
  const original = process.env[EXPANSION_FLAG];

  afterEach(() => {
    if (original === undefined) delete process.env[EXPANSION_FLAG];
    else process.env[EXPANSION_FLAG] = original;
  });

  it('pads every label, its help and its members when the flag is set', () => {
    const catalogue = load('1')[VERSION];
    const labels = catalogue?.labels.ro ?? {};
    const [key] = Object.keys(labels);

    expect(key).toBeTruthy();
    expect(labels[key]?.text).toMatch(/·$/u);
    // Help and members travel by their own accessors and would each be a separate place to forget;
    // they are padded because all eighteen catalogues cross one function.
    expect(Object.values(catalogue?.help.ro ?? {})[0]?.text).toMatch(/·$/u);
    expect(Object.values(catalogue?.members.ro ?? {})[0]?.text).toMatch(/·$/u);
  });

  it('leaves the authored wording alone when it is not', () => {
    const catalogue = load(undefined)[VERSION];
    const labels = catalogue?.labels.ro ?? {};
    const [key] = Object.keys(labels);

    expect(key).toBeTruthy();
    expect(labels[key]?.text).not.toContain('·');
  });

  // The standing travels beside the text and is a vocabulary member, not wording — padding it would
  // make `isLabelStanding` refuse it, and an export could no longer say whose translation it carries.
  it('never pads the standing', () => {
    const catalogue = load('1')[VERSION];

    expect(catalogue?.standing.ro).not.toContain('·');
    expect(Object.values(catalogue?.labels.ro ?? {})[0]?.standing).not.toContain('·');
  });
});
