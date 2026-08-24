import type { ComponentPropsWithRef, ReactNode } from 'react';
import buttonStyles from './button.module.css';
import styles from './provider-button.module.css';

/**
 * ProviderButton — S-01's identity-provider choice (FR-2, D-6), added to the §11.5 inventory
 * under UX-89 rather than inlined in a screen: the sign-in and register surfaces both render
 * one per enabled provider, and task 27's linking surface (S-28) is its third consumer.
 *
 * **An anchor, not a `<button>`, by anatomy**: choosing a provider is a full-page navigation —
 * the OAuth redirect — and must work with no JavaScript (UX-108, Accessible Authentication).
 * That anatomy difference is why this is not a fifth Button variant: §11.5's "four variants and
 * there is no fifth" governs `<button>`, and this component *borrows* the secondary variant's
 * clothes so a re-skin edits one place.
 *
 * States (§8.1, the applicable subset): rest · hover · active · focus — the global two-layer
 * focus ring applies via `:focus-visible`. There is no disabled state by design: FR-82 removes
 * a withdrawn provider from the set entirely, and a control that cannot be activated is not
 * rendered rather than rendered grey (S-01 shows "the set of currently enabled providers").
 *
 * Presentational by the package rule: the label and the glyph arrive as props, the `href` is an
 * ordinary anchor target. The glyph is decorative next to its label (`aria-hidden`), so the
 * accessible name is exactly the visible label (WCAG 2.5.3).
 */
export interface ProviderButtonProps extends Omit<ComponentPropsWithRef<'a'>, 'children'> {
  href: string;
  /** The provider's mark, sized by the component. Decorative — the label carries the name. */
  glyph: ReactNode;
  /** The visible, accessible label — e.g. a localized "Continue with Google". */
  children: ReactNode;
}

export function ProviderButton({ href, glyph, className, children, ...rest }: ProviderButtonProps) {
  return (
    <a
      {...rest}
      href={href}
      className={[buttonStyles.button, buttonStyles.secondary, styles.provider, className]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true" className={styles.glyph}>
        {glyph}
      </span>
      {children}
    </a>
  );
}
