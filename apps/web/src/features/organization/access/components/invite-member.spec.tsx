import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { ACCESS_PAGE_SIZE, DEFAULT_ACCESS_VIEW, type AccessPage } from '../tools/access';
import { seatRegion } from '../tools/seats';
import { AccessProvider } from './access-context';
import { InviteMember } from './invite-member';

/**
 * S-16's invite panel, one arm per seat standing (task 142; UX-50, UX-52).
 *
 * The browser suite reaches the gate through the product's own route; what only this spec reaches is
 * the **unknown** arm — an unreadable ceiling, which no journey can provoke without breaking the
 * configuration store under a running stack — and the claim that approaching still offers the form.
 */
vi.mock('../actions/actions', () => ({
  inviteMemberAction: vi.fn(),
  changeMemberRoleAction: vi.fn(),
  removeMemberAction: vi.fn(),
  resendInvitationAction: vi.fn(),
  revokeInvitationAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/** jsdom implements neither, and Radix Select reaches for both. */
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const emptyPage: AccessPage = {
  rows: [],
  matched: 0,
  total: 0,
  page: 1,
  pageSize: ACCESS_PAGE_SIZE,
  administrators: 1,
};

const panelWith = (seats: { allowance: number | null; used: number }) => (
  <NextIntlClientProvider
    locale="ro"
    formats={formats}
    timeZone="Europe/Chisinau"
    messages={{ organization: ro.organization, identity: ro.identity, forms: ro.forms }}
  >
    <AccessProvider
      page={emptyPage}
      view={DEFAULT_ACCESS_VIEW}
      seats={seatRegion(seats)}
      inviteAnchorId="invite"
    >
      <InviteMember id="invite" />
    </AccessProvider>
  </NextIntlClientProvider>
);

const emailField = () => screen.queryByRole('textbox', { name: 'Adresa de e-mail' });

describe('InviteMember — the seat region’s arms (task 142)', () => {
  it('offers the form while seats remain', () => {
    render(panelWith({ allowance: 10, used: 4 }));

    expect(emailField()).toBeInTheDocument();
    expect(screen.queryByText('Toate cele 10 locuri ale organizației sunt ocupate')).toBeNull();
  });

  /** UX-52 warns against the counter; it does not withhold the last seat. */
  it('still offers the form with one seat left', () => {
    render(panelWith({ allowance: 10, used: 9 }));

    expect(emailField()).toBeInTheDocument();
  });

  it('puts the gate where the form was once no seat remains, with no path to offer', () => {
    render(panelWith({ allowance: 10, used: 10 }));

    expect(emailField()).toBeNull();
    const gate = screen.getByRole('status');
    expect(gate).toHaveTextContent('Toate cele 10 locuri ale organizației sunt ocupate');
    expect(gate).toHaveTextContent('10 din 10');
    expect(screen.queryByRole('button')).toBeNull();
    // The heading stays in every arm: the first-use empty state links to it.
    expect(screen.getByRole('heading', { name: 'Invitați un coleg' })).toHaveAttribute('id', 'invite');
  });

  /** Fail closed, drawn: the API refuses invitations while the ceiling is unreadable, so none is offered. */
  it('says invitations are paused, rather than offering a form, when the ceiling cannot be read', () => {
    render(panelWith({ allowance: null, used: 4 }));

    expect(emailField()).toBeNull();
    expect(screen.getByText('Invitațiile sunt oprite deocamdată')).toBeInTheDocument();
  });
});
