import { LegalControllerSection } from '../record/section/legal-controller-section';

/**
 * A-21 — The platform operator (task 75; FR-205; `design_spec.md` §5.2 A-21). **The shell composes the screen's
 * regions** (`shell-composes-only`): the one record, which reads its own data and draws its own states.
 */
export function LegalController() {
  return (
    <div className="flex flex-col gap-[var(--space-7)] p-[var(--space-6)]">
      <LegalControllerSection />
    </div>
  );
}
