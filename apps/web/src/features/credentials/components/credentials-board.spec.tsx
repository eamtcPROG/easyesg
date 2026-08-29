import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { API_OUTCOME } from '@/lib/api-outcome';
import { SECTION_READ, type CredentialsRead } from '../credentials';
import { changePasswordAction, disableTotpAction } from '../actions';
import { CredentialsBoard } from './credentials-board';

/**
 * S-28's board, against stubbed actions and the real Romanian catalogue.
 *
 * What is pinned here is what the 28 Aug 2026 refactor fixed and no browser journey asserts.
 * Three of the four cases are invisible to a journey by construction: a journey signs in with one
 * account and sees one screen, so it never meets a half-failed read, and it cannot tell a refusal
 * carrying one remedy from the same refusal carrying two.
 */
vi.mock('../actions', () => ({
  changePasswordAction: vi.fn(),
  beginTotpEnrolmentAction: vi.fn(),
  confirmTotpEnrolmentAction: vi.fn(),
  disableTotpAction: vi.fn(),
  reissueRecoveryCodesAction: vi.fn(),
  linkProviderAction: vi.fn(),
  unlinkProviderAction: vi.fn(),
}));

const changePassword = vi.mocked(changePasswordAction);
const disableTotp = vi.mocked(disableTotpAction);

/** What `i18n/request.ts` sets — passed explicitly, since a spec's own provider inherits none. */
const TIME_ZONE = 'Europe/Chisinau';

const READY: CredentialsRead = {
  factor: {
    status: SECTION_READ.READY,
    value: { enrolled: true, recoveryCodesRemaining: 4 },
  },
  providers: {
    status: SECTION_READ.READY,
    value: [{ provider: 'google', assertedEmail: 'ana.rusu@gmail.com' }],
  },
};

const draw = (read: CredentialsRead = READY) =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro} formats={formats} timeZone={TIME_ZONE}>
      <CredentialsBoard read={read} pendingLinkProvider={null} />
    </NextIntlClientProvider>,
  );

describe('CredentialsBoard', () => {
  it('asks for the current password exactly once', () => {
    draw();

    // The regression this spec exists for. S-28 shipped with two inputs rendering the SAME message
    // key — one inside the password section, one as the record's gate — so a reader met "Parola
    // actuală" twice in one viewport, under a docblock claiming there was one field for the whole
    // record. The literal is the catalogue's, deliberately: a constant here would not break if the
    // wording were split back into two keys.
    expect(screen.getAllByLabelText(/Parola actuală/u)).toHaveLength(1);
  });

  it('keeps a section usable when the other one could not be read', () => {
    draw({ ...READY, providers: { status: SECTION_READ.UNREACHABLE } });

    // §8.1's partial state: a provider list that could not be fetched must not hide a working
    // password form. Per section, which is why the read is two outcomes and not one.
    expect(screen.getByText(ro.identity.credentials.unreachable.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ro.identity.credentials.password.submit })).toBeEnabled();
  });

  it('renders a refusal as the API sent it, with no second "what now"', async () => {
    const user = userEvent.setup();
    changePassword.mockResolvedValue({
      status: API_OUTCOME.Problem,
      problem: {
        type: 'https://easyesg.md/problems/too-many-requests',
        status: 429,
        title: 'Prea multe încercări',
        detail: 'Așteptați câteva minute înainte de a încerca din nou.',
      },
    });

    draw();
    await user.type(screen.getByLabelText(/Parola nouă/u), 'Parola-Noua-1');
    await user.click(screen.getByRole('button', { name: ro.identity.credentials.password.submit }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Așteptați câteva minute');
    // The defect: the screen used to add "Încercați din nou." underneath, which on a throttle
    // refusal contradicts the sentence above it outright.
    expect(alert).not.toHaveTextContent(/Încercați din nou/u);
  });

  it('names what happened when the recovery codes run out, and offers the fix once', () => {
    draw({
      ...READY,
      factor: {
        status: SECTION_READ.READY,
        value: { enrolled: true, recoveryCodesRemaining: 0 },
      },
    });

    // UC-195's failure mode, and a designed state rather than a count of nought: recovery codes
    // are the way in when the authenticator is unavailable, so zero of them means no way in.
    // `ATTENTION` announces politely, hence `status` rather than `alert`.
    const notice = screen.getByRole('status');
    // The title said "Verificare în doi pași" until 29 Aug 2026 — NFR-79's "what happened" filled
    // with the name of the region the reader was already looking at.
    expect(notice).toHaveTextContent(ro.identity.credentials.factor.noCodesTitle);
    expect(notice).toHaveTextContent(ro.identity.credentials.factor.noCodesBody);

    // The re-issue control lives INSIDE the callout and nowhere else: §11.5 requires the third
    // part, and a second button beside it would ask the reader which one to trust.
    const reissue = ro.identity.credentials.factor.reissue;
    expect(screen.getAllByRole('button', { name: reissue })).toHaveLength(1);
    expect(within(notice).getByRole('button', { name: reissue })).toBeVisible();
  });

  it('makes only the acting section inert', async () => {
    const user = userEvent.setup();
    // Never settles, so the screen stays mid-action for the length of the assertion.
    disableTotp.mockReturnValue(new Promise(() => {}));

    draw();
    await user.click(screen.getByRole('button', { name: ro.identity.credentials.factor.disable }));

    // S-16's per-row lesson, applied per section: a screen-wide flag would have greyed out the
    // password form too. `waitFor`, because a busy flag and the state that set it do not
    // necessarily commit together (apps/web/CLAUDE.md, 28 Aug 2026).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: ro.identity.credentials.factor.disable })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: ro.identity.credentials.password.submit })).toBeEnabled();
  });
});
