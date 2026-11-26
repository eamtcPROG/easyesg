import { EmptyState } from '@easyesg/ui';
import type { AccountMembership, Invitation } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { mayWrite } from '@/server/data/memberships';
import { ATTENTION_ITEM_KIND, attentionItems } from '../../../tools/attention';
import type { OverviewRow } from '../../../tools/overview';
import { OverviewRegion } from '../shared/overview-region';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import { AttentionFiling } from './attention-filing';
import { AttentionInvitation } from './attention-invitation';
import styles from '../../styles/home.module.css';

/**
 * UX-6's first question — *what needs my attention* (UC-67, FR-23) — drawn as the artboard's card of items (task 255).
 *
 * **It owns its question end to end** (task 125): the selection (`attentionItems` over the filings `attentionRows`
 * keeps, then the invitations), its count at the label's end, and the words of each item, which its two parts choose.
 *
 * **The empty arm is not a failure state.** It is UC-67's question answered *yes*, which is the one answer the screen
 * exists to be able to give, so it reads as reassurance rather than as an absence.
 *
 * **An administrator whose invitations could not be read is told so**, beneath whatever filings there are, rather than
 * shown a list that silently lacks them — `null` is *we could not tell*, which an empty list would misstate as
 * *nobody is waiting*. A member who does not administer is never asked about invitations, so has none to miss.
 *
 * **It takes rows, not the read**, and `now` beside them: both were fixed once for the request in
 * `server/data/overview.ts`, so an invitation's *lapsed* and a filing's *overdue* are read at the same instant.
 */
export async function AttentionRegion({
  rows,
  invitations,
  now,
  membership,
}: {
  /** Every row the screen has. The selection is this region's own. */
  readonly rows: readonly OverviewRow[];
  /** An administrator's outstanding invitations; `null` where they could not be read; empty for anyone else. */
  readonly invitations: readonly Invitation[] | null;
  /** Epoch-ms — the instant the rows were dated at. */
  readonly now: number;
  /** What the section read. `canWrite` is derived here, through FR-25's one predicate. */
  readonly membership: AccountMembership | null;
}) {
  const t = await getTranslations(OVERVIEW_MESSAGES);
  const canWrite = mayWrite(membership);
  const items = attentionItems({ rows, invitations: invitations ?? [], now });

  return (
    <OverviewRegion
      heading={t('attention.heading')}
      meta={items.length === 0 ? null : t('attention.count', { count: items.length })}
      place={styles.attentionRegion}
    >
      <div className={styles.card}>
        {items.length === 0 ? (
          <div className={styles.cardInset}>
            <EmptyState title={t('attention.empty.title')} action={null}>
              {t('attention.empty.body')}
            </EmptyState>
          </div>
        ) : (
          <ul className={styles.items}>
            {items.map((item) =>
              item.kind === ATTENTION_ITEM_KIND.FILING ? (
                <AttentionFiling key={`filing:${item.row.periodId}`} concern={item.concern} row={item.row} canWrite={canWrite} />
              ) : (
                <AttentionInvitation key={`invitation:${item.invitation.id}`} concern={item.concern} invitation={item.invitation} />
              ),
            )}
          </ul>
        )}
        {invitations === null ? (
          <p className={`t-caption ${styles.itemsNote}`}>{t('attention.invitationsUnreachable')}</p>
        ) : null}
      </div>
    </OverviewRegion>
  );
}
