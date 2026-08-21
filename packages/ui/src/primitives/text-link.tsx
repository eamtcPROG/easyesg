import { Slot } from 'radix-ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './text-link.module.css';

/**
 * Link — §11.5 primitive. Inline text link on the accent, underlined at rest: colour is never
 * the sole carrier (UX-102), and the global focus ring applies.
 *
 * `asChild` (Radix Slot) is the seam that keeps this package presentational: `apps/web` must
 * navigate through `@/i18n/navigation`'s locale-aware `Link` — a raw `next/link` drops the
 * locale prefix — and this component cannot import either. The app passes its own anchor and
 * the primitive contributes styling only.
 */
export interface TextLinkProps extends ComponentPropsWithRef<'a'> {
  asChild?: boolean;
  children: ReactNode;
}

export function TextLink({ asChild = false, className, children, ...rest }: TextLinkProps) {
  const Component = asChild ? Slot.Root : 'a';
  return (
    <Component {...rest} className={[styles.link, className].filter(Boolean).join(' ')}>
      {children}
    </Component>
  );
}
