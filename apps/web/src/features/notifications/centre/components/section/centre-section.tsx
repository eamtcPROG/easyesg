import type { ReactNode } from 'react';
import { CENTRE_READ, readNotificationCentre } from '@/server/data/notifications';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { NOTICE_ARM, noticeArm } from '../../../shared/tools/notice-arm';
import { readCentreView } from '../../tools/centre-view';
import { CentreHeading } from '../heading/centre-heading';
import { CentreList } from '../list/centre-list';
import { CentreFirstUse } from '../states/centre-first-use';
import { CentreNothingUnread } from '../states/centre-nothing-unread';
import { CentreRefused } from '../states/centre-refused';
import { CentreUnreachable } from '../states/centre-unreachable';
import styles from '../styles/centre.module.css';

/**
 * S-26's one region: the view parsed off the address, the read it decides, and which of §8.1's arms applies (task
 * 50.2.1; UC-165 … UC-167). **It reads and chooses; every arm draws itself.**
 *
 * **Sequential, and the dependency is real**, S-16's reason: the tab and the page are the API's, so the request
 * cannot be made until the view is parsed. **The empty state is the Index archetype's choice** (`shared/tools/notice-arm.ts`), so
 * *nothing has arrived yet* and *nothing unread* stay two screens (§4.6).
 *
 * **Every member reads a centre**, so a refusal here means the session acts for no organization: a choice not yet
 * made is S-37's to answer, and anything else is the permission state.
 */
export async function CentreSection({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = readCentreView(await searchParams);
  const read = await readNotificationCentre(view);

  let body: ReactNode;
  if (read.status === CENTRE_READ.FORBIDDEN) {
    await redirectToChoiceIfOwed();
    body = <CentreRefused />;
  } else if (read.status === CENTRE_READ.UNREACHABLE) {
    body = <CentreUnreachable />;
  } else {
    const arm = noticeArm(read.page);
    body =
      arm === NOTICE_ARM.LIST ? (
        <CentreList page={read.page} view={view} />
      ) : arm === NOTICE_ARM.FIRST_USE ? (
        <CentreFirstUse />
      ) : (
        <CentreNothingUnread view={view} />
      );
  }

  return (
    <div className={styles.screen}>
      <CentreHeading unread={read.status === CENTRE_READ.READY ? read.unread : null} view={view} />
      {body}
    </div>
  );
}
