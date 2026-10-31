import { Button } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import pageStyles from '../../../shared/help-page.module.css';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';

/**
 * *Ask a person* (task 227; artboard 01) — the right-hand column's lead for a signed-in reader: who answers and in what
 * languages, and *Write to support* (S-34). The artboard's plan and office hours are task 228's and 240's, and its
 * *Grant temporary access* task 238's (the task-227 row (5), (15)); none is drawn before its data exists.
 */
export async function AskAPerson() {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);

  return (
    <section aria-labelledby="help-ask" className={`${pageStyles.card} ${pageStyles.lead}`}>
      <div className={pageStyles.cardHead}>
        <h2 id="help-ask" className="t-heading-3">
          {t('ask.title')}
        </h2>
        <p className={`t-caption ${pageStyles.body}`}>{t('ask.body')}</p>
      </div>
      <div className={pageStyles.cardBody}>
        <Button asChild>
          <Link href={ROUTES.HELP_CONTACT}>{t('ask.action')}</Link>
        </Button>
      </div>
    </section>
  );
}
