import { TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { MEMBERSHIPS_MESSAGES } from '../shared/memberships-messages';
import styles from '../../styles/home.module.css';

/**
 * Where the acting happens, since this region deliberately does not (UC-16, OQ-6).
 *
 * **It is the answer to the question the list provokes.** A reader shown three organizations and no
 * way to choose between them has been told half of something; this sentence is the other half, and
 * it points at S-15 rather than inventing a switcher, because switching is task 83's and belongs to
 * the global tier by OQ-6.
 *
 * **Outside the arm, which is why it is the section's child and not the list's.** It renders when
 * the read succeeds *and* when it fails: a reader whose list did not load still needs the pointer,
 * and arguably needs it more. That placement is the whole reason it is a file rather than three
 * lines inside `memberships-list.tsx`.
 *
 * **`t.rich` rather than a sentence with a link glued on.** The link's position inside the sentence
 * is a translation decision — Romanian, English and Russian put it in different places — so the
 * catalogue owns the `<organization>` tag and this file owns only what it renders to. A `t('…')`
 * plus a separate `<TextLink>` would have fixed the word order in code, which is the hardcoded
 * pattern NFR-26 refuses for dates and the same mistake in prose.
 */
export async function MembershipsSwitchNote() {
  const t = await getTranslations(MEMBERSHIPS_MESSAGES);

  return (
    <p className={`t-caption ${styles.sub}`}>
      {t.rich('switchNote', {
        organization: (chunks) => (
          <TextLink asChild>
            <Link href={ROUTES.ORGANIZATION}>{chunks}</Link>
          </TextLink>
        ),
      })}
    </p>
  );
}
