import type { TotpState } from '@easyesg/contracts';

/**
 * Whether S-05 recommends a second factor (task 190; `design_spec.md` S-05's amendment of 6 Oct 2026; UC-193's trigger,
 * NFR-95): to an Organization Administrator of the active organization, whose account holds no confirmed factor and
 * has not said *not now*.
 *
 * **Every unknown answers no.** A factor state that could not be read is `null`, and a recommendation is not worth a
 * guess — showing it to someone already enrolled would be a false sentence on their home screen. The role arrives as a
 * boolean, decided by `mayAdminister` beside the membership read, so this stays pure and its spec needs no server.
 */
export const promptsEnrolment = (input: {
  readonly administers: boolean;
  readonly factor: TotpState | null;
}): boolean =>
  input.administers &&
  input.factor !== null &&
  !input.factor.enrolled &&
  !input.factor.enrolmentPromptDismissed;
