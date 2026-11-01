import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { reportRoute } from '@/lib/routes';
import { PREVIEW_MESSAGES } from '../shared/preview-messages';
import styles from '../styles/preview.module.css';

/**
 * A view-only member's S-10 (182/22): why there is no document, and the way back to the answers they do read. The api
 * refuses them the document; this is the screen saying so before the frame would.
 */
export async function PreviewRefused({ reportId }: { readonly reportId: string }) {
  const t = await getTranslations(PREVIEW_MESSAGES);
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
