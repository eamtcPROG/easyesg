import { ProfileSection } from '@/features/organization/profile/components/section/profile-section';
import { PROFILE_MESSAGES } from '@/features/organization/profile/components/shared/profile-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-15 — Organization profile and identifiers · OA · UC-50, UC-51 · Record
 *
 * The legal identity that propagates into every report the organization produces (FR-15), and
 * FR-16's identifiers — **IDNO primary, LEI optional** (OQ-18; DUNS, EU ID and PermID are not
 * modelled and this screen must not offer them).
 *
 * **The screen never computes the caller's role.** `OrganizationController` carries
 * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` at class level, so an editor or a viewer is refused
 * and this renders the permission state from that refusal — S-16's rule, and one fewer place for
 * this tier's belief about a role to disagree with the server's.
 *
 * **Three of the prototype's regions are deliberately absent**, each with an owner elsewhere:
 * VAT registration, the e-Factura recipient and the callout about issued invoices are FR-106's
 * billing account and belong to S-23, and a default report language is not an organization setting
 * at all — FR-52 makes export language a choice taken per export, at S-11. `design_spec.md` S-15
 * records all three, and the *report-cover contact* is the fourth, which turned out to be a real
 * field nobody had written down and now amends FR-15.
 *
 * **The catalogue reaches the browser from the root layout, once** (task 99) — this screen used to
 * mount its own scoped provider, which is what that paragraph described.
 *
 * States (§8.1): error — permission · error — recoverable · ready. The form owns the rest. *
 * **This file is a shell** (task 134, `shell-composes-only`): it pins the locale and renders the
 * section, which reads, decides the arm and draws. `loading.tsx` beside it is the screen's
 * `loading — initial`, on S-16's precedent — the whole body waits on the read, so there is no
 * shell worth streaming ahead of it.
 */
export const generateMetadata = localizedPageTitle(PROFILE_MESSAGES);

export default async function OrganizationProfilePage({ params }: { params: LocaleParams }) {
  // Sequential, and a data dependency rather than the waterfall `async-parallel` names: pinning
  // the locale is what `api-client` resolves `Accept-Language` from, so the section's read must
  // not be hoisted above it.
  await activateRequestLocale(params);
  return <ProfileSection />;
}
