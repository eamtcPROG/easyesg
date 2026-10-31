import { BLOCK, markdownBlocks } from '../../tools/article-markdown';
import styles from './body.module.css';
import { ArticleInlines } from './article-inlines';

/** A section's body as its blocks — paragraphs and lists — each run of text drawn by `ArticleInlines` (task 77). */
export function ArticleBody({ body }: { readonly body: string }) {
  return (
    <div className={styles.body}>
      {markdownBlocks(body).map((block, index) =>
        block.kind === BLOCK.LIST ? (
          <ul key={index} className={styles.list}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <ArticleInlines inlines={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            <ArticleInlines inlines={block.inlines} />
          </p>
        ),
      )}
    </div>
  );
}
