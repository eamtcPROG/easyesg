import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'use-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { LegalControllerRecord } from '@easyesg/contracts';
import ro from '~/messages/ro.json';
import { CONSOLE_LOCALE, CONSOLE_TIME_ZONE, formats } from '~/i18n';
import { LegalControllerSection } from './legal-controller-section';

/**
 * A-21 between a save's answer and the read it invalidates (23 Oct 2026), A-17's case in this screen's shape. The wire
 * module is the mocked seam and the read after the save is **held**. Under test is the order: the form is keyed by the
 * revision it read, so a second save made before that read lands would carry the revision before the first, which
 * the api refuses as a colleague's. The browser journey (`e2e/admin/legal-controller.spec.ts`) proves the same screen
 * against the api.
 */
const mocks = vi.hoisted(() => ({ read: vi.fn(), publish: vi.fn() }));

vi.mock('../../../queries/legal-controller', () => ({
  LEGAL_CONTROLLER_QUERY_KEY: ['admin', 'legal-controller'],
  legalControllerQuery: () => ({ queryKey: ['admin', 'legal-controller'], queryFn: mocks.read }),
  publishLegalController: mocks.publish,
}));

// The read's signed-out arm navigates; no case here reaches it.
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ href: '/legal-controller' }),
  useNavigate: () => () => undefined,
}));

const operatorRecord = (input: { readonly revision: number; readonly registeredName: string }): LegalControllerRecord => ({
  registeredName: input.registeredName,
  // The seed's IDNO, whose check digit the field judges before the round trip.
  idno: '1099600012345',
  registeredAddress: 'str. Exemplului 1, MD-2001, mun. Chișinău',
  dataProtectionEmail: 'privacy@easyesg.md',
  revision: input.revision,
  changedByEmail: input.revision === 1 ? null : 'operator@easyesg.md',
  changedAt: input.revision === 1 ? null : Date.UTC(2026, 9, 23, 9, 0),
});

const answered = (record: LegalControllerRecord) => ({ status: 'ok', value: record, messages: [] });

/** A promise the case resolves when it chooses — the read that has not landed yet. */
function held<T>() {
  let release: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

const renderSection = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlProvider locale={CONSOLE_LOCALE} messages={ro} formats={formats} timeZone={CONSOLE_TIME_ZONE}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </IntlProvider>
  );
  return render(<LegalControllerSection />, { wrapper });
};

const SAVED = 'Datele operatorului au fost salvate';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('A-21 · a save and the read after it', () => {
  it('draws the save once the form shows it, and saves next against the revision it made', async () => {
    const user = userEvent.setup();
    const reread = held<ReturnType<typeof answered>>();
    mocks.read
      .mockResolvedValueOnce(answered(operatorRecord({ revision: 1, registeredName: 'EasyESG SRL' })))
      .mockReturnValueOnce(reread.promise)
      .mockResolvedValue(answered(operatorRecord({ revision: 3, registeredName: 'EasyESG Platform SRL' })));
    mocks.publish
      .mockResolvedValueOnce({ status: 'ok', value: { id: 'version-2', revision: 2 }, messages: [] })
      .mockResolvedValue({ status: 'ok', value: { id: 'version-3', revision: 3 }, messages: [] });
    renderSection();

    const name = await screen.findByLabelText('Denumirea înregistrată');
    await user.clear(name);
    await user.type(name, 'EasyESG Moldova SRL');
    await user.click(screen.getByRole('button', { name: 'Salvați datele' }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));

    // The save has answered and the read has not: the form still holds revision 1, so it may not be saved again yet.
    expect(screen.queryByText(SAVED)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvați datele' })).toBeDisabled();

    reread.release(answered(operatorRecord({ revision: 2, registeredName: 'EasyESG Moldova SRL' })));
    await screen.findByText(SAVED);

    const renamed = screen.getByLabelText('Denumirea înregistrată');
    await user.clear(renamed);
    await user.type(renamed, 'EasyESG Platform SRL');
    await user.click(screen.getByRole('button', { name: 'Salvați datele' }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(2));
    expect(mocks.publish.mock.calls[1]?.[0]).toMatchObject({ registeredName: 'EasyESG Platform SRL', revision: 2 });
  });
});
