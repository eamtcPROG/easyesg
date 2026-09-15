import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  UnsentWorkProvider,
  useReportUnsentWork,
  useUnsentWork,
  type UnsentWork,
} from './unsent-work';

/**
 * The registry (task 83.2): a reader sees nothing until a screen reports, sees what it reports, and sees
 * nothing again once that screen has gone — the last is what stops a switch made after leaving the wizard
 * from waiting on a queue no longer on screen.
 */
function Reader() {
  const { unsynced, blocked } = useUnsentWork();
  return <p>{`unsynced ${unsynced}, blocked ${blocked}`}</p>;
}

function Reporter({ work }: { readonly work: UnsentWork }) {
  useReportUnsentWork(work);
  return null;
}

const retry = vi.fn();
const QUEUED: UnsentWork = { unsynced: 2, blocked: false, retry };
const STUCK: UnsentWork = { unsynced: 2, blocked: true, retry };

describe('unsent work (task 83.2)', () => {
  it('is nothing until a screen reports some', () => {
    render(
      <UnsentWorkProvider>
        <Reader />
      </UnsentWorkProvider>,
    );

    expect(screen.getByText('unsynced 0, blocked false')).toBeInTheDocument();
  });

  it('is what the screen reports, as it changes', () => {
    const { rerender } = render(
      <UnsentWorkProvider>
        <Reporter work={QUEUED} />
        <Reader />
      </UnsentWorkProvider>,
    );
    expect(screen.getByText('unsynced 2, blocked false')).toBeInTheDocument();

    rerender(
      <UnsentWorkProvider>
        <Reporter work={STUCK} />
        <Reader />
      </UnsentWorkProvider>,
    );
    expect(screen.getByText('unsynced 2, blocked true')).toBeInTheDocument();
  });

  it('is nothing again once the reporting screen has gone', () => {
    const { rerender } = render(
      <UnsentWorkProvider>
        <Reporter work={QUEUED} />
        <Reader />
      </UnsentWorkProvider>,
    );

    rerender(
      <UnsentWorkProvider>
        <Reader />
      </UnsentWorkProvider>,
    );

    expect(screen.getByText('unsynced 0, blocked false')).toBeInTheDocument();
  });

  it('reports nowhere outside a provider, rather than failing the screen', () => {
    render(<Reporter work={QUEUED} />);
    expect(document.body).toBeInTheDocument();
  });
});
