import { getTranslations } from 'next-intl/server';
import { Panel, Spinner } from '@easyesg/ui';
import styles from '@/features/identity/components/identity-screens.module.css';

/**
 * S-03's **loading — initial** (§8.1, UX-90) — the first identity screen that needs one.
 *
 * The other `(identity)` screens render instantly: `/verify` draws its form and only the *action*
 * waits, which is what a busy button is for. S-03 is different in kind — its server render blocks
 * on an API round trip, because it has to ask what the invitation offers before it can say
 * anything at all. Without this the browser sits on the previous page for the length of that
 * round trip and the person who clicked a link in their email sees nothing happen.
 *
 * `loading.tsx` rather than a Suspense boundary inside the page: the whole body depends on the one
 * read, so there is no shell worth streaming ahead of it — which is `async-suspense-boundaries`'
 * own test, applied and answered the other way from the provider list below the fold.
 *
 * **It cannot pin the locale, and that is a real coupling rather than an oversight.** Next passes
 * `loading.tsx` no props, so `activateRequestLocale` — the one line every page under `[locale]`
 * opens with — is unavailable here; messages resolve through `requestLocale` alone, which is
 * correct only while `[locale]` declares `force-dynamic`. Un-forcing it is §14.2's own open caching
 * decision, and this file is the first thing that would break silently when it is taken. Recorded
 * in `apps/web/CLAUDE.md` beside that decision, because that is where someone will be reading.
 *
 * The heading is the real one, so the shell does not shift when the content arrives; the spinner is
 * decorative and the Panel's text is what names the wait (UX-102, UX-115 — a skeleton is for a
 * layout whose shape is known, and here the arm that renders is exactly what is unknown).
 */
export default async function AcceptInvitationLoading() {
  const t = await getTranslations('identity.invitation');

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <Panel className={styles.formPanel}>
        <p className={styles.bodyText} role="status">
          <Spinner /> {t('loading')}
        </p>
      </Panel>
    </>
  );
}
