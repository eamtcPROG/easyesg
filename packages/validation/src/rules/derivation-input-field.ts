/**
 * **The values a computed figure is worked out from, as fields a rule can require** (task 254; FR-29, FR-40;
 * `architecture.md` §12.5.6's task-254 row (1)) — read into a report's evaluation beside its disclosure answers, so a
 * rule requires B10's count of employees covered by collective bargaining as it requires an answer, on the box the
 * reporter types it into, and never on the figure the platform computes from it.
 *
 * **A prefix rather than a closed vocabulary**, unlike `ENTITY_FIELD`: which inputs exist is the derivation artefact's
 * (AD-4), so a list here would be a second copy of published data. The prefix is what is fixed, and it is the whole of
 * the rule: EFRAG's element keys are bare names, so `input:` cannot collide with one in any version, and a finding's
 * field says by its key alone that a derivation input — not a disclosure — is where it is answered.
 *
 * **Here because both tiers read it**: the api places the inputs in a run's scope and answers, and the browser holds
 * the inputs it serves and queues under the same key, so a live verdict and a run's land on the same box.
 */
const PREFIX = 'input:';

/** A derivation input's key as a field — what a rule names and a finding carries. */
export const derivationInputField = (inputKey: string): string => `${PREFIX}${inputKey}`;

/** Whether a field key — a finding's, as read from the wire — names a derivation input rather than a disclosure. */
export const isDerivationInputField = (elementKey: string): boolean =>
  elementKey.startsWith(PREFIX) && elementKey.length > PREFIX.length;

/** The input's own key, for a field that names one; `null` for any other field. */
export const inputKeyOf = (elementKey: string): string | null =>
  isDerivationInputField(elementKey) ? elementKey.slice(PREFIX.length) : null;
