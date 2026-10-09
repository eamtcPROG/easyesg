import { ContentContents, ContentSection, ContentShell, ContentWide } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { LEGAL_DOCUMENT } from '../../tools/legal-documents';
import { LegalPeers } from '../shared/legal-peers';
import { BrowserStorage } from './browser-storage';
import { CookieTable } from './cookie-table';

/**
 * The cookie policy's disclosure (FR-206; UC-179, S-31 folded into S-30 by 182/117) on the Content archetype — every
 * cookie by purpose and how long it lasts, what is not set, the storage that is not a cookie, and what deleting them
 * does. **No accept or decline and nothing remembered**: every cookie is strictly necessary (OQ-23), so the page
 * informs and stores nothing to record that it did.
 *
 * **Its facts are task 75.2's inventory**, so the page is true of the build by that inventory's gate. **Its other text
 * is the owner's or counsel's** (`architecture.md` §12.5.6's task-75 row), which is why it carries no standing — the set's
 * version and effective date arrive with the documents (75.4).
 */
const SECTION = {
  SET: 'set',
  NOT_SET: 'not-set',
  STORAGE: 'storage',
  BROWSER: 'browser',
} as const;

export async function CookiePolicy() {
  const [tSet, t] = await Promise.all([getTranslations('legal'), getTranslations('legal.cookies')]);

  const sections = [
    { id: SECTION.SET, label: t('sections.set.heading') },
    { id: SECTION.NOT_SET, label: t('sections.notSet.heading') },
    { id: SECTION.STORAGE, label: t('sections.storage.heading') },
    { id: SECTION.BROWSER, label: t('sections.browser.heading') },
  ];

  return (
    <ContentShell
      eyebrow={tSet('set.eyebrow')}
      title={tSet(`documents.${LEGAL_DOCUMENT.COOKIES}`)}
      lede={t('lede')}
      peers={<LegalPeers current={LEGAL_DOCUMENT.COOKIES} />}
      contents={<ContentContents label={tSet('set.contents')} sections={sections} />}
    >
      {/* The table is the section's content, so the section takes the wider measure and its prose keeps the reading one. */}
      <ContentWide>
        <ContentSection id={SECTION.SET} heading={t('sections.set.heading')} number={1}>
          <p>{t('sections.set.intro')}</p>
          <CookieTable />
        </ContentSection>
      </ContentWide>
      <ContentSection id={SECTION.NOT_SET} heading={t('sections.notSet.heading')} number={2}>
        <p>{t('sections.notSet.body')}</p>
      </ContentSection>
      <ContentSection id={SECTION.STORAGE} heading={t('sections.storage.heading')} number={3}>
        <p>{t('sections.storage.intro')}</p>
        <BrowserStorage />
      </ContentSection>
      <ContentSection id={SECTION.BROWSER} heading={t('sections.browser.heading')} number={4}>
        <p>{t('sections.browser.body')}</p>
      </ContentSection>
    </ContentShell>
  );
}
