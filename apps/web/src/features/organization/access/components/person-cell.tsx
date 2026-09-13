import { ACCESS_ROW_KIND, type AccessRow } from '../tools/access';
import styles from './access.module.css';

/**
 * S-16's person column — UX-137's *"S-16's member list"*, which is the third of the three surfaces
 * task 140 names.
 *
 * **Two lines for a member, one for an invitation, and the difference is a fact rather than a
 * layout choice.** A member has an account, so there is a person to name and an address that says
 * *which* account they are; an invitation has only an address, because nobody holds it yet. Drawing
 * the address in a name's slot for an invitation would make *"no account exists"* and *"an account
 * whose name is unset"* render identically, and those are the two states an administrator most
 * needs to tell apart on this screen.
 *
 * **The address never leaves the cell**, and that is the rule this column shares with the account
 * menu's identity block. Every action on the row speaks in addresses — the confirmation dialogue's
 * `object`, *"the invitation has been resent to …"*, the role-change announcement — so a cell that
 * showed a name alone would leave the reader unable to match the row to the sentence about it. Two
 * people sharing a display name is the case that makes it necessary rather than merely tidy.
 *
 * **Suppressed where the name IS the address**, exactly as `AccountMenu` suppresses it: an account
 * with no name derives the address as its display name, and stating one string on two lines reads
 * as a rendering fault rather than as two facts.
 *
 * Presentational and directive-free: it holds no state and no handler, so it is pulled into the
 * client bundle by `access-columns.tsx`'s boundary rather than declaring one of its own.
 */
export function PersonCell({ row }: { readonly row: AccessRow }) {
  const name = row.kind === ACCESS_ROW_KIND.MEMBER ? row.displayName : null;

  if (name === null || name === row.email) {
    return <span className={styles.personEmail}>{row.email}</span>;
  }

  return (
    <span className={styles.person}>
      <span className={styles.personName}>{name}</span>
      <span className={styles.personEmail}>{row.email}</span>
    </span>
  );
}
