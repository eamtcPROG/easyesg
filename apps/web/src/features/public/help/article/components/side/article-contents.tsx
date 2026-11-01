'use client';

import { ARIA_CURRENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { SHORT_ANSWER_ID } from '../shared/article-anchors';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';
import styles from './side.module.css';

/** One of the article's sections, by its anchor and its heading's words. */
export interface ArticleContentsEntry {
  readonly id: string;
  readonly label: string;
}

/**
 * S-33's *On this page* (tasks 77, 227; artboard 03) — the short answer, then each section, the one in view marked as
 * the artboard marks it. **A Client Component for the observer alone**: the list is links that work with no script,
 * and the mark is what a scroll observer adds — `ContentContents` declines that for the Content archetype, whose pages
 * must stay cacheable; the help is rendered per request, so the artboard's mark costs it nothing it was keeping.
 *
 * A section counts as in view while any of it is in the window's upper part, and the first of those in the article's
 * order is the one marked; between two, the last marked stays.
 */
export function ArticleContents({
  sections,
  lang,
}: {
  readonly sections: readonly ArticleContentsEntry[];
  /** The article's language where it differs from the page's — its headings are its words. */
  readonly lang: string | undefined;
}) {
  const t = useTranslations(HELP_ARTICLE_MESSAGES);
  const [current, setCurrent] = useState(SHORT_ANSWER_ID);

  useEffect(() => {
    const order = [SHORT_ANSWER_ID, ...sections.map((section) => section.id)];
    const inView = new Set<string>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting) inView.add(record.target.id);
          else inView.delete(record.target.id);
        }
        const first = order.find((id) => inView.has(id));
        if (first !== undefined) setCurrent(first);
      },
      { rootMargin: '0px 0px -60% 0px' },
    );
    for (const id of order) {
      const target = document.getElementById(id);
      if (target !== null) observer.observe(target);
    }
    return () => observer.disconnect();
  }, [sections]);

  const entries = [{ id: SHORT_ANSWER_ID, label: t('shortAnswer'), own: true }, ...sections.map((section) => ({ ...section, own: false }))];

  return (
    <nav aria-label={t('contents')} className={styles.contents}>
      <p className={styles.eyebrow} aria-hidden="true">
        {t('contents')}
      </p>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={styles.entry}
              aria-current={entry.id === current ? ARIA_CURRENT.LOCATION : undefined}
              lang={entry.own ? undefined : lang}
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
