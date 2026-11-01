import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LEGAL_VERSIONS_IN_FORCE } from '@easyesg/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { acceptLegalDocumentsAction } from '../../actions/actions';
import { AcceptTermsForm } from './accept-terms-form';

/**
 * S-43's acceptance (task 195), against the real Romanian catalogue: the box names only the documents owed, nothing
 * leaves until it is ticked, and what leaves is the versions this page displayed with the way back.
 */
vi.mock('../../actions/actions', () => ({ acceptLegalDocumentsAction: vi.fn() }));
vi.mock('../../../shared/components/sign-out', () => ({ SignOut: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={String(href)}>{children}</a>,
}));

const accept = vi.mocked(acceptLegalDocumentsAction);

const TERMS_ONLY = [{ document: 'terms', version: '1.0', acceptedVersion: '0.9' }] as const;
const BOTH = [
  { document: 'terms', version: '1.0', acceptedVersion: null },
  { document: 'privacy', version: '1.0', acceptedVersion: null },
] as const;

const renderForm = (owed: typeof TERMS_ONLY | typeof BOTH) =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <AcceptTermsForm owed={owed} returnTo="/reports/42" />
    </NextIntlClientProvider>,
  );

beforeEach(() => vi.clearAllMocks());

describe('S-43 · the acceptance', () => {
  it('asks about the terms alone when a release moved the terms alone', () => {
    renderForm(TERMS_ONLY);
    expect(screen.getByRole('checkbox', { name: ro.identity.legalAcceptance.label.terms.replace(/<\/?terms>/gu, '') }))
      .toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Politica de confidențialitate' })).not.toBeInTheDocument();
  });

  it('sends nothing until the box is ticked, and says so beside it', async () => {
    const user = userEvent.setup();
    renderForm(BOTH);

    await user.click(screen.getByRole('button', { name: ro.identity.acceptance.continue }));

    expect(accept).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
    // Twice, and no more: beside the box and in the UX-111 summary that links to it.
    expect(screen.getAllByText(ro.identity.legalAcceptance.missing)).toHaveLength(2);
  });

  it('sends the versions this page displayed, with the way back, once ticked', async () => {
    const user = userEvent.setup();
    accept.mockResolvedValue(undefined);
    renderForm(BOTH);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: ro.identity.acceptance.continue }));

    await waitFor(() =>
      expect(accept).toHaveBeenCalledWith({ legalVersions: LEGAL_VERSIONS_IN_FORCE, returnTo: '/reports/42' }),
    );
  });

  it('renders the api’s refusal as received — a release replaced the text while the page was open', async () => {
    const user = userEvent.setup();
    accept.mockResolvedValue({
      status: 'problem',
      problem: {
        type: 'https://easyesg.md/problems/legal-version-changed',
        status: 409,
        title: 'Documentele s-au actualizat',
        detail: 'Reîncărcați pagina…',
      },
    });
    renderForm(BOTH);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: ro.identity.acceptance.continue }));

    const callout = await screen.findByRole('alert');
    expect(callout).toHaveTextContent('Documentele s-au actualizat');
    expect(callout).toHaveTextContent('Reîncărcați pagina…');
  });
});
