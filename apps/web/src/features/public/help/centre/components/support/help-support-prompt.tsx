import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from '../shared/help-centre.module.css';

/** S-32's way to a person (UC-180 step 2, UC-182) — at the foot of the library, whatever the library held. */
export async function HelpSupportPrompt() {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);
  return (
    <section aria-labelledby="help-support" className={styles.support}>
      <h2 id="help-support" className="t-heading-3">
        {t('support.title')}
      </h2>
      <p className="t-body">{t('support.body')}</p>
      <div>
        <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
          <Link href={ROUTES.HELP_CONTACT}>{t('support.action')}</Link>
        </Button>
      </div>
    </section>
  );
}
