import { EmptyState } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PANEL_MESSAGES } from '../shared/panel-messages';

/**
 * S-08's *empty — first use* (task 42.2; row (3)): the report was never checked, so nothing is known to be missing —
 * which is not the same as nothing missing. The run control beside the heading is the way on; a reader who may not run
 * one is told who can (182/22).
 */
export function PanelUnchecked({ mayRun }: { readonly mayRun: boolean }) {
  const t = useTranslations(PANEL_MESSAGES);
  return (
    <EmptyState title={t('empty.unchecked.title')} action={null}>
      {mayRun ? t('empty.unchecked.body') : t('empty.unchecked.reader')}
    </EmptyState>
  );
}
