import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { API_OUTCOME } from '@/lib/api-outcome';
import { inviteMemberAction } from '../../../actions/actions';
import { ACCESS_PAGE_SIZE, DEFAULT_ACCESS_VIEW, type AccessPage } from '../../../tools/access';
import { seatRegion } from '../../../tools/seats';
import { AccessNotice } from '../../board/regions/access-notice';
import { AccessProvider } from '../../shared/access-context';
import { InviteMember } from './invite-member';

/**
 * S-16's invitation dialogue: one arm per seat standing (task 142; UX-50, UX-52), and since 28 Sep 2026
 * the dialogue itself — open while the address says `?panel=invite`, a sent invitation closing it.
 *
 * The browser suite reaches the gate and the address through the product's own route; what only this
 * spec reaches is the **unknown** arm — an unreadable ceiling, which no journey can provoke without
 * breaking the configuration store under a running stack — and the refusal that must not outlive the
 * dialogue it was said in, which needs the address moved under a mounted screen.
 */
vi.mock('../../../actions/actions', () => ({
  inviteMemberAction: vi.fn(),
  changeMemberRoleAction: vi.fn(),
  removeMemberAction: vi.fn(),
  resendInvitationAction: vi.fn(),
  revokeInvitationAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/** The address the screen reads, moved by each case — `history.pushState` does not reach this mock. */
let address = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => address }));

/** jsdom implements neither, and Radix Select reaches for both. */
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const invite = vi.mocked(inviteMemberAction);
const OPEN = 'panel=invite';

beforeEach(() => {
  address = new URLSearchParams(OPEN);
  invite.mockReset();
  window.history.replaceState(null, '', `/organization/users?${OPEN}`);
});

afterEach(() => vi.restoreAllMocks());

const emptyPage: AccessPage = {
  rows: [],
  matched: 0,
  total: 0,
  page: 1,
  pageSize: ACCESS_PAGE_SIZE,
  administrators: 1,
};

const screenWith = (seats: { allowance: number | null; used: number }) => (
  <NextIntlClientProvider
    locale="ro"
    formats={formats}
    timeZone="Europe/Chisinau"
    messages={{ organization: ro.organization, identity: ro.identity, forms: ro.forms, chrome: ro.chrome }}
  >
    <AccessProvider page={emptyPage} view={DEFAULT_ACCESS_VIEW} seats={seatRegion(seats)} selfAccountId={null}>
      <AccessNotice />
      <InviteMember />
    </AccessProvider>
  </NextIntlClientProvider>
);

const OPEN_SEATS = { allowance: 10, used: 4 };
const words = ro.organization.access.invite;
const emailField = () => screen.queryByRole('textbox', { name: words.email });
const dialogue = () => screen.queryByRole('dialog', { name: words.heading });

const fillAndSend = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole('textbox', { name: words.email }), 'ion@example.md');
  await user.click(screen.getByRole('combobox', { name: words.role }));
  await user.click(screen.getByRole('option', { name: /Editare/ }));
  await user.click(screen.getByRole('button', { name: words.submit }));
};

const REFUSAL = {
  status: API_OUTCOME.Problem,
  problem: {
    type: 'https://easyesg.md/problems/invitation-outstanding',
    status: 409,
    title: 'Există deja o invitație în așteptare pentru această adresă',
    detail: 'Invitația trimisă anterior este încă valabilă.',
  },
} as const;

describe('InviteMember — the seat region’s arms (task 142)', () => {
  it('offers the form while seats remain', () => {
    render(screenWith(OPEN_SEATS));

    expect(emailField()).toBeInTheDocument();
    expect(screen.queryByText('Toate cele 10 locuri ale organizației sunt ocupate')).toBeNull();
  });

  /** UX-52 warns against the counter; it does not withhold the last seat. */
  it('still offers the form with one seat left', () => {
    render(screenWith({ allowance: 10, used: 9 }));

    expect(emailField()).toBeInTheDocument();
  });

  it('puts the gate where the form was once no seat remains, with no path to offer', () => {
    render(screenWith({ allowance: 10, used: 10 }));

    expect(emailField()).toBeNull();
    const gate = screen.getByRole('status');
    expect(gate).toHaveTextContent('Toate cele 10 locuri ale organizației sunt ocupate');
    expect(gate).toHaveTextContent('10 din 10');
    // Nothing to press but the dialogue's own close control: no submit, no upgrade path.
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      ro.chrome.dialog.close,
    ]);
    // Still the invitation's dialogue, so the reader who opened it knows what they are being told about.
    expect(dialogue()).toBeInTheDocument();
  });

  /** Fail closed, drawn: the API refuses invitations while the ceiling is unreadable, so none is offered. */
  it('says invitations are paused, rather than offering a form, when the ceiling cannot be read', () => {
    render(screenWith({ allowance: null, used: 4 }));

    expect(emailField()).toBeNull();
    expect(screen.getByText('Invitațiile sunt oprite deocamdată')).toBeInTheDocument();
  });
});

describe('InviteMember — the dialogue (28 Sep 2026)', () => {
  it('is closed while the address names no dialogue', () => {
    address = new URLSearchParams();
    render(screenWith(OPEN_SEATS));

    expect(dialogue()).toBeNull();
  });

  /** The reader's way out without sending, and it is the address that closes it. */
  it('closes by taking the dialogue out of the address, keeping the rest of it', async () => {
    const user = userEvent.setup();
    const push = vi.spyOn(window.history, 'pushState');
    window.history.replaceState(null, '', `/organization/users?role=editor&${OPEN}`);
    render(screenWith(OPEN_SEATS));

    await user.click(screen.getByRole('button', { name: words.cancel }));

    expect(push).toHaveBeenCalledWith(null, '', '/organization/users?role=editor');
  });

  /** A sent invitation is the list's news: the dialogue closes and the notice stands above the list. */
  it('closes on a sent invitation and reports it at the list’s head', async () => {
    const user = userEvent.setup();
    const push = vi.spyOn(window.history, 'pushState');
    invite.mockResolvedValue({ status: API_OUTCOME.Ok, value: null, messages: [] });
    const { rerender } = render(screenWith(OPEN_SEATS));

    await fillAndSend(user);

    expect(invite).toHaveBeenCalledWith({ email: 'ion@example.md', role: 'editor' });
    expect(push).toHaveBeenCalledWith(null, '', '/organization/users');
    // The router would move the address; the mock is moved by hand, as the push asked.
    address = new URLSearchParams();
    rerender(screenWith(OPEN_SEATS));

    expect(dialogue()).toBeNull();
    expect(screen.getByText('Invitația a fost trimisă la ion@example.md.')).toBeInTheDocument();
    expect(screen.getByText(words.sentAction)).toBeInTheDocument();
  });

  it('keeps a refusal in the dialogue, above the form it refused', async () => {
    const user = userEvent.setup();
    invite.mockResolvedValue(REFUSAL);
    render(screenWith(OPEN_SEATS));

    await fillAndSend(user);

    expect(await screen.findByText(REFUSAL.problem.title)).toBeInTheDocument();
    expect(dialogue()).toContainElement(screen.getByText(REFUSAL.problem.title));
    expect(screen.getByText(words.failedAction)).toBeInTheDocument();
  });

  /**
   * The edge `AccessState.inviting` exists for: refused, closed by Back, reopened by Forward — no
   * button pressed on either move. The refusal is about a form that is now empty, so it must be gone,
   * and so must the last attempt's address in the field.
   */
  it('reopens clear of the refusal and the fields an earlier attempt left', async () => {
    const user = userEvent.setup();
    invite.mockResolvedValue(REFUSAL);
    const { rerender } = render(screenWith(OPEN_SEATS));
    await fillAndSend(user);
    expect(await screen.findByText(REFUSAL.problem.title)).toBeInTheDocument();

    address = new URLSearchParams();
    rerender(screenWith(OPEN_SEATS));
    address = new URLSearchParams(OPEN);
    rerender(screenWith(OPEN_SEATS));

    expect(dialogue()).toBeInTheDocument();
    expect(screen.queryByText(REFUSAL.problem.title)).toBeNull();
    expect(emailField()).toHaveValue('');
  });
});
