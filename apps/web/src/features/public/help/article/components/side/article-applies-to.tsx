import { getTranslations } from 'next-intl/server';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';
import styles from './side.module.css';

/**
 * S-33's *Applies to* (task 227; artboard 03) — the part of the report the article is about, beneath the contents. The
 * module as the article names it; its fields and the taxonomy version it was written for are task 229's (`architecture.md`
 * §12.5.6's task-227 row (6)).
 */
export async function ArticleAppliesTo({ module, lang }: { readonly module: string; readonly lang: string | undefined }) {
  const t = await getTranslations(HELP_ARTICLE_MESSAGES);

  return (
    <section aria-labelledby="article-applies" className={styles.applies}>
      <h2 id="article-applies" className={styles.eyebrow}>
        {t('appliesTo')}
      </h2>
      <p className={`t-caption ${styles.module}`} lang={lang}>
        {module}
      </p>
    </section>
  );
}
