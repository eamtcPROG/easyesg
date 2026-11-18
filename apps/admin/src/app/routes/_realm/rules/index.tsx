/**
 * A-05 — Factor sets, thresholds, validation rules · PA · UC-80 … UC-82 · Editor (task 67.8)
 *
 * The calculation and rule layer held as configuration (AD-4): emission factor sets per country and window, the
 * conditional-applicability thresholds and the validation rule set, each published for the window it was read in. A
 * factor set replaced in its window and a threshold change each tell the organizations they reach (FR-166). The screen
 * is `features/platform/configuration/`; it has no addressable state of its own. **The api decides who reads.**
 */
import { createFileRoute } from '@tanstack/react-router';
import { RulesConsoleSection } from '~/features/platform/configuration/components/section/rules-console-section';

export const Route = createFileRoute('/_realm/rules/')({
  component: RulesRoute,
});

function RulesRoute() {
  return (
    <div className="flex flex-col gap-[var(--space-7)] p-[var(--space-6)]">
      <RulesConsoleSection />
    </div>
  );
}
