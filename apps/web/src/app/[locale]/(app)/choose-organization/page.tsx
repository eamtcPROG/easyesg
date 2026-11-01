import { ChooseOrganizationSection } from '@/features/organization/choice/components/choose-organization-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-37 — Choose organization · CA · UC-16 · Focus (task 83.3)
 *
 * §4.3's *Choose organization* step: an account holding several memberships, with none chosen for this
 * session, chooses which to act for. **No navigation reaches it.** §4.3's branch sends a reader here
 * after sign-in, and the gate on the workspace and the wizard sends one here from any screen that needs
 * an organization — a choice left stale by a removal included (`design_spec.md` S-37).
 *
 * **In `(app)`, beside S-04 and S-35, and outside both organization-scoped groups**: the global tier
 * stands above it naming no organization, and neither the workspace tier nor the gate that would send
 * it to itself does.
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and renders the section, which
 * decides whether the screen applies and reads the list.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<{ return?: string }>;
};

export const generateMetadata = localizedPageTitle('organization.choice');

export default async function ChooseOrganizationPage({ params, searchParams }: Props) {
  const locale = await activateRequestLocale(params);
  return <ChooseOrganizationSection searchParams={searchParams} locale={locale} />;
}
