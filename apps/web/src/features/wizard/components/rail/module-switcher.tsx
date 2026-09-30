'use client';

import type { DisclosureModuleSummary } from '@easyesg/contracts';
import { WizardModuleSwitcher } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { reportStepRoute } from '@/lib/routes';
import { moduleStateOf } from '../../tools/module-state';
import { moduleLabel, moduleName, moduleStatus } from '../../tools/module-words';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';
import { StepLink } from './step-link';

/**
 * S-07's module list below `wide` — the strip at 834 and the stepper at 390, each opening the whole list as a drawer
 * (task 179.1; `design_spec.md` S-07's amendment of 30 Sep 2026).
 *
 * **A Client Component because `WizardModuleSwitcher` takes functions** — the *+n* control's name for however many
 * steps it stands for — and a function cannot cross from a Server Component. So this reads its own words, through the
 * same helpers the docked rail uses, and injects the same `StepLink`.
 *
 * **The drawer's list is the section's `ModuleRail`**, handed in as children and rendered, never introspected — one
 * list, drawn by one component, docked or in the drawer.
 */
export function ModuleSwitcher({
  reportId,
  modules,
  current,
  children,
}: {
  readonly reportId: string;
  readonly modules: readonly DisclosureModuleSummary[];
  readonly current: string;
  /** The docked rail's list, for the drawer. */
  readonly children: ReactNode;
}) {
  const t = useTranslations(WIZARD_MESSAGES);
  const steps = modules.map((summary) => {
    const state = moduleStateOf(summary);
    return {
      key: summary.module,
      href: reportStepRoute({ reportId, module: summary.module }),
      reference: summary.module,
      label: moduleLabel(t, summary.module),
      name: moduleName(t, summary.module),
      state,
      status: moduleStatus(t, { summary, state }),
    };
  });
  const position = modules.findIndex((summary) => summary.module === current) + 1;

  return (
    <WizardModuleSwitcher
      steps={steps}
      currentKey={current}
      listLabel={t('rail.label')}
      allLabel={t('rail.all')}
      moreLabel={(count) => t('rail.more', { count })}
      position={t('rail.position', { module: current, position, total: modules.length })}
      closeLabel={t('rail.close')}
      linkComponent={StepLink}
    >
      {children}
    </WizardModuleSwitcher>
  );
}
