import { ValidationGroup } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { PanelGroup } from '../../../tools/panel-findings';
import { moduleLabel } from '../../../tools/module-words';
import { WIZARD_MESSAGES } from '../../shared/wizard-messages';
import { PANEL_MESSAGES } from '../shared/panel-messages';
import { FindingRow } from './finding-row';

/**
 * S-08's findings, a group per module in the list's order (task 42.2; UX-20) — each headed as the list names it,
 * *B1 — Basis for preparation*, so the panel and the list can be read against each other.
 */
export function PanelGroups({ reportId, groups }: { readonly reportId: string; readonly groups: readonly PanelGroup[] }) {
  const t = useTranslations(PANEL_MESSAGES);
  const tWizard = useTranslations(WIZARD_MESSAGES);
  return groups.map((group) => (
    <ValidationGroup
      key={group.module}
      heading={moduleLabel(tWizard, group.module)}
      count={t('groupCount', { count: group.findings.length })}
    >
      {group.findings.map((entry) => (
        <FindingRow key={entry.key} reportId={reportId} module={group.module} entry={entry} />
      ))}
    </ValidationGroup>
  ));
}
