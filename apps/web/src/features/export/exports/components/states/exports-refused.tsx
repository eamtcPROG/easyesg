import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { reportRoute } from '@/lib/routes';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';
import styles from '../styles/exports.module.css';

/**
 * A view-only member's S-11 (182/22): why there is no dialogue and no history, and the way back to the answers they do
 * read. The api refuses them the request, the history and the re-download; this is the screen saying so.
 */
export async function ExportsRefused({ reportId }: { readonly reportId: string }) {
  const t = await getTranslations(EXPORTS_MESSAGES);
  return (
    <div className={styles.state}>
      <Callout
        intent={CALLOUT_INTENT.INFO}
        title={t('refused.title')}
        action={
          <TextLink asChild>
            <Link href={reportRoute(reportId)}>{t('refused.action')}</Link>
          </TextLink>
        }
      >
        {t('refused.body')}
      </Callout>
    </div>
  );
}
