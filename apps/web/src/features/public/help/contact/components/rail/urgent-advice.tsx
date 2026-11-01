import { getTranslations } from 'next-intl/server';
import pageStyles from '../../../shared/help-page.module.css';
import { CONTACT_MESSAGES } from '../shared/contact-messages';

/**
 * *Urgent and about a deadline?* (task 227; artboard 04) — advice at the right-hand column's foot: say so first, with
 * the date. The column's reply time and earlier requests are tasks 228 and 239's (`architecture.md` §12.5.6's task-227
 * row (5), (16)).
 */
export async function UrgentAdvice() {
  const t = await getTranslations(CONTACT_MESSAGES);

  return (
    <section aria-labelledby="contact-urgent" className={`${pageStyles.card} ${pageStyles.quiet}`}>
      <div className={pageStyles.cardOnly}>
        <h2 id="contact-urgent" className="t-label">
          {t('urgent.title')}
        </h2>
        <p className={`t-caption ${pageStyles.body}`}>{t('urgent.body')}</p>
      </div>
    </section>
  );
}
