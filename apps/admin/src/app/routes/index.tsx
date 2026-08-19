import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * Entry redirect. The console has no landing page of its own — an operator arriving at the root
 * wants work, and the organization register (A-02) is the one screen every Platform Administrator
 * reaches for first.
 *
 * This is the only route in the tree that does anything, and it is structural rather than
 * behavioural: without it the root address resolves to nothing. When the realm guard lands in
 * Phase 2 it will intercept ahead of this, sending an unauthenticated operator to A-01.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/organizations' });
  },
});
