import type { ReactNode } from 'react';
import styles from './panel.module.css';

/**
 * Panel — the bordered white surface the semantic tokens call "card, field, panel"
 * (`--surface-default`), as the identity prototypes draw it: border-default, radius-2, flat.
 * Elevation stays 0 on purpose — a card does not float (UX-86); elevation means transience.
 */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={[styles.panel, className].filter(Boolean).join(' ')}>{children}</section>
  );
}
