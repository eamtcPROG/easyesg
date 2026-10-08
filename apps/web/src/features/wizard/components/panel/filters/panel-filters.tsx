import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PANEL_FILTER, type PanelFilter, type PanelFindings } from '../../../tools/panel-findings';
import { PANEL_MESSAGES } from '../shared/panel-messages';
import styles from './panel-filters.module.css';

/**
 * The artboard's *All · Must fix · Review* over S-08's findings (task 42.2) — three toggle buttons, each with how many
 * it would show, the one in force pressed. **A view of the panel, not an address**: which findings are shown is the
 * reader's glance at a list, not a state anyone links to, so it is held by the section rather than the URL (UX-4 names
 * a finding's address, which 42.3 gives each row).
 */
export function PanelFilters({
  filter,
  counts,
  onChange,
}: {
  readonly filter: PanelFilter;
  readonly counts: PanelFindings['counts'];
  readonly onChange: (filter: PanelFilter) => void;
}) {
  const t = useTranslations(PANEL_MESSAGES);
  const options = [
    { value: PANEL_FILTER.ALL, label: t('filters.all', { count: counts.all }) },
    { value: PANEL_FILTER.MUST_FIX, label: t('filters.mustFix', { count: counts.mustFix }) },
    { value: PANEL_FILTER.REVIEW, label: t('filters.review', { count: counts.review }) },
  ];
  return (
    <div className={styles.filters} role="group" aria-label={t('filters.label')}>
      {options.map((option) => (
        <Button
          key={option.value}
          variant={option.value === filter ? BUTTON_VARIANT.SECONDARY : BUTTON_VARIANT.SUBTLE}
          aria-pressed={option.value === filter}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
