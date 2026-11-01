import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_STANDING } from '@/lib/session-standing';
import { probeSession } from '@/client/session/session-probe';
import { ProbedReturnLink } from './probed-return-link';

/**
 * The 404's way back, decided in the browser (task 74.4): the signed-out link in the first paint, so the server needs no
 * cookie, and the workspace's home once the probe says the session is held.
 */
vi.mock('@/client/session/session-probe', () => ({ probeSession: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const probe = vi.mocked(probeSession);

const draw = () => render(<ProbedReturnLink actionHome="Înapoi" actionSignIn="Autentificare" />);

describe('ProbedReturnLink', () => {
  it('first offers sign-in, which needs nothing read, then the home once a session is held', async () => {
    probe.mockResolvedValue(SESSION_STANDING.HELD);
    draw();

    expect(screen.getByRole('link', { name: 'Autentificare' })).toHaveAttribute('href', '/sign-in');
    expect(await screen.findByRole('link', { name: 'Înapoi' })).toHaveAttribute('href', '/home');
    expect(screen.queryByRole('link', { name: 'Autentificare' })).toBeNull();
  });

  it('keeps sign-in for a browser whose session has ended or never began', async () => {
    probe.mockResolvedValue(SESSION_STANDING.ENDED);
    draw();

    await vi.waitFor(() => expect(probe).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.getByRole('link', { name: 'Autentificare' })).toHaveAttribute('href', '/sign-in');
    expect(screen.queryByRole('link', { name: 'Înapoi' })).toBeNull();
  });
});
