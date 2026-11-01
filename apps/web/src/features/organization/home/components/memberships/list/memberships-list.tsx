import type { AccountMembership } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { MembershipRow } from './membership-row';
import { MEMBERSHIPS_MESSAGES } from '../shared/memberships-messages';
import styles from '../../styles/home.module.css';

/**
 * The ready arm: where the reader belongs, and what they are in each place (UC-16, FR-12).
 *
 * **OQ-6 is why this list is on S-05 at all**: UC-16 is two behaviours, and this screen owns
 * *viewing* while the global tier owns *switching* (task 83). So the list states and does not act —
 * which is information, not a control that cannot act. `memberships-switch-note.tsx` is where the
 * reader is told where the acting happens, and it sits outside this arm because it is true in the
 * failure arm too.
 *
 * **No `DataTable`, for the reason `filing-list.tsx` records on the same screen**: §11.5's table is
 * the Index archetype's — sortable, filterable, paginated — and takes `cell` render functions a
 * Server Component cannot hand across the RSC boundary at all. This list has one order and no
 * question to sort by.
 *
 * **The rows are `MembershipRow`, and the `ul`/`li` pairing is why it is a component rather than a
 * map here.** A row owns its own copy and its own chip; this file owns the list semantics and the
 * lede. `.memberships` and `.membership` in the shared stylesheet are the same row idiom the filings
 * list wears, which is what `.rowName` was renamed for in task 126.
 */
export async function MembershipsList({
  memberships,
}: {
  readonly memberships: readonly AccountMembership[];
}) {
  const t = await getTranslations(MEMBERSHIPS_MESSAGES);

  return (
    <>
      <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
      <ul className={styles.memberships}>
        {memberships.map((membership) => (
          <MembershipRow key={membership.id} membership={membership} />
        ))}
      </ul>
    </>
  );
}
