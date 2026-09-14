import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import { declineSupportAccessAction, grantSupportAccessAction } from '../../../actions/actions';
import { AnswerControls } from './answer-controls';

/**
 * The banner's *Grant* and *Decline*, against stubbed actions (task 67.9).
 *
 * The browser suite drives the journey; what is pinned here is what no journey can reach without contriving a
 * race — a refusal shown as the API worded it (another administrator answered first), the bundled copy when no
 * answer arrived, and that each button sends its own verb for this request and nothing else.
 */
vi.mock('../../../actions/actions', () => ({
  grantSupportAccessAction: vi.fn(),
  declineSupportAccessAction: vi.fn(),
  endSupportAccessAction: vi.fn(),
}));

const LABELS = { grant: 'Acordați acces pentru 60 de minute', decline: 'Refuzați' };
const UNREACHABLE = {
  title: 'Răspunsul dumneavoastră nu a ajuns la EasyESG',
  body: 'Alegerea nu a putut fi înregistrată.',
};

const renderControls = () =>
  render(<AnswerControls requestId="request-1" labels={LABELS} unreachable={UNREACHABLE} />);

describe('the answer controls (task 67.9)', () => {
  beforeEach(() => {
    vi.mocked(grantSupportAccessAction).mockReset();
    vi.mocked(declineSupportAccessAction).mockReset();
  });

  it('sends the grant for this request, and adds nothing of its own once it is accepted', async () => {
    vi.mocked(grantSupportAccessAction).mockResolvedValue({
      status: API_OUTCOME.Ok,
      value: null,
      messages: [],
    });
    renderControls();

    await userEvent.click(screen.getByRole('button', { name: LABELS.grant }));

    await waitFor(() => expect(screen.getByRole('button', { name: LABELS.grant })).toBeEnabled());
    expect(grantSupportAccessAction).toHaveBeenCalledWith({ requestId: 'request-1' });
    expect(declineSupportAccessAction).not.toHaveBeenCalled();
    expect(screen.queryByText(UNREACHABLE.title)).toBeNull();
  });

  it('shows a refused answer in the API’s own words', async () => {
    vi.mocked(declineSupportAccessAction).mockResolvedValue({
      status: API_OUTCOME.Problem,
      problem: {
        type: 'https://easyesg.md/problems/conflict',
        status: 409,
        title: 'Cererea nu mai așteaptă un răspuns',
        detail: 'Un alt administrator a răspuns deja. Reîncărcați pagina pentru a vedea situația actuală.',
      },
    });
    renderControls();

    await userEvent.click(screen.getByRole('button', { name: LABELS.decline }));

    expect(await screen.findByText('Cererea nu mai așteaptă un răspuns')).toBeInTheDocument();
    expect(
      screen.getByText('Un alt administrator a răspuns deja. Reîncărcați pagina pentru a vedea situația actuală.'),
    ).toBeInTheDocument();
    expect(declineSupportAccessAction).toHaveBeenCalledWith({ requestId: 'request-1' });
  });

  it('says so in its own words when no answer arrived, and clears it when the next send starts', async () => {
    vi.mocked(grantSupportAccessAction)
      .mockResolvedValueOnce({ status: API_OUTCOME.Unreachable })
      .mockReturnValueOnce(new Promise(() => undefined));
    renderControls();

    await userEvent.click(screen.getByRole('button', { name: LABELS.grant }));
    expect(await screen.findByText(UNREACHABLE.title)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: LABELS.grant }));
    await waitFor(() => expect(screen.queryByText(UNREACHABLE.title)).toBeNull());
  });
});
