'use client';

import { EXPORT_STATUS, type Export } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { exportFileAddress } from '@/client/exports/read-export';
import { useExportJob } from '@/client/exports/use-export-job';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';
import styles from '../styles/exports.module.css';

/**
 * UX-46's pending state (task 47.3; §8.5) — **the defining state of S-11**: the request acknowledged at once, this card
 * the named place to watch, and the reader free to leave; past 30 s the person who asked is told by a notice
 * (`architecture.md` §12.5.6's task-47 row (5)). It watches the export the request answered, every 5 s until it settles
 * (OQ-36), then offers the file — the stored one, through the pass-through — or says it could not be made, and either
 * way the next file.
 */
export function ExportPending({ queued, onRestart }: { readonly queued: Export; readonly onRestart: () => void }) {
  const t = useTranslations(EXPORTS_MESSAGES);
  const tLocales = useTranslations('chrome.locales');
  const watched = useExportJob(queued);
  const another = (
    <Button variant={BUTTON_VARIANT.SUBTLE} onClick={onRestart}>
      {t('pending.another')}
    </Button>
  );

  if (watched.status === EXPORT_STATUS.COMPLETED) {
    return (
      <Callout
        intent={CALLOUT_INTENT.SUCCESS}
        title={t('pending.completed.title')}
        action={
          <span className={styles.commit}>
            {another}
            <Button asChild variant={BUTTON_VARIANT.PRIMARY}>
              <a href={exportFileAddress(watched.id)} download>
                {t('pending.download')}
              </a>
            </Button>
          </span>
        }
      >
        {t('pending.completed.body')}
      </Callout>
    );
  }
  if (watched.status === EXPORT_STATUS.FAILED) {
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('pending.failed.title')} action={another}>
        {t('pending.failed.body')}
      </Callout>
    );
  }
  return (
    <Callout
      intent={CALLOUT_INTENT.INFO}
      title={t('pending.title', { format: watched.format, language: tLocales(watched.locale) })}
      action={null}
    >
      {t('pending.body')}
    </Callout>
  );
}
