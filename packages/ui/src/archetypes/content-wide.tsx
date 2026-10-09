import type { CSSProperties, ReactNode } from 'react';

/**
 * A block of a Content page wider than its prose (§4.6: *"64–70ch for prose, up to 100ch for wider blocks"*) — a table
 * of cookies, a list of sub-processors (task 74.2).
 *
 * **The measure is a custom property the shell's text reads** (`--content-measure`), set here on the block itself, so
 * the wider measure holds whatever order the two stylesheets load in — a class competing with the shell's rule on equal
 * specificity would win or lose by the bundle's order.
 */
const WIDE_MEASURE = { '--content-measure': '100ch' } as CSSProperties;

export function ContentWide({ children }: { readonly children: ReactNode }) {
  return <div style={WIDE_MEASURE}>{children}</div>;
}
