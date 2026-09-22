import { CentreSection } from '@/features/notifications/centre/components/section/centre-section';
import { CENTRE_MESSAGES } from '@/features/notifications/centre/components/shared/centre-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-26 — Notification centre · CA · UC-165 … UC-167 · Index (task 50.2.1)
 *
 * Persistent storage for everything the system needs a person to know, never a stream of toasts (UX-62): a notice
 * raised while the reader was away is waiting on return, each is a link to what raised it (UX-63), and read state is
 * the reader's own (UX-64). Opening a notice records it read; *mark as read*, *dismiss* and *mark all as read* are
 * the reader's own writes (`architecture.md` §12.5.6's task-50.2 rows (2) … (4)).
 *
 * States (§8.1): ready · empty — first use · empty — filtered · loading — initial (`loading.tsx`) · loading — refresh
 * (a control's pending state) · error — recoverable · error — permission.
 *
 * **This file is a shell** (task 134, `shell-composes-only`): it pins the locale and renders the section, which
 * reads, decides the arm and draws.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(CENTRE_MESSAGES);

export default async function NotificationCentrePage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  return <CentreSection searchParams={searchParams} />;
}
