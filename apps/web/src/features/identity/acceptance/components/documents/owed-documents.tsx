import type { OwedLegalDocument } from '@easyesg/contracts';
import { LEGAL_DOCUMENT, LEGAL_STANDING, type AcceptedLegalDocument } from '@easyesg/i18n';
import { TextLink } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { calendarDay } from '@/lib/legal-date';
import { ROUTES } from '@/lib/routes';
import styles from '../../../shared/styles/identity-screens.module.css';
import { ACCEPTANCE_MESSAGES } from '../shared/acceptance-messages';

/** The words that say a document's link opens a new tab — one per document, since Romanian and Russian agree in number. */
const NEW_TAB = {
  [LEGAL_DOCUMENT.TERMS]: 'newTab.terms',
  [LEGAL_DOCUMENT.PRIVACY]: 'newTab.privacy',
} as const satisfies Record<AcceptedLegalDocument, string>;

/** Where each document is read — S-30's addresses, which the footer links. */
const HREF: Readonly<Record<AcceptedLegalDocument, string>> = {
  [LEGAL_DOCUMENT.TERMS]: ROUTES.LEGAL_TERMS,
  [LEGAL_DOCUMENT.PRIVACY]: ROUTES.LEGAL_PRIVACY,
};

/**
 * S-43's documents owed (task 195; `design_spec.md` S-43's content): each a link to S-30, its version and the day it
 * applies from, and whether the account is accepting it for the first time or a newer version of one it had accepted.
 *
 * **Each link opens in a new tab and says so** (project owner, 23 Oct 2026, for the checkbox's links below it, and
 * here for their reason): the reader returns to the box as they left it.
 *
 * **The standing is the release's** (`@easyesg/i18n`), the same that S-30 states and that the form sends — what the page
 * displays is what is recorded. Which documents are owed, and what was accepted, are the api's. The standing's two
 * sentences are S-30's own (`legal.standing`), so a document reads the same on both screens.
 */
export async function OwedDocuments({ owed }: { readonly owed: readonly OwedLegalDocument[] }) {
  const [t, tDocuments, tStanding, format] = await Promise.all([
    getTranslations(ACCEPTANCE_MESSAGES),
    getTranslations('legal.documents'),
    getTranslations('legal.standing'),
    getFormatter(),
  ]);

  return (
    <ul className={styles.documents}>
      {owed.map(({ document, acceptedVersion }) => {
        const standing = LEGAL_STANDING[document];
        return (
          <li key={document}>
            <TextLink asChild>
              <Link href={HREF[document]} target="_blank" rel="noopener">
                {tDocuments(document)} {t(NEW_TAB[document])}
              </Link>
            </TextLink>
            <span className={styles.documentStanding}>
              <span>{tStanding('version', { version: standing.version })}</span>
              <span>{tStanding('effective', { date: format.dateTime(calendarDay(standing.effective), 'calendar') })}</span>
            </span>
            <span className={styles.documentFacts}>
              {acceptedVersion === null ? t('documentNew') : t('documentUpdated', { accepted: acceptedVersion })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
