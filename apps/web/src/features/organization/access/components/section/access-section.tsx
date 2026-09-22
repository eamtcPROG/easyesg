import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Suspense, type ReactNode } from 'react';
import { ACCESS_READ, readOrganizationAccess } from '@/server/data/organization-access';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readAccessView } from '../../tools/access';
import { seatRegion } from '../../tools/seats';
import { AccessBoard } from '../board/section/access-board';
import { AccessProvider } from '../shared/access-context';
import { ACCESS_MESSAGES } from '../shared/access-messages';
import { InviteMember } from '../invite/section/invite-member';
import { RemindSection } from '../remind/section/remind-section';
import { RemindLoading } from '../remind/states/remind-loading';
import { SeatCounter } from '../heading/seat-counter';
import styles from '../styles/access.module.css';

/** The invite panel's heading, so the first-use empty state can send a reader straight to it. */
const INVITE_ANCHOR = 'invite-a-colleague';

/**
 * S-16's one region: the view parsed off the address, the read it decides, and which of §8.1's
 * arms applies (UC-59 … UC-64; cut out of the route by task 134's parent-close review).
 *
 * **Sequential, and the dependency is real** (task 131): the filter, the order and the page are the
 * API's, so the request cannot be made until the view is parsed — `async-parallel` is about
 * *independent* work. **No clock here**: the standing is derived by the database in the same
 * statement that filters and orders on it. **One provider over BOTH regions** (28 Aug 2026): it
 * used to sit inside `AccessBoard`, which left the invite panel holding an outcome of its own that
 * nothing else could clear. The screen holds one notice; each region renders it only when it is
 * theirs. **The seat region is computed here, once** (task 142): the counter beside the heading and
 * the invite panel's arm read the same value, so they cannot disagree about whether the organization
 * is full — and the counter renders only on the ready arm, since a refused or failed read has no
 * count to state. **The reminder panel is a region of its own** (task 50.3, `remind-section.tsx`): it
 * reads under its own boundary inside the provider, so the list does not wait on its reads and a
 * failure of either is the panel's partial state rather than the screen's.
 */
export async function AccessSection({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = readAccessView(await searchParams);
  const [read, t] = await Promise.all([readOrganizationAccess(view), getTranslations(ACCESS_MESSAGES)]);

  let body: ReactNode;
  let counter: ReactNode = null;
  if (read.status === ACCESS_READ.FORBIDDEN) {
    // A choice not made is S-37's to answer, and this arm renders on every navigation (the gate says why).
    await redirectToChoiceIfOwed();
    body = (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('error.permission.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HOME}>{t('error.permission.action')}</Link>
          </TextLink>
        }
      >
        {t('error.permission.body')}
      </Callout>
    );
  } else if (read.status === ACCESS_READ.UNREACHABLE) {
    body = (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('error.unreachable.title')}
        // The body already says to reload, which is this screen's whole remedy.
        action={null}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  } else {
    const seats = seatRegion(read.seats);
    counter = <SeatCounter region={seats} />;
    body = (
      <AccessProvider page={read.page} view={view} seats={seats} inviteAnchorId={INVITE_ANCHOR}>
        <AccessBoard />
        <InviteMember id={INVITE_ANCHOR} />
        {/* A region of its own, under its own boundary: the list above does not wait on its reads. */}
        <Suspense fallback={<RemindLoading />}>
          <RemindSection />
        </Suspense>
      </AccessProvider>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <hgroup>
          <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
          <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
        </hgroup>
        {counter}
      </div>
      {body}
    </div>
  );
}
