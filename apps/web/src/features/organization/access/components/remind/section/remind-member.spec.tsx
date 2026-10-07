import { DEFAULT_PAGE_SIZE } from '@easyesg/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { API_OUTCOME } from '@/lib/api-outcome';
import { sendReminderAction } from '../../../actions/actions';
import { DEFAULT_ACCESS_VIEW, type AccessPage } from '../../../tools/access';
import { REMINDER_ARM, type ReminderRegion } from '../../../tools/reminder';
import { seatRegion } from '../../../tools/seats';
import { AccessNotice } from '../../board/regions/access-notice';
import { AccessProvider } from '../../shared/access-context';
import { RemindMember } from './remind-member';

/**
 * S-16's reminder (task 50.3), a dialogue since 28 Sep 2026: one arm per region, and the form's send — what it hands
 * the action, where it says so after, and the note's bound met before anything is sent — and the person a row's
 * action opens it with. The browser suite drives it against the api; what only this reaches is the unavailable arm,
 * which no journey can provoke without breaking a read under a running stack, and a row naming someone the form does
 * not offer.
 */
vi.mock('../../../actions/actions', () => ({
  sendReminderAction: vi.fn(),
  inviteMemberAction: vi.fn(),
  changeMemberRoleAction: vi.fn(),
  removeMemberAction: vi.fn(),
  resendInvitationAction: vi.fn(),
  revokeInvitationAction: vi.fn(),
}));

const refresh = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

/** The address the screen reads — the reminder open, unless a case moves it. `pushState` does not reach this mock. */
let address = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => address }));

/** jsdom implements neither, and Radix Select reaches for both. */
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.mocked(sendReminderAction).mockReset();
  address = new URLSearchParams(OPEN);
  window.history.replaceState(null, '', `/organization/users?${OPEN}`);
});

const OPEN = 'panel=remind';

const emptyPage: AccessPage = { rows: [], matched: 0, total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, administrators: 1 };

const READY: ReminderRegion = {
  arm: REMINDER_ARM.READY,
  people: [{ membershipId: 'membership-ivan', displayName: 'Ivan Rusu', email: 'ivan@example.md' }],
  reports: [{ id: 'report-2026', entityName: 'Brutăria Lina', fiscalYear: 2026 }],
};

const screenWith = (reminder: ReminderRegion) => (
  <NextIntlClientProvider
    locale="ro"
    formats={formats}
    timeZone="Europe/Chisinau"
    messages={{ organization: ro.organization, identity: ro.identity, forms: ro.forms, chrome: ro.chrome }}
  >
    <AccessProvider
      page={emptyPage}
      view={DEFAULT_ACCESS_VIEW}
      seats={seatRegion({ allowance: 10, used: 2 })}
      selfAccountId="account-ana"
    >
      <AccessNotice />
      <RemindMember region={reminder} />
    </AccessProvider>
  </NextIntlClientProvider>
);

const panelWith = (reminder: ReminderRegion) => render(screenWith(reminder));
const dialogue = () => screen.queryByRole('dialog', { name: words.heading });

const words = ro.organization.access.remind;
// The note is sent as written; the api trims it and reads an empty one as none.

/** Picks the person and the report, as a reader would, through the two selects. */
const choose = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: words.person }));
  await userEvent.click(screen.getByRole('option', { name: /Ivan Rusu/ }));
  await userEvent.click(screen.getByRole('combobox', { name: words.report }));
  await userEvent.click(screen.getByRole('option', { name: 'Brutăria Lina · 2026' }));
};

describe('RemindMember — its arms', () => {
  it('offers the form where there is someone to remind and a report to remind about', () => {
    panelWith(READY);

    expect(dialogue()).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: words.person })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: words.report })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: words.note })).toBeInTheDocument();
  });

  it('says there is nothing to remind about while no report is open, and leads to the reports', () => {
    panelWith({ arm: REMINDER_ARM.NO_REPORT });

    expect(screen.getByText(words.noReport.body, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: words.noReport.action })).toHaveAttribute('href', '/reports');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('says there is no one to remind, and opens the invitation', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    window.history.replaceState(null, '', '/organization/users');
    panelWith({ arm: REMINDER_ARM.NO_ONE });

    expect(screen.getByText(words.noOne.body, { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: words.noOne.action }));

    expect(push).toHaveBeenCalledWith(null, '', '/organization/users?panel=invite');
    push.mockRestore();
  });

  it('says what it could not read, offers no form over a guess, and asks again when told to', async () => {
    panelWith({ arm: REMINDER_ARM.UNAVAILABLE });

    expect(screen.getByText(words.unavailable.title)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: words.unavailable.retry }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('RemindMember — the dialogue (28 Sep 2026)', () => {
  it('is closed while the address names another dialogue or none', () => {
    address = new URLSearchParams('panel=invite');
    panelWith(READY);

    expect(dialogue()).toBeNull();
  });

  /** Opened from Ivan's row: the address carries his membership, and the form starts with him chosen. */
  it('opens with the person a row’s action named', () => {
    address = new URLSearchParams(`${OPEN}&person=membership-ivan`);
    panelWith(READY);

    expect(screen.getByRole('combobox', { name: words.person })).toHaveTextContent('Ivan Rusu');
  });

  /** A row drawn before they stopped being a member, or a hand-edited address: the reader chooses. */
  it('chooses nobody the form does not offer', () => {
    address = new URLSearchParams(`${OPEN}&person=membership-gone`);
    panelWith(READY);

    expect(screen.getByRole('combobox', { name: words.person })).toHaveTextContent(words.personPlaceholder);
  });

  it('says when no report is open, from a row’s action too', () => {
    address = new URLSearchParams(`${OPEN}&person=membership-ivan`);
    panelWith({ arm: REMINDER_ARM.NO_REPORT });

    expect(dialogue()).toHaveTextContent(words.noReport.body);
  });
});

describe('RemindMember — sending', () => {
  /** A sent reminder is the list's news: the dialogue closes and the notice stands above the list. */
  it('sends the person, the report and the note, closes, and says to whom it went', async () => {
    vi.mocked(sendReminderAction).mockResolvedValue({ status: API_OUTCOME.Ok, value: null, messages: [] });
    const push = vi.spyOn(window.history, 'pushState');
    const { rerender } = panelWith(READY);

    await choose();
    await userEvent.type(screen.getByRole('textbox', { name: words.note }), 'Lipsesc datele despre energie.');
    await userEvent.click(screen.getByRole('button', { name: words.submit }));

    expect(sendReminderAction).toHaveBeenCalledWith({
      reportId: 'report-2026',
      membershipId: 'membership-ivan',
      note: 'Lipsesc datele despre energie.',
    });
    expect(push).toHaveBeenCalledWith(null, '', '/organization/users');
    push.mockRestore();
    // The router would move the address; the mock is moved by hand, as the push asked.
    address = new URLSearchParams();
    rerender(screenWith(READY));

    expect(dialogue()).toBeNull();
    expect(screen.getByText('Mementoul a fost trimis către Ivan Rusu.')).toBeInTheDocument();
  });

  it('sends the note as written, empty where none was', async () => {
    vi.mocked(sendReminderAction).mockResolvedValue({ status: API_OUTCOME.Ok, value: null, messages: [] });
    panelWith(READY);

    await choose();
    await userEvent.click(screen.getByRole('button', { name: words.submit }));

    expect(sendReminderAction).toHaveBeenCalledWith({
      reportId: 'report-2026',
      membershipId: 'membership-ivan',
      note: '',
    });
  });

  it('shows the api’s own refusal as received', async () => {
    vi.mocked(sendReminderAction).mockResolvedValue({
      status: API_OUTCOME.Problem,
      problem: { type: 'conflict', title: 'Conflict', detail: 'Raportul nu mai este deschis.', status: 409 },
    });
    panelWith(READY);

    await choose();
    await userEvent.click(screen.getByRole('button', { name: words.submit }));

    expect(await screen.findByText('Raportul nu mai este deschis.')).toBeInTheDocument();
    expect(dialogue()).toContainElement(screen.getByText('Raportul nu mai este deschis.'));
  });

  it('refuses a note past its bound before anything is sent', async () => {
    panelWith(READY);

    await choose();
    const note = screen.getByRole('textbox', { name: words.note });
    await userEvent.click(note);
    await userEvent.paste('a'.repeat(501));
    await userEvent.click(screen.getByRole('button', { name: words.submit }));

    expect(sendReminderAction).not.toHaveBeenCalled();
    // Twice by design: the form's summary above the fields (UX-111), and the field's own message beneath it.
    expect(await screen.findAllByText(/Nota are mai mult de 500 de caractere/)).toHaveLength(2);
  });
});
