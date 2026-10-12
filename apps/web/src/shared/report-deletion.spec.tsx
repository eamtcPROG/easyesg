import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { API_OUTCOME } from '@/lib/api-outcome';
import { deleteReportAction } from './report-deletion-action';
import { useReportDeletion, type DeletableReport } from './report-deletion';

vi.mock('./report-deletion-action', () => ({ deleteReportAction: vi.fn() }));
const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

const remove = vi.mocked(deleteReportAction);
const copy = ro.organization.reports.deletion;

const REPORT: DeletableReport = { id: 'r1', entityName: 'Brutăria Lina SRL', fiscalYear: 2026, locked: false, exported: false };

/** The menu item as the menu would draw it, and the dialogue behind it. */
function Harness({ report }: { readonly report: DeletableReport }) {
  const { item, dialogue } = useReportDeletion(report);
  return (
    <>
      <button type="button" disabled={item.disabled} onClick={item.onSelect}>
        {item.label}
      </button>
      {dialogue}
    </>
  );
}

const draw = (report: DeletableReport = REPORT) =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro} formats={formats} timeZone="Europe/Chisinau">
      <Harness report={report} />
    </NextIntlClientProvider>,
  );

/** UC-213's control (task 192): the item says why it cannot act, and the dialogue deletes or says why it did not. */
describe('useReportDeletion', () => {
  beforeEach(() => {
    remove.mockReset();
    push.mockReset();
  });

  it('is disabled with its reason where the period is locked or a file was exported (UX-50)', () => {
    const { unmount } = draw({ ...REPORT, locked: true });
    expect(screen.getByRole('button', { name: copy.unavailable.locked })).toBeDisabled();
    unmount();
    draw({ ...REPORT, exported: true });
    expect(screen.getByRole('button', { name: copy.unavailable.exported })).toBeDisabled();
  });

  it('names the report in the dialogue, deletes it, and lands the reader on the report list, which says so', async () => {
    remove.mockResolvedValue({ status: API_OUTCOME.Ok, value: undefined, messages: [] });
    draw();
    await userEvent.click(screen.getByRole('button', { name: copy.item }));

    const dialogue = screen.getByRole('alertdialog', { name: copy.title });
    expect(dialogue).toHaveTextContent('Raportul Brutăria Lina SRL pentru 2026');
    await userEvent.click(screen.getByRole('button', { name: copy.confirm }));

    expect(remove).toHaveBeenCalledWith({ reportId: 'r1' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/reports?deleted=report'));
  });

  it('keeps the dialogue open with the api’s words where the deletion was refused, and goes nowhere', async () => {
    remove.mockResolvedValue({
      status: API_OUTCOME.Problem,
      problem: { type: 'https://easyesg.md/problems/report-exported', status: 409, title: 'Raportul a fost exportat', detail: 'Se păstrează.' },
    });
    draw();
    await userEvent.click(screen.getByRole('button', { name: copy.item }));
    await userEvent.click(screen.getByRole('button', { name: copy.confirm }));

    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent('Raportul a fost exportat'));
    expect(push).not.toHaveBeenCalled();
  });
});
