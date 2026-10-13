import type { LegalControllerResponse } from '@easyesg/contracts';
import { ContentContents, ContentSection, ContentShell } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { LEGAL_DOCUMENT } from '../../tools/legal-documents';
import { LegalControllerFacts } from '../shared/legal-controller-facts';
import { LegalPeers } from '../shared/legal-peers';
import { LegalProvisional } from '../shared/legal-provisional';
import { LEGAL_RICH_TAGS } from '../shared/legal-rich-tags';
import { LegalStandingLine } from '../shared/legal-standing-line';
import { LEGAL_SUMMARY_ID, LegalSummary } from '../shared/legal-summary';

/**
 * The privacy notice (FR-205; UC-178; NFR-5; task 75.4) on the Content archetype — who controls a member's data and how
 * to reach them, what is kept and why, who sees it, where it rests (NFR-27), how long (FR-207 behaviour 7), how it is
 * protected, the rights NFR-28 and Law No. 195/2024 give, breaches and complaints.
 *
 * **It renders `legal.privacy.phone`** — what is kept of a member's phone, its one purpose and who reads it — beside
 * what is kept, which task 167 wrote ahead of this screen and FR-205 behaviour 6 forbids it to ship without. **The
 * operator it names is the store's** (`architecture.md` §12.5.6's task-75 row (7)).
 */
const PRIVACY_SECTION = {
  CONTROLLER: 'controller',
  COLLECT: 'collect',
  PURPOSES: 'purposes',
  RECIPIENTS: 'recipients',
  LOCATION: 'location',
  RETENTION: 'retention',
  SECURITY: 'security',
  RIGHTS: 'rights',
  BREACHES: 'breaches',
  COMPLAINTS: 'complaints',
  CHANGES: 'changes',
} as const;

const SECTIONS = Object.values(PRIVACY_SECTION);

export async function PrivacyNotice({ controller }: { readonly controller: LegalControllerResponse }) {
  const [tSet, t] = await Promise.all([getTranslations('legal'), getTranslations('legal.privacy')]);
  const operator = { registeredName: controller.registeredName, email: controller.dataProtectionEmail };

  return (
    <ContentShell
      eyebrow={tSet('set.eyebrow')}
      title={tSet(`documents.${LEGAL_DOCUMENT.PRIVACY}`)}
      lede={t('lede')}
      standing={<LegalStandingLine document={LEGAL_DOCUMENT.PRIVACY} />}
      peers={<LegalPeers current={LEGAL_DOCUMENT.PRIVACY} />}
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
      <LegalProvisional document={LEGAL_DOCUMENT.PRIVACY} />
      <LegalSummary>{t.rich('summary', LEGAL_RICH_TAGS)}</LegalSummary>
      {SECTIONS.map((id, index) => (
        <ContentSection key={id} id={id} heading={t(`sections.${id}.heading`)} number={index + 1}>
          {t.rich(`sections.${id}.body`, { ...LEGAL_RICH_TAGS, ...operator })}
          {id === PRIVACY_SECTION.CONTROLLER ? <LegalControllerFacts controller={controller} /> : null}
          {id === PRIVACY_SECTION.COLLECT ? <p>{t('phone')}</p> : null}
        </ContentSection>
      ))}
    </ContentShell>
  );
}
