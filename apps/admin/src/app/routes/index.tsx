import { createFileRoute, redirect } from '@tanstack/react-router';
import { adminSessionQuery } from '~/realm/queries/session';
import { consoleHomeFor } from '~/realm/tools/console-home';

/**
 * Entry redirect. The console has no landing page of its own — an operator arriving at the root
 * wants work, and where their work starts depends on who they are: A-02 for a Platform
 * Administrator, A-10 for a Billing Operator (A-01's exit, `design_spec.md` §5.2; task 67.1).
 *
 * **So the root resolves the session before it can answer**, which it did not need to while every
 * arrival went to A-02. It reads the same probe `_realm`'s guard does, from the same query client,
 * so the guard below the redirect finds it already settled rather than asking twice.
 *
 * **Signed out, it goes to A-01 with no `?redirect=`.** A carried destination would be a guess at
 * the privilege level the credentials have not proven yet; without one, A-01 lands the operator on
 * their own home once it knows who they are.
 *
 * Structural rather than behavioural: without it the root address resolves to nothing. It stays one
 * of the two routes outside `_realm`, and it renders nothing whichever way it answers.
 */
export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const account = await context.queryClient.ensureQueryData(adminSessionQuery);
    if (account === null) {
      throw redirect({ to: '/sign-in' });
    }
    throw redirect({ to: consoleHomeFor(account.role) });
  },
});
