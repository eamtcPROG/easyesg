import { getTranslations } from 'next-intl/server';
import { MEMBERSHIPS_MESSAGES } from '../shared/memberships-messages';
import styles from '../../styles/home.module.css';

/**
 * Where the acting happens, since this region deliberately does not (UC-16, OQ-6).
 *
 * **It is the answer to the question the list provokes.** A reader shown three organizations and no
 * way to choose between them has been told half of something; this sentence is the other half. It
 * names the global tier's switcher by its label — which OQ-6 gives the switching to wherever an organization
 * is chosen, as it is on this screen — and until task 83.2 pointed at S-15, because there was nowhere to switch.
 *
 * **Outside the arm, which is why it is the section's child and not the list's.** It renders when
 * the read succeeds *and* when it fails: a reader whose list did not load still needs the pointer,
 * and arguably needs it more. That placement is the whole reason it is a file rather than three
 * lines inside `memberships-list.tsx`.
 *
 * **No link, and the loss is deliberate.** The switcher is a control, not an address, so there is nothing to
 * link to; the sentence names it and says where it is — the band, or the drawer at compact width.
 */
export async function MembershipsSwitchNote() {
  const t = await getTranslations(MEMBERSHIPS_MESSAGES);

  return <p className={`t-caption ${styles.sub}`}>{t('switchNote')}</p>;
}
