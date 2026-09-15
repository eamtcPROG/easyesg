import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsentWorkProvider, useReportUnsentWork, type UnsentWork } from '@/client/unsent-work/unsent-work';
import { formats } from '@/i18n/formats';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import ro from '@/messages/ro.json';
import { switchOrganizationAction } from '../actions/actions';
import { OrganizationSwitchNotice } from './organization-switch-notice';
import { OrganizationSwitchProvider, useOrganizationSwitch } from './organization-switch-provider';

/**
 * The switch's flow against a stubbed action and a real registry (task 83.2; UX-3, UX-37). The browser
 * suite drives a switch end to end and one offline wizard; what is pinned here is each branch a choice can
 * take, including the ones that need a drain or a stall timed around a click.
 */
vi.mock('../actions/actions', () => ({ switchOrganizationAction: vi.fn() }));

const refresh = vi.fn();
const push = vi.fn();
/** The address the provider reads — moved by the case that follows a refusal off its screen. */
const address = { pathname: '/entities' };
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => address.pathname,
  useRouter: () => ({ refresh, push }),
}));

/**
 * The action's answer when the switch lands: where to go, which the provider navigates to itself. **Not the
 * address switched on**, so a provider that pushed its own pathname could not pass for one that pushed this.
 */
const LANDED: ApiOutcome<{ readonly href: string }> = {
  status: API_OUTCOME.Ok,
  value: { href: '/reports' },
  messages: [],
};

const REFUSED_TITLE = 'Nu a fost găsit';
const REFUSED_DETAIL = 'Contul dumneavoastră nu face parte din organizația aleasă.';
const REFUSED: ApiOutcome<{ readonly href: string }> = {
  status: API_OUTCOME.Problem,
  problem: {
    type: 'https://easyesg.md/problems/not-found',
    status: 404,
    title: REFUSED_TITLE,
    detail: REFUSED_DETAIL,
  },
};

function Chooser() {
  const { choose, pendingOrganizationId } = useOrganizationSwitch();
  return (
    <>
      <button type="button" onClick={() => choose('org-b')}>
        Choose Beta
      </button>
      <p>{`pending ${pendingOrganizationId ?? 'none'}`}</p>
    </>
  );
}

function Reporter({ work }: { readonly work: UnsentWork }) {
  useReportUnsentWork(work);
  return null;
}

const retry = vi.fn();
// `formats` because the dialogue's object counts answers through the catalogue's plural (`apps/web/CLAUDE.md`).
const tree = (work: UnsentWork | null) => (
  <NextIntlClientProvider locale="ro" timeZone="Europe/Chisinau" formats={formats} messages={{ chrome: ro.chrome }}>
    <UnsentWorkProvider>
      <OrganizationSwitchProvider>
        {work === null ? null : <Reporter work={work} />}
        <OrganizationSwitchNotice />
        <Chooser />
      </OrganizationSwitchProvider>
    </UnsentWorkProvider>
  </NextIntlClientProvider>
);

const copy = ro.chrome.organizationSwitcher;

describe('the organization switch (task 83.2)', () => {
  beforeEach(() => {
    vi.mocked(switchOrganizationAction).mockReset();
    refresh.mockReset();
    push.mockReset();
    retry.mockReset();
    address.pathname = '/entities';
  });

  it('sends the choice at once when nothing is unsent, and lands where the action says', async () => {
    vi.mocked(switchOrganizationAction).mockResolvedValue(LANDED);
    render(tree(null));

    await userEvent.click(screen.getByRole('button', { name: 'Choose Beta' }));

    expect(switchOrganizationAction).toHaveBeenCalledWith({ organizationId: 'org-b', from: '/entities' });
    expect(retry).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/reports'));
  });

  /**
   * **Pending ends once the switch has landed.** What this holds is the provider's half: it navigates, and
   * reads pending off the transition rather than a flag of its own. The defect the compact browser journey
   * found was a redirecting action's *rejected* promise, which a resolving stub cannot produce — the browser
   * suite's `aria-busy` assertions hold that.
   */
  it('is no longer pending once the switch has landed', async () => {
    vi.mocked(switchOrganizationAction).mockResolvedValue(LANDED);
    render(tree(null));

    await userEvent.click(screen.getByRole('button', { name: 'Choose Beta' }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('pending none')).toBeInTheDocument());
  });

  it('waits for unsent answers that are still going, and sends once they have gone (UX-3)', async () => {
    vi.mocked(switchOrganizationAction).mockResolvedValue(LANDED);
    const { rerender } = render(tree({ unsynced: 2, blocked: false, retry }));

    await userEvent.click(screen.getByRole('button', { name: 'Choose Beta' }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(switchOrganizationAction).not.toHaveBeenCalled();
    expect(screen.getByText('pending org-b')).toBeInTheDocument();

    rerender(tree({ unsynced: 0, blocked: false, retry }));

    await waitFor(() =>
      expect(switchOrganizationAction).toHaveBeenCalledWith({ organizationId: 'org-b', from: '/entities' }),
    );
  });

  it('asks before leaving answers that cannot go, and sends nothing when the reader stays (UX-37)', async () => {
    render(tree({ unsynced: 2, blocked: true, retry }));

    await userEvent.click(screen.getByRole('button', { name: 'Choose Beta' }));

    // `alertdialog`: `ConsequenceDialogue` is Radix's AlertDialog, the role a destructive question takes.
    expect(await screen.findByRole('alertdialog', { name: copy.confirm.title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.confirm.cancel }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(switchOrganizationAction).not.toHaveBeenCalled();
    expect(screen.getByText('pending none')).toBeInTheDocument();
  });

  it('sends once the reader confirms leaving them', async () => {
    vi.mocked(switchOrganizationAction).mockResolvedValue(LANDED);
    render(tree({ unsynced: 2, blocked: true, retry }));

    await userEvent.click(screen.getByRole('button', { name: 'Choose Beta' }));
    await userEvent.click(await screen.findByRole('button', { name: copy.confirm.proceed }));

    await waitFor(() =>
      expect(switchOrganizationAction).toHaveBeenCalledWith({ organizationId: 'org-b', from: '/entities' }),
    );
  });

  it('shows a refusal below the band in the api’s own words, and reads the band again', async () => {
    vi.mocked(switchOrganizationAction).mockResolvedValue(REFUSED);
    render(tree(null));

    await userEvent.click(screen.getByRole('button', { name: 'Choose Beta' }));

    expect(await screen.findByText(REFUSED_TITLE)).toBeInTheDocument();
    expect(screen.getByText(REFUSED_DETAIL)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  /** A refusal describes the screen it was made on, so a return to that address is not a reason to repeat it. */
  it('keeps a refusal to its screen, and does not bring it back when the reader returns', async () => {
    vi.mocked(switchOrganizationAction).mockResolvedValue(REFUSED);
    const { rerender } = render(tree(null));
    await userEvent.click(screen.getByRole('button', { name: 'Choose Beta' }));
    expect(await screen.findByText(REFUSED_TITLE)).toBeInTheDocument();

    address.pathname = '/reports';
    rerender(tree(null));
    expect(screen.queryByText(REFUSED_TITLE)).toBeNull();

    address.pathname = '/entities';
    rerender(tree(null));
    expect(screen.queryByText(REFUSED_TITLE)).toBeNull();
  });

  it('says so in its own words when no answer arrived', async () => {
    vi.mocked(switchOrganizationAction).mockResolvedValue({ status: API_OUTCOME.Unreachable });
    render(tree(null));

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Choose Beta' }));
    });

    expect(await screen.findByText(copy.unreachable.title)).toBeInTheDocument();
  });
});
