import { getNow } from 'next-intl/server';
import { mayAdminister, readActiveMembership } from '@/server/data/memberships';
import { readSupportAccess } from '@/server/data/support-access';
import { ActiveBanner } from '../active/section/active-banner';
import { AwaitingBanner } from '../awaiting/section/awaiting-banner';
import styles from '../styles/support-access.module.css';

/**
 * UX-124's organization side (task 67.9; A-07's *organization's side*; FR-78 as amended 14 Sep 2026) — the banners
 * across every signed-in tenant screen saying that EasyESG support is asking to read the organization's reports, or
 * is reading them now.
 *
 * **In the `(app)` layout, beside the global tier**, because *every signed-in screen* is the requirement and that
 * layout is the one ancestor they share — S-04 and S-35 included, where the read is refused or unreadable and this
 * draws nothing.
 *
 * **The read is this section's; the banners take what was read.** Access running now comes first, because it is
 * happening; requests waiting for an answer follow. The one decision made here rather than by the API is whether
 * to offer *End access*, from the membership the global tier already read in this request — presentation only.
 */
export async function SupportAccessBanners() {
  const [shown, membership, now] = await Promise.all([
    readSupportAccess(),
    readActiveMembership(),
    getNow(),
  ]);
  if (shown === null || (shown.active === null && shown.awaiting.length === 0)) return null;

  return (
    <div className={styles.banners}>
      {shown.active === null ? null : (
        <ActiveBanner request={shown.active} now={now} mayEnd={mayAdminister(membership)} />
      )}
      {shown.awaiting.map((request) => (
        <AwaitingBanner key={request.id} request={request} />
      ))}
    </div>
  );
}
