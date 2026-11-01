import { CREATE_ORGANIZATION_MESSAGES } from '@/features/organization/creation/components/create-organization-messages';
import { CreateOrganizationSection } from '@/features/organization/creation/components/create-organization-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-04 — Create organization · OA · UC-49 · Focus
 *
 * Reached when a signed-in user holds no membership (§4.3's *none* arm, task 25.4), and from the
 * switcher's *create another organization* when task 83 lands.
 *
 * **Focus here means the column, not the shell.** §4.6 lists the archetype's fixed elements as
 * "single column, centred, one primary action"; `FocusShell`'s dark header and footer are
 * `(identity)`'s chrome, and this screen already has chrome — the global tier renders above it
 * (task 30.1), which is exactly what the Workspace artboard draws. So it takes `FocusColumn`,
 * extracted for this screen, and the `<main>` landmark comes with it.
 *
 * **This screen used to mount its own client provider, on the PAGE rather than a layout**, which
 * was a first. **Task 99 removed it, along with fourteen others**: the root layout provides the
 * catalogue once, for every route group, so no screen names a namespace to reach the browser.
 *
 * `design_spec.md` §5 owns this screen's content, controls and states, and **OQ-20 owns why it has
 * four fields where the prototype draws five** — closed 29 Aug 2026, after the row was held rather
 * than built against a disagreement between the artboard and three other sources.
 *
 * **A shell since task 137** (`shell-composes-only`): it pins the locale and renders the section, which reads the
 * countries and draws the form (`features/organization/creation/components/create-organization-section.tsx`);
 * `loading.tsx` beside it waits for that read.
 */
export const generateMetadata = localizedPageTitle(CREATE_ORGANIZATION_MESSAGES);

export default async function CreateOrganizationPage({ params }: { params: LocaleParams }) {
  // The locale first and the section's read after it: `api-client` sends `getLocale()` as `Accept-Language`.
  await activateRequestLocale(params);
  return <CreateOrganizationSection />;
}
