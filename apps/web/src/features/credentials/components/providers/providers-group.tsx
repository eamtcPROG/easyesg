'use client';

import { SOCIAL_PROVIDER } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { SECTION_READ } from '../../tools/credentials';
import { CREDENTIALS_SECTION } from '../../tools/credentials-state';
import { lastWayIn } from '../../tools/last-way-in';
import { PROVIDERS_MESSAGES } from '../shared/credentials-messages';
import { useCredentials } from '../shared/credentials-context';
import { SectionUnavailable } from '../shared/section-unavailable';
import styles from '../styles/credentials.module.css';
import { ProviderRow } from './provider-row';

/**
 * S-28's linked identities — UC-11 and UC-12, as the artboard draws them (task 169; OQ-19 closed): one card under one
 * heading, a row per provider the platform offers, each linked with its address and *Unlink*, or not linked with
 * *Link*. **Every provider has a row**, linked or not, where the screen used to list the linked and offer the rest as
 * buttons beneath — so a reader sees at a glance which ways in exist and which are theirs.
 *
 * **Not a `CredentialRow`**: a group of rows under one heading is a different anatomy, and a boolean on the row to
 * draw a list would be the smell UX-89 names.
 */
export function ProvidersGroup() {
  const t = useTranslations(PROVIDERS_MESSAGES);
  const { read } = useCredentials();
  const id = CREDENTIALS_SECTION.PROVIDERS;
  const headingId = `${id}-heading`;
  const way = lastWayIn(read);
  // Bound once, so the narrowing below holds inside the row's callback.
  const providers = read.providers;

  return (
    <section id={id} className={styles.group} aria-labelledby={headingId}>
      <div className={styles.groupHeader}>
        <h2 id={headingId} className={styles.rowHeading}>
          {t('heading')}
        </h2>
        <p className={styles.rowDescription}>{t('description')}</p>
      </div>
      {providers.status === SECTION_READ.READY ? (
        <ul className={styles.groupList}>
          {Object.values(SOCIAL_PROVIDER).map((provider) => (
            <ProviderRow
              key={provider}
              provider={provider}
              identity={providers.value.find((linked) => linked.provider === provider)}
              way={way}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.groupBody}>
          <SectionUnavailable />
        </div>
      )}
    </section>
  );
}
