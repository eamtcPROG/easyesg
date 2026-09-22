import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { API_OUTCOME } from '@/lib/api-outcome';
import { sendReminderAction } from '../../../actions/actions';
import { ACCESS_PAGE_SIZE, DEFAULT_ACCESS_VIEW, type AccessPage } from '../../../tools/access';
import { REMINDER_ARM, type ReminderRegion } from '../../../tools/reminder';
import { seatRegion } from '../../../tools/seats';
import { AccessProvider } from '../../shared/access-context';
import { RemindMember } from './remind-member';

/**
 * S-16's reminder panel (task 50.3): one arm per region, and the form's send — what it hands the action, what it
 * says after, and the note's bound met before anything is sent. The browser suite drives it against the api; what
 * only this reaches is the unavailable arm, which no journey can provoke without breaking a read under a running
 * stack.
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

/** jsdom implements neither, and Radix Select reaches for both. */
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => vi.mocked(sendReminderAction).mockReset());

const emptyPage: AccessPage = { rows: [], matched: 0, total: 0, page: 1, pageSize: ACCESS_PAGE_SIZE, administrators: 1 };

const READY: ReminderRegion = {
  arm: REMINDER_ARM.READY,
  people: [{ membershipId: 'membership-ivan', displayName: 'Ivan Rusu', email: 'ivan@example.md' }],
  reports: [{ id: 'report-2026', entityName: 'Brutăria Lina', fiscalYear: 2026 }],
};

const panelWith = (reminder: ReminderRegion) =>
  render(
    <NextIntlClientProvider
      locale="ro"
      formats={formats}
      timeZone="Europe/Chisinau"
      messages={{ organization: ro.organization, identity: ro.identity, forms: ro.forms }}
    >
      <AccessProvider
        page={emptyPage}
        view={DEFAULT_ACCESS_VIEW}
        seats={seatRegion({ allowance: 10, used: 2 })}
        inviteAnchorId="invite"
      >
        <RemindMember region={reminder} />
      </AccessProvider>
    </NextIntlClientProvider>,
  );

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

    expect(screen.getByRole('heading', { level: 2, name: words.heading })).toBeInTheDocument();
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

  it('says there is no one to remind, and leads to the invite panel above', () => {
    panelWith({ arm: REMINDER_ARM.NO_ONE });

    expect(screen.getByText(words.noOne.body, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: words.noOne.action })).toHaveAttribute('href', '#invite');
  });

  it('says what it could not read, offers no form over a guess, and asks again when told to', async () => {
    panelWith({ arm: REMINDER_ARM.UNAVAILABLE });

    expect(screen.getByText(words.unavailable.title)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: words.unavailable.retry }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('RemindMember — sending', () => {
  it('sends the person, the report and the note, and says to whom it went', async () => {
    vi.mocked(sendReminderAction).mockResolvedValue({ status: API_OUTCOME.Ok, value: null, messages: [] });
    panelWith(READY);

    await choose();
    await userEvent.type(screen.getByRole('textbox', { name: words.note }), 'Lipsesc datele despre energie.');
    await userEvent.click(screen.getByRole('button', { name: words.submit }));

    expect(sendReminderAction).toHaveBeenCalledWith({
      reportId: 'report-2026',
      membershipId: 'membership-ivan',
      note: 'Lipsesc datele despre energie.',
    });
    expect(await screen.findByText('Mementoul a fost trimis către Ivan Rusu.')).toBeInTheDocument();
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
