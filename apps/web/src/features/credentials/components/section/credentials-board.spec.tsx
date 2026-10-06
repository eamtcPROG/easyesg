import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { API_OUTCOME } from '@/lib/api-outcome';
import { SECTION_READ, type CredentialsRead } from '../../tools/credentials';
import type { LocalizedPath } from '@/lib/locale-path';
import { CREDENTIALS_ARRIVAL, type CredentialsArrival } from '../../tools/credentials-arrival';
import {
  beginTotpEnrolmentAction,
  changePasswordAction,
  confirmTotpEnrolmentAction,
  disableTotpAction,
} from '../../actions/actions';
import { CredentialsBoard } from './credentials-board';

/**
 * S-28's board, against stubbed actions and the real Romanian catalogue (task 169; OQ-19 closed 24 Sep 2026).
 *
 * What is pinned is what no browser journey sees by construction: a journey signs in with one account and meets one
 * shape of it, so it never meets a half-failed read, an account with no password and one provider, or a refusal
 * carrying one remedy against the same refusal carrying two.
 */
vi.mock('../../actions/actions', () => ({
  changePasswordAction: vi.fn(),
  beginTotpEnrolmentAction: vi.fn(),
  confirmTotpEnrolmentAction: vi.fn(),
  disableTotpAction: vi.fn(),
  reissueRecoveryCodesAction: vi.fn(),
  linkProviderAction: vi.fn(),
  unlinkProviderAction: vi.fn(),
}));

// The locale-aware `Link` (the password row's *Set a password*), forwarding its props as the real one does.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const changePassword = vi.mocked(changePasswordAction);
const disableTotp = vi.mocked(disableTotpAction);
const beginTotp = vi.mocked(beginTotpEnrolmentAction);
const confirmTotp = vi.mocked(confirmTotpEnrolmentAction);

const copy = ro.identity.credentials;
/** What `i18n/request.ts` sets — passed explicitly, since a spec's own provider inherits none. */
const TIME_ZONE = 'Europe/Chisinau';
/** 12 February 2026, 09:30 in Chișinău — the artboard's date. */
const CHANGED_AT = Date.UTC(2026, 1, 12, 7, 30);

const READY: CredentialsRead = {
  password: { status: SECTION_READ.READY, value: { set: true, changedAt: CHANGED_AT } },
  factor: {
    status: SECTION_READ.READY,
    value: { enrolled: true, recoveryCodesRemaining: 4, enrolmentPromptDismissed: false },
  },
  providers: {
    status: SECTION_READ.READY,
    value: [{ provider: 'google', assertedEmail: 'ana.rusu@gmail.com' }],
  },
};

const draw = (
  read: CredentialsRead = READY,
  pendingLinkProvider: 'google' | 'microsoft' | null = null,
  arrival: CredentialsArrival | null = null,
  onward: LocalizedPath | null = null,
) =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro} formats={formats} timeZone={TIME_ZONE}>
      <CredentialsBoard read={read} pendingLinkProvider={pendingLinkProvider} arrival={arrival} onward={onward} />
    </NextIntlClientProvider>,
  );

const region = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CredentialsBoard', () => {
  // Task 190 (UC-195 step 3): after a recovery sign-in the screen opens saying how many codes remain, from its own read.
  describe('arriving from a recovery sign-in', () => {
    const arrival = copy.arrival.recovered;
    const withCodes = (remaining: number): CredentialsRead => ({
      ...READY,
      factor: {
        status: SECTION_READ.READY,
        value: { enrolled: true, recoveryCodesRemaining: remaining, enrolmentPromptDismissed: false },
      },
    });

    it('states the codes left, from the read the factor row shows', () => {
      draw(withCodes(9), null, CREDENTIALS_ARRIVAL.RECOVERED);
      expect(screen.getAllByText(arrival.title)).toHaveLength(1);
      expect(screen.getByText(arrival.body.replace('{remaining}', '9'))).toBeVisible();
    });

    it('says what zero means rather than stating a count of none', () => {
      draw(withCodes(0), null, CREDENTIALS_ARRIVAL.RECOVERED);
      expect(screen.getByText(arrival.bodyNone)).toBeVisible();
      expect(screen.queryByText(arrival.body.replace('{remaining}', '0'))).toBeNull();
    });

    it('guesses no count when the factor could not be read', () => {
      draw({ ...READY, factor: { status: SECTION_READ.UNREACHABLE } }, null, CREDENTIALS_ARRIVAL.RECOVERED);
      expect(screen.getByText(arrival.bodyUnread)).toBeVisible();
    });

    // The owner's amendment of decision (1): the sign-in's own destination is carried and offered, so an invitee keeps
    // the way back to their invitation.
    it('offers the way on to where the sign-in was going, once', () => {
      draw(withCodes(9), null, CREDENTIALS_ARRIVAL.RECOVERED, { href: '/invitation/abc', locale: undefined });
      const onward = screen.getAllByRole('link', { name: arrival.onward });
      expect(onward).toHaveLength(1);
      expect(onward[0]).toHaveAttribute('href', '/invitation/abc');
    });

    it('offers no way on when none was carried', () => {
      draw(withCodes(9), null, CREDENTIALS_ARRIVAL.RECOVERED);
      expect(screen.queryByRole('link', { name: arrival.onward })).toBeNull();
    });

    it('announces nothing on an ordinary visit', () => {
      draw();
      expect(screen.queryByText(arrival.title)).toBeNull();
    });
  });

  it('rests as rows, and asks for the current password once, in the row the reader opened', async () => {
    const user = userEvent.setup();
    draw();

    // At rest nothing asks for a secret: every row is a summary with its trigger (the artboard).
    expect(screen.queryAllByLabelText(/Parola actuală/u)).toHaveLength(0);
    expect(within(region(copy.password.heading)).getByText('Schimbată ultima dată pe 12 februarie 2026.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: copy.password.change }));
    expect(screen.getByRole('button', { name: copy.password.change })).toHaveAttribute('aria-expanded', 'true');
    // The regression the record-level field was built against: one secret, one field. Opening another row closes
    // this one rather than adding a second. The literal is the catalogue's, deliberately.
    expect(screen.getAllByLabelText(/Parola actuală/u)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: copy.factor.disable }));
    expect(screen.getAllByLabelText(/Parola actuală/u)).toHaveLength(1);
    expect(screen.getByRole('button', { name: copy.password.change })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a row usable when another could not be read, and says nothing it does not know', () => {
    draw({ ...READY, providers: { status: SECTION_READ.UNREACHABLE } });

    // §8.1's partial state, per row.
    expect(within(region(copy.providers.heading)).getByText(copy.unreachable.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.password.change })).toBeEnabled();
    // The closing note needs both reads; from half of them it would state what the screen does not know.
    // Every variant of the note names a *cale de acces*; none may be drawn.
    expect(screen.queryByText(/cale(a)? de acces/u)).toBeNull();
  });

  it('renders a refusal inside the row it refused, as the api sent it, with no second "what now"', async () => {
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
    await user.click(screen.getByRole('button', { name: copy.password.change }));
    await user.type(screen.getByLabelText(/Parola actuală/u), 'Parola-Veche-1');
    await user.type(screen.getByLabelText(/Parola nouă/u), 'Parola-Noua-1');
    await user.click(screen.getByRole('button', { name: copy.password.submit }));

    const alert = await within(region(copy.password.heading)).findByRole('alert');
    expect(alert).toHaveTextContent('Așteptați câteva minute');
    expect(alert).not.toHaveTextContent(/Încercați din nou/u);
    // The row stays open, so the reader answers the refusal where they read it.
    expect(screen.getByLabelText(/Parola nouă/u)).toBeVisible();
  });

  it('names what happened when the recovery codes run out, and offers the fix once', () => {
    draw({ ...READY, factor: { status: SECTION_READ.READY, value: { enrolled: true, recoveryCodesRemaining: 0, enrolmentPromptDismissed: false } } });

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(copy.factor.noCodesTitle);
    expect(notice).toHaveTextContent(copy.factor.noCodesBody);
    // The re-issue lives INSIDE the warning and nowhere else while it stands: the row's own trigger steps aside.
    expect(screen.getAllByRole('button', { name: copy.factor.reissue })).toHaveLength(1);
    expect(within(notice).getByRole('button', { name: copy.factor.reissue })).toBeVisible();
  });

  it('makes only the acting row inert', async () => {
    const user = userEvent.setup();
    // Never settles, so the screen stays mid-action for the length of the assertion.
    disableTotp.mockReturnValue(new Promise(() => {}));

    draw();
    await user.click(screen.getByRole('button', { name: copy.factor.disable }));
    await user.type(screen.getByLabelText(/Parola actuală/u), 'Parola-Veche-1');
    await user.click(screen.getByRole('button', { name: copy.factor.disableSubmit }));

    // `waitFor`: a busy flag and the state that set it do not necessarily commit together (apps/web/CLAUDE.md).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: copy.factor.disableSubmit })).toHaveAttribute('aria-busy', 'true');
    });
    expect(screen.getByRole('button', { name: copy.password.change })).toBeEnabled();
  });

  it('withholds unlinking the last way in, says why before the reader tries, and offers a password', () => {
    draw({ ...READY, password: { status: SECTION_READ.READY, value: { set: false, changedAt: null } } });

    const identities = region(copy.providers.heading);
    expect(within(identities).queryByRole('button', { name: /Dezasociați/u })).toBeNull();
    expect(screen.getByText('Google este singura dumneavoastră cale de acces', { exact: false })).toBeVisible();
    expect(within(region(copy.password.heading)).getByRole('link', { name: copy.password.set })).toHaveAttribute(
      'href',
      '/reset',
    );
  });

  it('offers every provider, linking the unlinked and unlinking the linked while a password exists', () => {
    draw();

    const identities = region(copy.providers.heading);
    expect(within(identities).getByRole('button', { name: 'Dezasociați Google' })).toBeEnabled();
    expect(within(identities).getByRole('link', { name: 'Asociați Microsoft' })).toHaveAttribute(
      'href',
      '/auth/social/microsoft/start?intent=link',
    );
    expect(screen.getByText(/Puteți dezasocia Google, pentru că există o parolă/u)).toBeVisible();
  });

  it('is born with the returning provider’s row open, awaiting the password', () => {
    draw(READY, 'microsoft');

    const identities = region(copy.providers.heading);
    expect(within(identities).getByRole('button', { name: 'Confirmați asocierea contului Microsoft' })).toBeInTheDocument();
    expect(within(identities).getByLabelText(/Parola actuală/u)).toBeInTheDocument();
  });

  it('turns the factor on in three steps, with the key and the codes copyable and the codes downloadable', async () => {
    const user = userEvent.setup();
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const codes = ['AAAA-BBBB-CCCC-DDDD', 'EEEE-FFFF-GGGG-HHHH'];
    beginTotp.mockResolvedValue({
      status: API_OUTCOME.Ok,
      value: { secret, enrolmentUri: `otpauth://totp/EasyESG:ana@example.md?secret=${secret}&issuer=EasyESG` },
      messages: [],
    });
    confirmTotp.mockResolvedValue({ status: API_OUTCOME.Ok, value: { recoveryCodes: codes }, messages: [] });
    // The file the download writes, caught where the page hands it to the browser.
    const files: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      files.push(blob);
      return 'blob:codes';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    draw({ ...READY, factor: { status: SECTION_READ.READY, value: { enrolled: false, recoveryCodesRemaining: 0, enrolmentPromptDismissed: false } } });
    const factor = region(copy.factor.heading);
    const steps = () => within(factor).getByRole('list', { name: copy.factor.stepsEnrolment });
    const current = () => within(steps()).getByRole('listitem', { current: 'step' });

    await user.click(within(factor).getByRole('button', { name: copy.factor.enable }));
    expect(within(steps()).getAllByRole('listitem')).toHaveLength(3);
    expect(current()).toHaveTextContent(copy.factor.stepConfirm);

    await user.type(within(factor).getByLabelText(/Parola actuală/u), 'Parola-Veche-1');
    await user.click(within(factor).getByRole('button', { name: copy.factor.beginSubmit }));
    expect(await within(factor).findByText(copy.factor.secretHeading)).toBeVisible();
    expect(current()).toHaveTextContent(copy.factor.stepAuthenticator);

    await user.click(within(factor).getByRole('button', { name: copy.factor.copyKey }));
    expect(await navigator.clipboard.readText()).toBe(secret);
    expect(within(factor).getByText(copy.factor.copied)).toBeVisible();

    await user.type(within(factor).getByLabelText(copy.factor.codeLabel), '123456');
    await user.click(within(factor).getByRole('button', { name: copy.factor.confirm }));
    expect(await within(factor).findByText(codes[0] ?? '')).toBeVisible();
    expect(current()).toHaveTextContent(copy.factor.stepCodes);

    await user.click(within(factor).getByRole('button', { name: copy.factor.copyCodes }));
    expect(await navigator.clipboard.readText()).toBe(codes.join('\n'));

    await user.click(within(factor).getByRole('button', { name: copy.factor.downloadCodes }));
    expect(click).toHaveBeenCalledTimes(1);
    const [file] = files;
    expect(await file?.text()).toBe(
      `${copy.factor.codesFileHeading}\r\n${copy.factor.codesFileNote}\r\n\r\n${codes.join('\r\n')}\r\n`,
    );
    click.mockRestore();
  });
});
