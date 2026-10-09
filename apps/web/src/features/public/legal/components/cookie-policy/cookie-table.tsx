import { getTranslations } from 'next-intl/server';
import {
  COOKIE_INVENTORY,
  COOKIE_LIFETIME,
  type CookieLifetime,
} from '../../tools/cookie-inventory';
import styles from '../styles/legal.module.css';
import { TableScroll } from './table-scroll';

/** The caption's id, which names the card while it scrolls. The table is drawn once on its page. */
const CAPTION_ID = 'cookie-table-caption';

/**
 * Every cookie the platform sets, by purpose, how long it lasts and where (FR-206 AC-1) — read from task 75.2's
 * inventory and nothing else, so the table is true of the build by the inventory's own gate.
 *
 * **A table that keeps its four columns at every width**, as a table does at `compact` (UX-77): at a phone's frame they
 * fit with every word whole, a cookie's name breaking anywhere; below that, where one word outgrows its column, the
 * card scrolls sideways inside itself and becomes a region a keyboard can reach (`TableScroll`). A table read as a
 * table is the point of the disclosure.
 */
export async function CookieTable() {
  const t = await getTranslations('legal.cookies');

  const lifetime = (value: CookieLifetime): string => {
    switch (value.kind) {
      case COOKIE_LIFETIME.WHILE_SIGNED_IN:
        return t('lifetime.whileSignedIn');
      case COOKIE_LIFETIME.MINUTES:
        return t('lifetime.minutes', { minutes: value.minutes });
      case COOKIE_LIFETIME.SESSION_THEN_YEAR:
        return t('lifetime.sessionThenYear', { years: value.years });
      case COOKIE_LIFETIME.UNTIL_STEP_ENDS:
        return t('lifetime.untilStepEnds');
    }
  };

  return (
    <TableScroll className={styles.tableFrame} labelledBy={CAPTION_ID}>
      <table className={styles.table}>
        <caption id={CAPTION_ID} className={styles.caption}>
          {t('sections.set.caption')}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t('columns.name')}</th>
            <th scope="col">{t('columns.purpose')}</th>
            <th scope="col">{t('columns.lifetime')}</th>
            <th scope="col">{t('columns.where')}</th>
          </tr>
        </thead>
        <tbody>
          {COOKIE_INVENTORY.map((cookie) => (
            <tr key={cookie.name}>
              <th scope="row">
                <code className="t-code">{cookie.name}</code>
              </th>
              <td>{t(`purpose.${cookie.purpose}`)}</td>
              <td>{lifetime(cookie.lifetime)}</td>
              <td>{t(`surface.${cookie.surface}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
