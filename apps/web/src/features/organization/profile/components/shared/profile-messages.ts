/**
 * S-15's namespace, declared once.
 *
 * **Extracted by the split rather than after it** (task 129), on the lesson
 * `overview-messages.ts` records: the form spelled `'organization.profile'` twice, and breaking it
 * into a shell, three parts and four sections would have written it eight times. A namespace is one
 * value several files must spell identically, so it is a plain module rather than a member of some
 * larger object — it is not a closed vocabulary with alternatives to choose between.
 *
 * **In `components/shared/` because both component folders read it** — `form/` and `sections/` —
 * which is the same admission test `home-region.tsx` and the two `shared/` folders on S-05 use.
 * It is not in `tools/`: that folder is the screen's pure rules, and a catalogue key is a
 * presentation concern the components own.
 */
export const PROFILE_MESSAGES = 'organization.profile';
