import type { ReactNode } from 'react';

/**
 * Identity — S-01, S-02, S-03 (IMPLEMENTATION_PLAN Phase 2).
 *
 * Every screen here is the **Focus** archetype: one task, one panel, no navigation, single
 * centred column, one primary action. That is why this layout exists as a sibling of `(app)`
 * rather than inside it — there is no session yet, so there is no global tier to render.
 *
 * These are the simplest surfaces in the product, which makes them the right place to prove the
 * foundation holds before the wizard depends on it.
 */
export default function IdentityLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
