import type { ReactNode } from 'react';
import styles from './unit-label.module.css';

/**
 * A unit fixed by the taxonomy, or by the filing for a currency — UX-14's *shown, never asked* — as §11.5's
 * Number-with-unit draws it beside the value (task 221): a box the value's height, in the value's type and with its
 * edge, on the unit surface. The project owner's look, where the Components sheet draws a lighter edge and smaller type
 * (`design_spec.md` §11.5). The caller passes the unit's symbol or code, never the taxonomy's identifier.
 */
export function UnitLabel({ children }: { readonly children: ReactNode }) {
  return <span className={styles.unit}>{children}</span>;
}
