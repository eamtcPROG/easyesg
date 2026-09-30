import type { DisclosureModuleSummary } from '@easyesg/contracts';
import { WizardModuleGroup, WizardModuleItem } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { reportStepRoute } from '@/lib/routes';
import { moduleGroups, moduleStateOf, rollUp } from '../../tools/module-state';
import { moduleLabel, moduleStatus, rollUpNote } from '../../tools/module-words';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';
import styles from './module-rail.module.css';
import { StepLink } from './step-link';

/**
 * S-07's module list (UX-5), as `EasyESG Reporting Core.dc.html`'s rail draws it (task 179.1): a group per module
 * of the standard — the Basic, and the Comprehensive where the scope carries it — headed by its roll-up, then each
 * module named, marked and stated in words, then the sentence that says the order is the reader's.
 *
 * **The same list twice**: docked beside the step at `wide`, and in the drawer below it, where the section hands it to
 * `ModuleSwitcher` as children. It reads its own words, so the two drawings are one render of one component.
 *
 * **The module reference leads its name and is not a translated string.** `B1` … `C9` are the standard's own
 * identifiers — what EFRAG prints and an auditor cites — so they are data, like a NACE code; the root `CLAUDE.md`'s
 * *"a reference code shown on purpose"* is this case. The plain-language name beside it is the catalogue's.
 *
 * **A module FR-28 has ruled out, or one waiting on B1, stays reachable**: UX-28 keeps values entered before the
 * condition turned, and a module nobody can open is a module nobody can see them in.
 */
export async function ModuleRail({
  reportId,
  modules,
  current,
}: {
  readonly reportId: string;
  readonly modules: readonly DisclosureModuleSummary[];
  readonly current: string;
}) {
  const [t, format] = await Promise.all([getTranslations(WIZARD_MESSAGES), getFormatter()]);

  return (
    <>
      {moduleGroups(modules).map(({ group, modules: members }) => {
        const counts = rollUp(members);
        return (
          <WizardModuleGroup
            key={group}
            name={t(`rail.groups.${group}`)}
            count={t('rail.count', { done: counts.done, counted: counts.counted })}
            segments={members.map((summary) => ({ key: summary.module, state: moduleStateOf(summary) }))}
            note={rollUpNote(t, format, counts)}
          >
            {members.map((summary) => {
              const state = moduleStateOf(summary);
              return (
                <WizardModuleItem
                  key={summary.module}
                  href={reportStepRoute({ reportId, module: summary.module })}
                  label={moduleLabel(t, summary.module)}
                  state={state}
                  status={moduleStatus(t, { summary, state })}
                  current={summary.module === current}
                  // The locale-aware link, injected: `packages/ui` holds no router. Since task 92 it asks whether the
                  // session is still held before a step change (`step-link.tsx`).
                  linkComponent={StepLink}
                />
              );
            })}
          </WizardModuleGroup>
        );
      })}
      <p className={styles.footer}>{t('rail.footer')}</p>
    </>
  );
}
