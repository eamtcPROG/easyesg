import { getTranslations } from 'next-intl/server';
import { Panel, Spinner } from '@easyesg/ui';
import { SETUP_MESSAGES } from '@/features/identity/setup/components/shared/setup-messages';
import styles from '@/features/identity/shared/styles/identity-screens.module.css';
import { ScriptingRequired } from '@/shared/scripting-required';

/**
 * S-36's **loading — initial** (§8.1, UX-90). S-03's reasoning, applied: the whole body waits on one
 * read — which step the account owes — so there is no shell worth streaming ahead of it, and a
 * `loading.tsx` is what stops the browser sitting on the previous page for the round trip.
 *
 * It cannot pin the locale, for the reason S-03's loading state records: Next passes it no props, so
 * its messages resolve through `requestLocale`, correct while `[locale]` declares `force-dynamic`.
 *
 * **It carries the scripting notice** (task 137, closing a gap in task 153): behind a route-level boundary Next sends
 * this fallback first and streams the page into hidden markup that a script swaps in, so a browser with scripting off
 * shows this and nothing else, for good. The form's own `<noscript>` never reaches it; this one does.
 */
export default async function CompleteAccountLoading() {
  const t = await getTranslations(SETUP_MESSAGES);

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <ScriptingRequired />
      <Panel className={styles.formPanel}>
        <p className={styles.bodyText} role="status">
          <Spinner /> {t('loading')}
        </p>
      </Panel>
    </>
  );
}
