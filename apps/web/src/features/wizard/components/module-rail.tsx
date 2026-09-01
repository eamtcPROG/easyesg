import { WizardModuleItem } from '@easyesg/ui';
import type { DisclosureModuleSummary } from '@easyesg/contracts';
import { Link } from '@/i18n/navigation';
import { reportStepRoute } from '@/lib/routes';
import styles from './module-rail.module.css';

/**
 * S-07's persistent module list (UX-5), as the rail's items.
 *
 * **The module reference is the label, and it is not a translated string.** `B1` … `C9` are the
 * standard's own identifiers — the same tokens EFRAG prints and an auditor cites — so they are data
 * rather than wording, like a NACE code or an invoice number. `CLAUDE.md`'s user-facing-text rule
 * names *"a reference code shown on purpose"* as the exception this is; the module's plain-language
 * name arrives beside it once task 36 has one per module to show.
 *
 * **The counts are the per-module state indicator UX-5 requires**, and they are the honest one
 * available today: FR-40's validation verdicts are task 40's, so a coloured status would be a
 * judgement nothing has made.
 */
export function ModuleRail({
  reportId,
  modules,
  current,
  answeredLabel,
}: {
  readonly reportId: string;
  readonly modules: readonly DisclosureModuleSummary[];
  readonly current: string;
  /** `{answered} of {total}` in the reader's language — the app owns the words. */
  readonly answeredLabel: (summary: DisclosureModuleSummary) => string;
}) {
  return (
    <>
      {modules.map((module) => (
        <WizardModuleItem
          key={module.module}
          current={module.module === current}
          indicator={<span className={styles.count}>{answeredLabel(module)}</span>}
        >
          <Link href={reportStepRoute({ reportId, module: module.module })} className={styles.link}>
            {module.module}
          </Link>
        </WizardModuleItem>
      ))}
    </>
  );
}
