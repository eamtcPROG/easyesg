import { RULE_FAMILY, type RulesSlot } from '@easyesg/contracts';
import { useTranslations } from 'use-intl';
import { RulesSlotEditor } from '../slot/rules-slot-editor';

/**
 * A-05's board (task 67.8): one region per rule family — the emission factor sets, the applicability thresholds and the
 * validation rule set — each listing its slots in force, an editor per slot. The family's consequence is stated beside
 * its publication (§5.2 A-05's validation behaviour).
 */
export function RulesBoard({ slots }: { readonly slots: readonly RulesSlot[] }) {
  const t = useTranslations('platform.rules');
  return (
    <div className="flex flex-col gap-[var(--space-7)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1 className="t-heading-2">{t('title')}</h1>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
      </header>
      {Object.values(RULE_FAMILY).map((family) => (
        <section key={family} aria-labelledby={`rules-${family}`} className="flex flex-col gap-[var(--space-3)]">
          <h2 id={`rules-${family}`} className="t-heading-3">
            {t(`families.${family}.title`)}
          </h2>
          <p className="t-body text-[var(--text-muted)]">{t(`families.${family}.consequence`)}</p>
          {slots
            .filter((slot) => slot.family === family)
            .map((slot) => (
              <RulesSlotEditor key={`${slot.scope}/${slot.validFrom ?? ''}/${slot.revision}`} slot={slot} />
            ))}
        </section>
      ))}
    </div>
  );
}
