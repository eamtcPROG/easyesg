import type { DisclosureModuleSummary } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { documentAddress, documentPages, previewLanguage } from './preview';

const summary = (module: string): DisclosureModuleSummary => ({
  module,
  answered: 0,
  total: 1,
  lastAnsweredAt: null,
  applicable: true,
  omitted: false,
  applicabilityCause: null,
});

describe('S-10’s rules (task 43.2)', () => {
  it('opens in the language the address names, else the account’s export default, else the reader’s own', () => {
    expect(previewLanguage({ asked: 'en', exportDefault: 'ru', reader: 'ro' })).toBe('en');
    // A language the platform does not publish in is not a language to open in.
    expect(previewLanguage({ asked: 'fr', exportDefault: 'ru', reader: 'ro' })).toBe('ru');
    expect(previewLanguage({ asked: undefined, exportDefault: 'ru', reader: 'ro' })).toBe('ru');
    expect(previewLanguage({ asked: ['en', 'ru'], exportDefault: null, reader: 'ro' })).toBe('ro');
  });

  it('frames the api’s document through the session pass-through, in the language chosen', () => {
    expect(documentAddress({ reportId: 'r1', locale: 'en' })).toBe('/api/v1/reports/r1/preview?locale=en');
  });

  it('lists the document’s pages in its order, one per module the scope asks', () => {
    const modules = ['B1', 'B2', 'C1'].map(summary);
    const pages = (scope: 'basic' | 'basic_and_comprehensive') =>
      documentPages({ modules, scope, pageName: (page) => `page:${page}`, moduleName: (module) => `name:${module}` });
    expect(pages('basic')).toEqual([
      { id: 'cover', label: 'page:cover' },
      { id: 'contents', label: 'page:contents' },
      { id: 'omissions', label: 'page:omissions' },
      { id: 'B1', label: 'name:B1', reference: 'B1' },
      { id: 'B2', label: 'name:B2', reference: 'B2' },
      { id: 'provenance', label: 'page:provenance' },
    ]);
    expect(pages('basic_and_comprehensive').map((page) => page.id)).toContain('C1');
  });
});
