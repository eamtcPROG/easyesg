import { API_OUTCOME } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { MAIN_CONTENT_ID } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { ROUTES } from '@/lib/routes';
import { readSupportChannel } from '@/server/data/support-channel';
import pageStyles from '../../../shared/help-page.module.css';
import { HelpTrail } from '../../../shared/help-trail';
import type { KnownReader } from '../../tools/known-reader';
import { ContactForm } from '../form/contact-form';
import { UrgentAdvice } from '../rail/urgent-advice';
import { CONTACT_MESSAGES } from '../shared/contact-messages';
import styles from '../shared/contact.module.css';

/**
 * S-34 — write to support (tasks 77.4, 227; UC-182, FR-212; `design_spec.md` S-34, as `EasyESG Help Centre.dc.html`'s
 * artboard 04 draws it — `architecture.md` §12.5.6's task-227 row (1)): the trail bar, then the form as a card with
 * the right-hand column beside it; one primary action. **Its one read is support's mailbox**, read with no session
 * (row (4)), which the card's foot names; the reader the route resolved, or `null`, is all else it needs, and the form
 * does the one write.
 */
export async function ContactSupport({ reader, locale }: { readonly reader: KnownReader | null; readonly locale: Locale }) {
  const [t, tArticle, channel] = await Promise.all([
    getTranslations(CONTACT_MESSAGES),
    getTranslations('help.article'),
    readSupportChannel(),
  ]);

  return (
    <>
      <HelpTrail trail={[{ href: ROUTES.HELP_CENTRE, label: tArticle('breadcrumb') }]} current={t('title')} />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={pageStyles.page}>
        <div className={`${pageStyles.columns} ${pageStyles.inner}`}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
              <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
            </div>
            <ContactForm
              reader={reader}
              locale={locale}
              address={channel.status === API_OUTCOME.Ok ? channel.value.address : null}
            />
          </div>
          <div className={pageStyles.rail}>
            <UrgentAdvice />
          </div>
        </div>
      </main>
    </>
  );
}
