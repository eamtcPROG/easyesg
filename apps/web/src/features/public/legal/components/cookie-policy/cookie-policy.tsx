import { ContentContents, ContentSection, ContentShell, ContentWide } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { LEGAL_DOCUMENT } from '@easyesg/i18n';
import { CookieChoiceStanding } from '../../../cookie-choice/components/standing/cookie-choice-standing';
import { LegalPeers } from '../shared/legal-peers';
import { LegalProvisional } from '../shared/legal-provisional';
import { LEGAL_RICH_TAGS } from '../shared/legal-rich-tags';
import { LegalStandingLine } from '../shared/legal-standing-line';
import { LEGAL_SUMMARY_ID, LegalSummary } from '../shared/legal-summary';
import { BrowserStorage } from './browser-storage';
import { CookieTable } from './cookie-table';

/**
 * The cookie policy's disclosure (FR-206; UC-179) on the Content archetype — every cookie by purpose and how long it
 * lasts, what is not set, the storage that is not a cookie, what deleting them does, and since task 223 the reader's
 * answer to S-31's banner, with the settings it opens. **No decline**: every cookie is strictly necessary (OQ-23's
 * finding), so the banner informs, and what the page states of the answer is that the reader was told (OQ-27).
 *
 * **Its facts are task 75.2's inventory**, so the page is true of the build by that inventory's gate. **Its summary and
 * its standing arrived with the set's text** (task 75.4; `architecture.md` §12.5.6's task-75 row (6), (9)): drafted here and
 * provisional until counsel approves it, like the other two. It names no operator, so it reads nothing.
 */
const SECTION = {
  SET: 'set',
  NOT_SET: 'not-set',
  STORAGE: 'storage',
  BROWSER: 'browser',
  ANSWER: 'answer',
} as const;

export async function CookiePolicy() {
  const [tSet, t] = await Promise.all([getTranslations('legal'), getTranslations('legal.cookies')]);

  const sections = [
    { id: LEGAL_SUMMARY_ID, label: tSet('summary.heading') },
    { id: SECTION.SET, label: t('sections.set.heading') },
    { id: SECTION.NOT_SET, label: t('sections.notSet.heading') },
    { id: SECTION.STORAGE, label: t('sections.storage.heading') },
    { id: SECTION.BROWSER, label: t('sections.browser.heading') },
    { id: SECTION.ANSWER, label: t('sections.answer.heading') },
  ];

  return (
    <ContentShell
      eyebrow={tSet('set.eyebrow')}
      title={tSet(`documents.${LEGAL_DOCUMENT.COOKIES}`)}
      lede={t('lede')}
      standing={<LegalStandingLine document={LEGAL_DOCUMENT.COOKIES} />}
      peers={<LegalPeers current={LEGAL_DOCUMENT.COOKIES} />}
      contents={<ContentContents label={tSet('set.contents')} sections={sections} />}
    >
      <LegalProvisional document={LEGAL_DOCUMENT.COOKIES} />
      <LegalSummary>{t.rich('summary', LEGAL_RICH_TAGS)}</LegalSummary>
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
      {/* Task 223: what is kept of the reader's answer, then the answer itself, read in the browser. */}
      <ContentSection id={SECTION.ANSWER} heading={t('sections.answer.heading')} number={5}>
        <p>{t('sections.answer.body')}</p>
        <CookieChoiceStanding />
      </ContentSection>
    </ContentShell>
  );
}
