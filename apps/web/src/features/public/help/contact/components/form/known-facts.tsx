import { useTranslations } from 'next-intl';
import type { KnownReader } from '../../tools/known-reader';
import { CONTACT_MESSAGES } from '../shared/contact-messages';
import styles from '../shared/contact.module.css';

/**
 * What travels with a signed-in reader's request instead of being asked (tasks 77, 227; UX-109's Redundant Entry;
 * artboard 04's *Sent with your message, so you do not have to describe it*) — the account's name and address, and the
 * active organization's name, set out on one line as the artboard does. The role, the versions and the browser the
 * artboard adds travel from task 236 (`architecture.md` §12.5.6's task-227 row (13)).
 */
export function KnownFacts({ reader }: { readonly reader: KnownReader }) {
  const t = useTranslations(CONTACT_MESSAGES);

  return (
    <section aria-labelledby="contact-known" className={styles.known}>
      <h2 id="contact-known" className={styles.knownHeading}>
        {t('known.heading')}
      </h2>
      <dl className={styles.facts}>
        <div>
          <dt>{t('known.name')}</dt>
          <dd>{reader.name}</dd>
        </div>
        <div>
          <dt>{t('known.email')}</dt>
          <dd>{reader.email}</dd>
        </div>
        {reader.organizationName === null ? null : (
          <div>
            <dt>{t('known.organization')}</dt>
            <dd>{reader.organizationName}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
