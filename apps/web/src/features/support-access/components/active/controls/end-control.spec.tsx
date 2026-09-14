import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import { endSupportAccessAction } from '../../../actions/actions';
import { EndControl } from './end-control';

/**
 * *End access now*, against a stubbed action (task 67.9). The refusal and the unreachable copy are the shared
 * hook's, pinned in `answer-controls.spec.tsx`; this pins that the control ends this request, and that a refusal
 * — the 60 minutes ran out between the render and the click — is shown rather than swallowed.
 */
vi.mock('../../../actions/actions', () => ({
  grantSupportAccessAction: vi.fn(),
  declineSupportAccessAction: vi.fn(),
  endSupportAccessAction: vi.fn(),
}));

describe('the end control (task 67.9)', () => {
  it('ends this request, and shows a refusal as the API worded it', async () => {
    vi.mocked(endSupportAccessAction).mockResolvedValue({
      status: API_OUTCOME.Problem,
      problem: {
        type: 'https://easyesg.md/problems/conflict',
        status: 409,
        title: 'Accesul nu mai este în curs',
        detail: 'Cele 60 de minute s-au încheiat deja.',
      },
    });
    render(
      <EndControl
        requestId="request-7"
        label="Încheiați accesul acum"
        unreachable={{ title: 'Nu a ajuns', body: 'Încercați din nou.' }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Încheiați accesul acum' }));

    expect(await screen.findByText('Accesul nu mai este în curs')).toBeInTheDocument();
    await waitFor(() => expect(endSupportAccessAction).toHaveBeenCalledWith({ requestId: 'request-7' }));
  });
});
