import { STATUS_TONE, StatusChip } from '@easyesg/ui';
import type { AccountMembership } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { MEMBERSHIPS_MESSAGES } from '../shared/memberships-messages';
import styles from '../../styles/home.module.css';

/**
 * One organization the reader belongs to, and the role they hold in it (FR-12, UC-16).
 *
 * **It takes the whole membership, not three strings** — the rule S-05's overview arrived at over
 * two passes of the owner's review (task 125): a region, or a row, receives what was *read* and
 * derives what it needs. Three positional props would also be three adjacent `string`s, which the
 * root `CLAUDE.md` forbids for the reason a swap compiles and renders a plausible wrong answer.
 *
 * **The active one is marked in words as well as by the chip.** Colour is never the sole carrier
 * (UX-102). The row stays information rather than a control even now that the organizations are
 * choosable: OQ-6 gives the switching to the global tier's switcher (task 83.2), and to S-37 where the
 * session has chosen none — and `memberships-switch-note.tsx` says where the switcher is.
 *
 * **Its own translator, not the list's.** The row is the thing that renames when the copy changes,
 * and `getTranslations` resolves against a catalogue the request has already read — a microtask, not
 * a round trip, which is the distinction `overview-loading.tsx` draws for a Suspense fallback.
 *
 * **The role namespace stays a literal here**, as it is at its other readers, so merging it would mean a
 * module more than one feature reads — a feature-level shared thing, and a bigger decision than this split.
 */
export async function MembershipRow({ membership }: { readonly membership: AccountMembership }) {
  const [t, tRoles] = await Promise.all([
    getTranslations(MEMBERSHIPS_MESSAGES),
    getTranslations('organization.access.roles'),
  ]);

  return (
    <li className={styles.membership}>
      <span className={styles.rowName}>{membership.organizationName}</span>
      <span className={`t-caption ${styles.sub}`}>{tRoles(membership.role)}</span>
      {membership.active ? (
        <StatusChip tone={STATUS_TONE.POSITIVE}>{t('active')}</StatusChip>
      ) : null}
    </li>
  );
}
