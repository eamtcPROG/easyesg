import { EmptyState } from '@easyesg/ui';
import type { AccountMembership } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { mayWrite } from '@/server/memberships';
import { attentionRows, type OverviewRow } from '../../../tools/overview';
import { FilingList } from './filing-list';
import { OverviewRegion } from '../shared/overview-region';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import styles from '../../styles/home.module.css';

/**
 * UX-6's first question — *what needs my attention* (UC-67, FR-23).
 *
 * **The empty arm is not a failure state.** It is UC-67's question answered *yes*, which is the one
 * answer the screen exists to be able to give, so it reads as reassurance rather than as an absence.
 *
 * **It takes the screen's whole row set and selects its own** (task 125, project owner's review): a region
 * owns its question end to end — the rule that answers it, the shape it takes, and the copy — so
 * adding one is a line in `overview-section.tsx` and changing what *needs attention* means is one
 * file. The section pre-selected for each region before, which made it the place three unrelated
 * rules had to be edited.
 *
 * **What it does NOT take is the read.** `attentionRows` is a pure selector over rows that are
 * already dated; `toOverviewRows` is where the clock enters, and it stays in the section. Parsing
 * the read here would give this region a `new Date()` of its own and let it call a filing overdue
 * while the *everything* region did not, on a request that happens to straddle midnight in the
 * period's zone.
 */
export async function AttentionRegion({
  rows,
  membership,
}: {
  /** Every row the screen has. The selection is this region's own. */
  readonly rows: readonly OverviewRow[];
  /** What the section read. `canWrite` is derived here rather than handed down — see below. */
  readonly membership: AccountMembership | null;
}) {
  const t = await getTranslations(OVERVIEW_MESSAGES);
  // FR-25, through the predicate that lives beside the read — one rule, called where it is needed,
  // never a second spelling of it.
  const canWrite = mayWrite(membership);
  const needingAttention = attentionRows(rows);

  return (
    <OverviewRegion heading={t('attention.heading')}>
      {needingAttention.length === 0 ? (
        <EmptyState title={t('attention.empty.title')} action={null}>
          {t('attention.empty.body')}
        </EmptyState>
      ) : (
        <>
          <p className={`t-body ${styles.lede}`}>{t('attention.lede')}</p>
          <FilingList rows={needingAttention} canWrite={canWrite} />
        </>
      )}
    </OverviewRegion>
  );
}
