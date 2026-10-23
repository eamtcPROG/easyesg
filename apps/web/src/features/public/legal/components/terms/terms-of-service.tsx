import type { LegalControllerResponse } from '@easyesg/contracts';
import { ContentContents, ContentSection, ContentShell } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { LEGAL_DOCUMENT } from '@easyesg/i18n';
import { LegalControllerFacts } from '../shared/legal-controller-facts';
import { LegalPeers } from '../shared/legal-peers';
import { LegalProvisional } from '../shared/legal-provisional';
import { LEGAL_RICH_TAGS } from '../shared/legal-rich-tags';
import { LegalStandingLine } from '../shared/legal-standing-line';
import { LEGAL_SUMMARY_ID, LegalSummary } from '../shared/legal-summary';

/**
 * The terms of service (FR-205; UC-178; task 75.4) on the Content archetype — the first version, which covers the free
 * pilot (`architecture.md` §12.5.6's task-75 row (3), (4)): the account, acceptable use, the reporter's content staying
 * theirs, the personal data inside a report in place of a processing agreement (182/121), availability, liability,
 * ending, changes, and Moldovan law. Plans and payment arrive as a later version, with billing.
 *
 * **The words are the release's** (182/116) and **the operator they name is the store's** (row (7)): the section that
 * says who provides the service states A-21's four facts, and the text names the operator and its contact by them.
 */
const TERMS_SECTION = {
  OPERATOR: 'operator',
  SERVICE: 'service',
  PILOT: 'pilot',
  ACCOUNT: 'account',
  USE: 'use',
  CONTENT: 'content',
  PERSONAL_DATA: 'personalData',
  AVAILABILITY: 'availability',
  LIABILITY: 'liability',
  TERMINATION: 'termination',
  CHANGES: 'changes',
  LAW: 'law',
} as const;

const SECTIONS = Object.values(TERMS_SECTION);

export async function TermsOfService({ controller }: { readonly controller: LegalControllerResponse }) {
  const [tSet, t] = await Promise.all([getTranslations('legal'), getTranslations('legal.terms')]);
  const operator = { registeredName: controller.registeredName, email: controller.dataProtectionEmail };

  return (
    <ContentShell
      eyebrow={tSet('set.eyebrow')}
      title={tSet(`documents.${LEGAL_DOCUMENT.TERMS}`)}
      lede={t('lede')}
      standing={<LegalStandingLine document={LEGAL_DOCUMENT.TERMS} />}
      peers={<LegalPeers current={LEGAL_DOCUMENT.TERMS} />}
      contents={
        <ContentContents
          label={tSet('set.contents')}
          sections={[
            { id: LEGAL_SUMMARY_ID, label: tSet('summary.heading') },
            ...SECTIONS.map((id) => ({ id, label: t(`sections.${id}.heading`) })),
          ]}
        />
      }
    >
      <LegalProvisional document={LEGAL_DOCUMENT.TERMS} />
      <LegalSummary>{t.rich('summary', LEGAL_RICH_TAGS)}</LegalSummary>
      {SECTIONS.map((id, index) => (
        <ContentSection key={id} id={id} heading={t(`sections.${id}.heading`)} number={index + 1}>
          {t.rich(`sections.${id}.body`, { ...LEGAL_RICH_TAGS, ...operator })}
          {id === TERMS_SECTION.OPERATOR ? <LegalControllerFacts controller={controller} /> : null}
        </ContentSection>
      ))}
    </ContentShell>
  );
}
