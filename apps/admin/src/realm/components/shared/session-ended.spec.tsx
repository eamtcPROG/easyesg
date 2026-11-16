import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_SESSION_QUERY_KEY } from '../../queries/session';
import { SessionEnded } from './session-ended';

/**
 * A screen's read answered 401 (task 145). Under test is the one thing the browser journey could not fail on: the
 * router moves the location to A-01 **while this component is still mounted**, and an effect keyed on the address
 * ran again for each move, carrying `/sign-in?redirect=…` inside the next `?redirect=`, until React stopped it
 * (task 243 — `e2e/admin/session.spec.ts`'s lapsed read, which landed on A-01 all the same).
 */
const location = vi.hoisted(() => ({ href: '/organizations?q=x' }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useLocation: ({ select }: { select: (l: { href: string }) => string }) => select(location),
  useNavigate: () => navigate,
}));

describe('SessionEnded', () => {
  it('records the ending and sends the operator to A-01 once, carrying the address that was refused', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, { id: 'a' });
    const tree = () => (
      <QueryClientProvider client={queryClient}>
        <SessionEnded />
      </QueryClientProvider>
    );

    const { rerender } = render(tree());
    // The navigation lands while the screen is still drawn: the router's location is A-01's now.
    location.href = '/sign-in?redirect=%2Forganizations%3Fq%3Dx';
    rerender(tree());

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: '/sign-in', search: { redirect: '/organizations?q=x' } });
    expect(queryClient.getQueryData(ADMIN_SESSION_QUERY_KEY)).toBeNull();
  });
});
