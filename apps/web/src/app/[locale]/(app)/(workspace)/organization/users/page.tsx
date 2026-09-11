import { AccessSection } from '@/features/organization/access/components/access-section';
import { ACCESS_MESSAGES } from '@/features/organization/access/components/access-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-16 — Users & access · OA · UC-59 … UC-64 · Index
 *
 * Answers "who can see our ESG data", and controls the answer. **One list across two collections**
 * — `identity.membership` and `identity.invitation` — because FR-56 asks for every user with access
 * "and their status, active or pending invitation", and task 25.1's migration recorded that the
 * union belongs in the read model. Removing someone ends their access without erasing their
 * attributed contributions (UC-63, FR-59), which the confirmation says before it happens (UX-69).
 *
 * **The screen never computes the caller's role.** Both API controllers carry
 * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` at class level, so an editor or a viewer is refused
 * and this renders the permission state from that refusal. One fewer round trip than reading
 * `/memberships` first, and one fewer place for this tier's belief about a role to disagree with
 * the server's.
 *
 * **Two omissions, both recorded rather than silent.** The seat-consumption region and UX-50's
 * entitlement gate are task 54.2's: UX-50 requires the limit, the allowance, current consumption
 * and the upgrade path *in that order*, and only consumption is knowable before `EntitlementPort`
 * has an implementation — a partial region would invite a reader to infer a ceiling nothing is
 * checking. And UC-175's manual reminder is task 50's, which now owns it; it appeared in this
 * screen's controls and in no task at all until this one was built.
 *
 * States (§8.1): ready · empty — first use · empty — filtered · error — permission · error —
 * recoverable. Loading is `loading.tsx`; the transient states of an action are the board's. *
 * **This file is a shell** (task 134, `shell-composes-only`): it pins the locale and renders the
 * section, which reads, decides the arm and draws. `loading.tsx` beside it is the screen's
 * `loading — initial`, on S-16's precedent — the whole body waits on the read, so there is no
 * shell worth streaming ahead of it.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(ACCESS_MESSAGES);

export default async function UsersAndAccessPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  return <AccessSection searchParams={searchParams} />;
}
