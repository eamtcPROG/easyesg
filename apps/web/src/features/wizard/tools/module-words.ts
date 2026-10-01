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

/**
 * What the module covers, in one sentence under its heading (task 179.3) — platform-authored in three locales and
 * shipped with the release, like the name — or `null` for a module this release has no sentence for.
 */
export function moduleSummary(t: WizardTranslator, reference: string): string | null {
  return isNamedModule(reference) ? t(`summaries.${reference}`) : null;
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
 * The line under the heading's state, where the state's words leave UX-11's count unsaid (task 179.3), or `null`.
 *
 * The heading's state is the list's own words, and *In progress · 3 outstanding* already carries the count UX-11 asks
 * the step header for. *Not started* does not, so the count is said beneath it — every field of the module, since none
 * is answered. Complete, omitted, waiting and ruled out leave nothing outstanding to count.
 */
export function stepStatusNote(
  t: WizardTranslator,
  input: { readonly summary: DisclosureModuleSummary; readonly state: WizardStepState },
): string | null {
  return input.state === WIZARD_STEP_STATE.NOT_STARTED && input.summary.total > 0
    ? t('step.outstanding', { count: input.summary.total - input.summary.answered })
    : null;
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
