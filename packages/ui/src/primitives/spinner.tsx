import styles from './spinner.module.css';

/**
 * Spinner — reserved for indeterminate waits with no known shape (UX-115; skeletons cover
 * everything whose final layout is known). Decorative on its own: the *container* names the
 * wait (a busy button carries `aria-busy`, a pending panel carries its own text), so the
 * glyph itself stays `aria-hidden` and never the sole carrier of meaning (UX-102).
 *
 * `prefers-reduced-motion` collapses the rotation via the global reduction in tokens.css.
 */
export function Spinner() {
  return <span aria-hidden="true" className={styles.spinner} />;
}
