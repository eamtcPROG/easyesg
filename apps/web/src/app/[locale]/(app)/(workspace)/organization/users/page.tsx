import { AccessSection } from '@/features/organization/access/components/section/access-section';
import { ACCESS_MESSAGES } from '@/features/organization/access/components/shared/access-messages';
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
 * **The seat region and UX-50's gate ship with task 142**, over the interim configured ceiling rather
 * than waiting for task 54.2, which changes the ceiling's source and not this screen. **UC-175's manual
 * reminder is the panel below the list since task 50.3** — it appeared in this screen's controls and in
 * no task at all until task 26.4 built the screen, which is how it came to be task 50's.
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
