import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { PREVIEW_MESSAGES } from '../shared/preview-messages';
import styles from '../styles/preview.module.css';
import { PreviewLanguage } from './preview-language';

/**
 * S-10's heading (task 43.2): what the screen is, that nothing leaves the platform from it (UC-41), and — where the
 * reader may preview — the document's language.
 */
export async function PreviewHeading(props: { readonly reportId: string; readonly language: Locale | null }) {
  const t = await getTranslations(PREVIEW_MESSAGES);
  return (
    <>
      <h1 className={`t-heading-2 ${styles.title}`}>{t('heading')}</h1>
      <p className={`t-body ${styles.note}`}>{t('note')}</p>
      {props.language === null ? null : <PreviewLanguage reportId={props.reportId} language={props.language} />}
    </>
  );
}
