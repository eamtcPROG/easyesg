import type { HelpArticleSection } from '@easyesg/contracts';
import { ArticleBody } from './article-body';
import styles from './body.module.css';

/**
 * One of S-33's sections (tasks 77, 227; artboard 03) — its heading over its body, or, disclosed (UX-17), a row naming
 * it with *Show* at its end that the reader opens: a native `<details>`, so it opens with no script, its heading inside
 * the `<summary>`, which the content model admits, so *On this page* still lands on a heading. **Handed its *Show* by
 * the card**, which reads the screen's words once for every section.
 */
export function ArticleSection({
  id,
  section,
  lang,
  show,
}: {
  readonly id: string;
  readonly section: HelpArticleSection;
  /** The article's language where it differs from the page's. */
  readonly lang: string | undefined;
  /** The word on a disclosed section's row. */
  readonly show: string;
}) {
  if (!section.disclosed) {
    return (
      <section id={id} aria-labelledby={`${id}-heading`} className={styles.section} lang={lang}>
        <h2 id={`${id}-heading`} className={`t-heading-2 ${styles.sectionHeading}`}>
          {section.heading}
        </h2>
        <ArticleBody body={section.body} />
      </section>
    );
  }

  return (
    <details id={id} className={styles.disclosure}>
      <summary>
        <h2 className={styles.disclosureHeading} lang={lang}>
          {section.heading}
        </h2>
        <span className={styles.show} aria-hidden="true">
          {show}
        </span>
      </summary>
      <div className={styles.disclosureBody} lang={lang}>
        <ArticleBody body={section.body} />
      </div>
    </details>
  );
}
