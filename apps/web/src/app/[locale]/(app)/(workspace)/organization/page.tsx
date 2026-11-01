import { ProfileSection } from '@/features/organization/profile/components/section/profile-section';
import { PROFILE_MESSAGES } from '@/features/organization/profile/components/shared/profile-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-15 — Organization profile · OA · UC-50 · Record
 *
 * The organization's account — its name, its country and how easyESG reaches it (FR-15 as amended). What a report
 * prints is each reporting entity's, on S-13: the identifiers since task 175, and the legal form, the registered
 * address and the report-cover contact since task 177.
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
 * records all three. The *report-cover contact* the prototype also drew here was a real field, added to FR-15 by task
 * 30.3 and moved to each company by task 177.
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
