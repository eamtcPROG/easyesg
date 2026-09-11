import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ACCESS_READ, readOrganizationAccess } from '@/server/data/organization-access';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readAccessView } from '../tools/access';
import { AccessBoard } from './access-board';
import { AccessProvider } from './access-context';
import { ACCESS_MESSAGES } from './access-messages';
import { InviteMember } from './invite-member';
import styles from './access.module.css';

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
 * theirs.
 */
export async function AccessSection({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = readAccessView(await searchParams);
  const [read, t] = await Promise.all([readOrganizationAccess(view), getTranslations(ACCESS_MESSAGES)]);

  let body: ReactNode;
  if (read.status === ACCESS_READ.FORBIDDEN) {
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
        action={t('error.unreachable.action')}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  } else {
    body = (
      <AccessProvider page={read.page} view={view} inviteAnchorId={INVITE_ANCHOR}>
        <AccessBoard />
        <InviteMember id={INVITE_ANCHOR} />
      </AccessProvider>
    );
  }

  return (
    <div className={styles.screen}>
      <hgroup>
        <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
        <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
      </hgroup>
      {body}
    </div>
  );
}
