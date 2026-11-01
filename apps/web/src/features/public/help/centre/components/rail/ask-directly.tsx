import { TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import pageStyles from '../../../shared/help-page.module.css';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from './rail.module.css';

/**
 * *Ask us directly* (task 227; artboard 02) — a visitor's way to a person without an account: support's mailbox, read
 * from the support channel with no session (`architecture.md` §12.5.6's task-227 row (4)), and the languages a person
 * answers in. Where the channel cannot be read the address is left out, never guessed; S-34's form still reaches it.
 */
export async function AskDirectly({ address }: { readonly address: string | null }) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);

  return (
    <section aria-labelledby="help-direct" className={pageStyles.card}>
      <div className={pageStyles.cardOnly}>
        <h2 id="help-direct" className={pageStyles.eyebrow}>
          {t('direct.eyebrow')}
        </h2>
        <p className={`t-caption ${pageStyles.body}`}>{t('direct.body')}</p>
        {address === null ? null : (
          <p className={styles.address}>
            <TextLink href={`mailto:${address}`}>{address}</TextLink>
          </p>
        )}
        <p className={`t-caption ${pageStyles.muted}`}>{t('direct.languages')}</p>
      </div>
    </section>
  );
}
