import type { DisclosureModuleSummary } from '@easyesg/contracts';
import { WIZARD_STEP_STATE, type WizardStepState } from '@easyesg/ui';
import type { useFormatter, useTranslations } from 'next-intl';
import { isNamedModule } from './module-names';
import type { ModuleRollUp } from './module-state';

/**
 * What a module is called and where it stands, in the reader's words (task 179.1).
 *
 * **One home for the rail and the switcher.** The docked list is a Server Component and the strip below `wide` a
 * Client Component; each reads its own words, and both word a module through these — so *B1 — Basis for preparation*
 * and *In progress · 3 outstanding* cannot drift between the two drawings of the same step.
 *
 * Pure given the translator, which the caller passes: the server's `getTranslations` and the browser's
 * `useTranslations` for the same namespace are the same function type.
 */
type WizardTranslator = ReturnType<typeof useTranslations<'organization.wizard'>>;
type Formatter = ReturnType<typeof useFormatter>;

/** The plain-language name, or `null` for a module this release has none for (`module-names.ts`). */
export function moduleName(t: WizardTranslator, reference: string): string | null {
  return isNamedModule(reference) ? t(`modules.${reference}`) : null;
}

/** *B1 — Basis for preparation*, or the reference alone where there is no name. */
export function moduleLabel(t: WizardTranslator, reference: string): string {
  const name = moduleName(t, reference);
  return name === null ? reference : t('moduleLabel', { module: reference, name });
}

/** The rail's line — *In progress · 3 outstanding*. The state is the caller's `moduleStateOf`, passed so it is read once. */
export function moduleStatus(
  t: WizardTranslator,
  input: { readonly summary: DisclosureModuleSummary; readonly state: WizardStepState },
): string {
  switch (input.state) {
    case WIZARD_STEP_STATE.COMPLETE:
      return t('rail.state.complete');
    case WIZARD_STEP_STATE.IN_PROGRESS:
      return t('rail.state.inProgress', { count: input.summary.total - input.summary.answered });
    case WIZARD_STEP_STATE.NOT_STARTED:
      return t('rail.state.notStarted');
    case WIZARD_STEP_STATE.OMITTED:
      return t('rail.state.omitted');
    case WIZARD_STEP_STATE.WAITING:
      return t('rail.state.waiting');
    case WIZARD_STEP_STATE.INAPPLICABLE:
      return t('rail.state.inapplicable');
  }
}

/**
 * The roll-up's sentence — what is not counted, then what waits — or `null` where there is neither. Two whole
 * messages, each with its list formatted by the locale's own conjunction (UX-95: never a list assembled by hand).
 */
export function rollUpNote(t: WizardTranslator, format: Formatter, rollUp: ModuleRollUp): string | null {
  const sentences = [
    rollUp.discounted.length > 0
      ? t('rail.discounted', { modules: format.list(rollUp.discounted, 'enumeration') })
      : null,
    rollUp.waiting.length > 0
      ? t('rail.waiting', { modules: format.list(rollUp.waiting, 'enumeration'), count: rollUp.waiting.length })
      : null,
  ].filter((sentence) => sentence !== null);
  return sentences.length === 0 ? null : sentences.join(' ');
}
