import { readFactorState } from '@/server/data/credentials';
import { mayAdminister, readActiveMembership } from '@/server/data/memberships';
import { promptsEnrolment } from '../../../tools/enrolment-prompt';
import { EnrolmentPromptCallout } from '../callout/enrolment-prompt-callout';

/**
 * S-05's recommendation of a second factor to an Organization Administrator (task 190; `design_spec.md` S-05's
 * amendment of 6 Oct 2026; `architecture.md` §12.5.6's task-190 rows (4) … (6); UC-193's trigger, NFR-95).
 *
 * **The section reads; the part renders.** This file decides whether the region exists and nothing else: the role
 * first, from the membership the global tier has already read (`cache()`d, so it costs nothing), and only for an
 * administrator the factor's state — the one read over the network, which a member who cannot be prompted never pays
 * (`async-cheap-condition-before-await`). A `null` state means no prompt (`promptsEnrolment`).
 *
 * **A prompt and never a gate**: nothing on the screen waits on it, and it sits behind a boundary with no fallback, the
 * support-access banner's reason — its ordinary state is absent.
 */
export async function EnrolmentPrompt() {
  const administers = mayAdminister(await readActiveMembership());
  if (!administers) return null;
  if (!promptsEnrolment({ administers, factor: await readFactorState() })) return null;
  return <EnrolmentPromptCallout />;
}
