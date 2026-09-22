import { Logger } from '@nestjs/common';
import { EXPANSION_FLAG } from '@easyesg/i18n';
import { initialiseCatalogue, resetCatalogueForTests, translate } from './catalogue';

/**
 * The catalogue is loaded through a dynamic `import()` because the ICU engine is ESM-only and
 * this app is CommonJS (OQ-48). That bridge is the reason initialisation is a step someone can
 * forget, and a forgotten step here does not crash — it makes every message silently vanish.
 * These tests pin both halves of that contract.
 */
describe('message catalogue', () => {
  beforeEach(() => {
    resetCatalogueForTests();
  });

  it('returns nothing, rather than throwing, before initialisation', () => {
    // Callers are usually already on an error path. Failing to describe a failure must not
    // replace it with a second one.
    expect(() => translate('ro', 'problem.internal.title')).not.toThrow();
    expect(translate('ro', 'problem.internal.title')).toBeUndefined();
  });

  it('says so loudly, once, when used before initialisation', () => {
    // Silent is the failure mode that reaches production: a wordless API looks like missing copy
    // rather than a missing bootstrap call.
    const logged: string[] = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });

    translate('ro', 'a.b');
    translate('ro', 'c.d');

    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('initialiseCatalogue');
    jest.restoreAllMocks();
  });

  it('loads the ESM engine from CommonJS', async () => {
    // The bridge itself. If this regresses it fails here rather than as a wordless response in
    // whatever environment noticed first.
    await expect(initialiseCatalogue()).resolves.toBeUndefined();
  });

  it('is idempotent', async () => {
    await initialiseCatalogue();
    await expect(initialiseCatalogue()).resolves.toBeUndefined();
  });

  it('returns undefined for a key the catalogue does not carry', async () => {
    await initialiseCatalogue();

    // Not the key. CLAUDE.md forbids an internal identifier reaching a surface a person reads,
    // and returning the key is precisely how that happens by default in most i18n libraries.
    expect(translate('ro', 'problem.nothing-here.title')).toBeUndefined();
    expect(translate('en', 'problem.nothing-here.title')).toBeUndefined();
    expect(translate('ru', 'problem.nothing-here.title')).toBeUndefined();
  });

  it('accepts every registered locale', async () => {
    await initialiseCatalogue();

    for (const locale of ['ro', 'en', 'ru'] as const) {
      expect(() => translate(locale, 'problem.nothing-here.title')).not.toThrow();
    }
  });

  /**
   * UX-94's harness, on this side of the wire (task 51.3). The flag is read once per process, so
   * every case here re-initialises — and the pair is the proof: padding that never turns off would
   * pass a test that only ever looks at the padded arm, which is how the api came to serve real
   * words to a padded screen for as long as it did.
   */
  describe('the +40% expansion harness', () => {
    const KEY = 'problem.conflict.title';
    const original = process.env[EXPANSION_FLAG];

    afterEach(() => {
      if (original === undefined) delete process.env[EXPANSION_FLAG];
      else process.env[EXPANSION_FLAG] = original;
    });

    it('pads every resolved message when the flag is set', async () => {
      process.env[EXPANSION_FLAG] = '1';
      await initialiseCatalogue();

      const padded = translate('ro', KEY);

      expect(padded).toBeTruthy();
      expect(padded).toMatch(/·$/u);
    });

    it('leaves the words alone when it is not', async () => {
      delete process.env[EXPANSION_FLAG];
      await initialiseCatalogue();

      const plain = translate('ro', KEY);

      expect(plain).toBeTruthy();
      expect(plain).not.toContain('·');
    });

    // `expansionEnabled` admits only `'1'`, and this is the value that would otherwise read as on:
    // a process padding production text because someone wrote `=false` is worse than the layout
    // bug the harness exists to find.
    it('stays off for a value that merely looks truthy', async () => {
      process.env[EXPANSION_FLAG] = 'false';
      await initialiseCatalogue();

      expect(translate('ro', KEY)).not.toContain('·');
    });
  });
});
