import { EmptyState } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PANEL_MESSAGES } from '../shared/panel-messages';

/**
 * S-08 with nothing outstanding (task 42.2): the last run found nothing, so the report reads ready to file (182/19).
 * The artboard's sentence is kept: export was available throughout, and this state unlocks nothing (182/27).
 */
export function PanelClear() {
  const t = useTranslations(PANEL_MESSAGES);
  return (
    <EmptyState title={t('empty.clear.title')} action={null}>
      {t('empty.clear.body')}
    </EmptyState>
  );
}
