import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'use-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { PROBLEM_TYPE, type ConsoleCategory } from '@easyesg/contracts';
import ro from '~/messages/ro.json';
import { CONSOLE_LOCALE, CONSOLE_TIME_ZONE, formats } from '~/i18n';
import { CategoriesSection } from './categories-section';

/**
 * A-17 between a write's answer and the read it invalidates (23 Oct 2026). The wire module is the mocked seam, and
 * the read after each write is **held** — what a slow network does, and what the browser journey met unprompted.
 * Under test is the order: a notice says what the record shows, and the result's revert is keyed by the revision the
 * record read, so neither may arrive before that read does. The browser journey
 * (`e2e/admin/notification-categories.spec.ts`) proves the same screen against the api.
 */
const mocks = vi.hoisted(() => ({ read: vi.fn(), preview: vi.fn(), run: vi.fn() }));

vi.mock('../../../queries/notification-categories', () => ({
  NOTIFICATION_CATEGORIES_QUERY_KEY: ['admin', 'notification-categories'],
  notificationCategoriesQuery: () => ({ queryKey: ['admin', 'notification-categories'], queryFn: mocks.read }),
  previewCategoryAction: mocks.preview,
  runCategoryAction: mocks.run,
}));

// The read's signed-out arm navigates; no case here reaches it.
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ href: '/notification-templates' }),
  useNavigate: () => () => undefined,
}));

type Channel = 'in_app' | 'email';
const BOTH: readonly Channel[] = ['in_app', 'email'];
const PUBLISHED_AT = Date.UTC(2026, 9, 23, 9, 0);

const reminder = (input: {
  readonly revision: number;
  readonly channels: readonly Channel[];
  readonly previous: readonly Channel[];
  readonly publishedBy?: string;
}): ConsoleCategory => ({
  categoryKey: 'reporting.manual_reminder',
  mandatory: false,
  addressNotice: false,
  cadence: null,
  inForce: {
    channels: [...input.channels],
    classification: 'optional',
    revision: input.revision,
    publishedAt: PUBLISHED_AT,
    publishedBy: input.publishedBy ?? 'operator@easyesg.md',
    previousRevision: input.revision - 1,
    previous: { channels: [...input.previous], classification: 'optional' },
  },
  switchOffs: { inApp: 0, email: 0, people: 0 },
  wording: [],
});

const listed = (category: ConsoleCategory) => ({
  status: 'ok',
  value: { items: [category], total: 1, totalpages: 1 },
  messages: [],
});

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
  return render(
    <CategoriesSection search={{ category: 'reporting.manual_reminder' }} onSearchChange={() => undefined} />,
    { wrapper },
  );
};

/** The callout carrying a title — a notice is a `status` with no name of its own. */
const noticeTitled = (title: string) =>
  screen.queryAllByRole('status').find((element) => within(element).queryByText(title) !== null) ?? null;

const PUBLISHED = 'Setările categoriei Mementouri au fost publicate și au efect în câteva secunde.';
const REVERT = 'Reveniți la setările anterioare';

/** UX-123's preview → disclosure → confirm, for the in-app channel switched off. */
async function publishWithoutInApp(user: ReturnType<typeof userEvent.setup>, record: HTMLElement) {
  await user.click(within(record).getByRole('checkbox', { name: 'În aplicație' }));
  await user.click(within(record).getByRole('button', { name: 'Previzualizați și publicați' }));
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Publicați' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('A-17 · a write and the read after it', () => {
  it('draws the result once the record shows the publication, and reverts against the revision it made', async () => {
    const user = userEvent.setup();
    const reread = held<ReturnType<typeof listed>>();
    mocks.read
      .mockResolvedValueOnce(listed(reminder({ revision: 3, channels: BOTH, previous: BOTH })))
      .mockReturnValueOnce(reread.promise)
      .mockResolvedValue(listed(reminder({ revision: 5, channels: BOTH, previous: ['email'] })));
    mocks.preview.mockResolvedValue({
      status: 'ok',
      value: { consequences: [{ kind: 'channel_removed', channel: 'in_app' }] },
      messages: [],
    });
    mocks.run.mockResolvedValue({ status: 'ok', value: { id: 'version-4', revision: 4 }, messages: [] });
    renderSection();

    const record = await screen.findByRole('dialog', { name: 'Mementouri' });
    await publishWithoutInApp(user, record);
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));

    // The write has answered and the read has not: nothing on the screen may yet act on revision 3.
    expect(screen.queryByText(PUBLISHED)).not.toBeInTheDocument();
    expect(within(record).getByRole('button', { name: REVERT })).toBeDisabled();

    reread.release(listed(reminder({ revision: 4, channels: ['email'], previous: BOTH })));
    await screen.findByText(PUBLISHED);
    const result = noticeTitled('Setările sunt în vigoare');
    expect(result).not.toBeNull();

    await user.click(within(result as HTMLElement).getByRole('button', { name: REVERT }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reveniți' }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2));
    expect(mocks.run.mock.calls[1]?.[0]).toMatchObject({ control: 'revert', expectedRevision: 4 });
  });

  it('says a colleague published first once the record shows what they published', async () => {
    const user = userEvent.setup();
    const reread = held<ReturnType<typeof listed>>();
    mocks.read
      .mockResolvedValueOnce(listed(reminder({ revision: 3, channels: BOTH, previous: BOTH })))
      .mockReturnValueOnce(reread.promise);
    mocks.preview.mockResolvedValue({
      status: 'ok',
      value: { consequences: [{ kind: 'channel_removed', channel: 'in_app' }] },
      messages: [],
    });
    mocks.run.mockResolvedValue({
      status: 'problem',
      problem: { type: PROBLEM_TYPE.NotificationCategoryChanged, status: 409 },
    });
    renderSection();

    const record = await screen.findByRole('dialog', { name: 'Mementouri' });
    await publishWithoutInApp(user, record);
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));

    // The notice says the record now shows what is in force — not true until the read lands.
    expect(noticeTitled('Setările s-au schimbat între timp')).toBeNull();

    // The colleague took the email away, and left in-app on.
    reread.release(
      listed(reminder({ revision: 4, channels: ['in_app'], previous: BOTH, publishedBy: 'colleague@easyesg.md' })),
    );
    await waitFor(() => expect(noticeTitled('Setările s-au schimbat între timp')).not.toBeNull());
    expect(within(record).getByRole('checkbox', { name: 'În aplicație' })).toBeChecked();
    expect(within(record).getByRole('checkbox', { name: 'E-mail' })).not.toBeChecked();
  });
});
