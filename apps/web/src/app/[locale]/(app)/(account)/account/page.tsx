import { Suspense } from 'react';
import { ProfileLoading } from '@/features/profile/components/section/profile-loading';
import { ProfileSection } from '@/features/profile/components/section/profile-section';
import { PROFILE_MESSAGES } from '@/features/profile/components/shared/profile-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-27 — Profile, language, notification preferences · CA · UC-13, UC-14, UC-168 · Record (task 52.3)
 *
 * What is personal to the person rather than to any organization they belong to (FR-9): the name, the address they sign
 * in with, an optional job title and phone, three languages chosen independently (FR-10, FR-52, FR-169), and what
 * reaches them and where (FR-163). `design_spec.md` §5 owns the content; §12.5.6's task-52.3 row the decisions.
 *
 * **A shell** (`shell-composes-only`): it pins the locale and renders the section, which reads, decides the arm and
 * draws. **Its `loading — initial` is a `Suspense` boundary here**, not a `loading.tsx` beside it: one at `/account`
 * would also wrap S-28 beneath it (task 52's close review).
 */
export const generateMetadata = localizedPageTitle(PROFILE_MESSAGES);

export default async function ProfilePreferencesPage({ params }: { params: LocaleParams }) {
  await activateRequestLocale(params);
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileSection />
    </Suspense>
  );
}
