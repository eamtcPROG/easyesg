import type { LegalControllerResponse } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import styles from '../styles/legal.module.css';

/**
 * The platform operator a document names (task 75; FR-205; `architecture.md` §12.5.6's task-75 row (7)) — its four
 * facts as A-21 keeps them, each shown as registered in every locale. **In `shared/` because the terms and the privacy
 * notice both draw it.** The contact is a link, so a reader writes to it in one step.
 */
export async function LegalControllerFacts({ controller }: { readonly controller: LegalControllerResponse }) {
  const t = await getTranslations('legal.controller');

  return (
    <dl className={styles.facts}>
      <dt>{t('registeredName')}</dt>
      <dd>{controller.registeredName}</dd>
      <dt>{t('idno')}</dt>
      <dd>{controller.idno}</dd>
      <dt>{t('registeredAddress')}</dt>
      <dd>{controller.registeredAddress}</dd>
      <dt>{t('dataProtectionEmail')}</dt>
      <dd>
        <a href={`mailto:${controller.dataProtectionEmail}`}>{controller.dataProtectionEmail}</a>
      </dd>
    </dl>
  );
}
