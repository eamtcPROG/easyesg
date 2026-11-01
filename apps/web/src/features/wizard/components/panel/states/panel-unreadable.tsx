import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PANEL_MESSAGES } from '../shared/panel-messages';

/**
 * S-08's *error — recoverable* for the read (task 42.2): the last run's findings could not be read. The fields still
 * show their live verdicts, which is why the step renders at all — validation is an aid, never a precondition — and
 * the sentence's last part says what to do.
 */
export function PanelUnreadable() {
  const t = useTranslations(PANEL_MESSAGES);
  return (
    <Callout intent={CALLOUT_INTENT.ERROR} title={t('unreadable.title')} action={null}>
      {t('unreadable.body')}
    </Callout>
  );
}
