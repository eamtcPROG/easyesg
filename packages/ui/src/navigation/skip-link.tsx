import { MAIN_CONTENT_ID } from './skip-link-vocabulary';
import styles from './skip-link.module.css';

/**
 * UX-99's skip link (task 203.3): the first thing on every page a keyboard reaches, taking the reader past the chrome
 * to `<main>`. Hidden until it has focus, then drawn over the page's top edge, so a mouse reader never meets it and a
 * keyboard reader cannot miss it.
 *
 * **No text of its own** (UX-79): each application says it in its own catalogue. **No directive**: it is a plain
 * anchor, so a Server Component layout renders it without a client boundary. The target `<main>` carries
 * `MAIN_CONTENT_ID` and `tabIndex={-1}`, which is what moves focus there rather than only scrolling to it.
 */
export function SkipLink({ label }: { readonly label: string }) {
  return (
    <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
      {label}
    </a>
  );
}
