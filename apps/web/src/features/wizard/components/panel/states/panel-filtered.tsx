import { useTranslations } from 'next-intl';
import { PANEL_MESSAGES } from '../shared/panel-messages';

/** S-08's *empty — filtered* (task 42.2): the filter in force keeps none of the last run's findings. */
export function PanelFiltered() {
  const t = useTranslations(PANEL_MESSAGES);
  return <p className="t-caption">{t('empty.filtered')}</p>;
}
