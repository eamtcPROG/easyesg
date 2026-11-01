import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { ReauthenticationDialogue } from './reauthentication-dialogue';

/**
 * Task 207's hand-back, on the one dialogue in `apps/web` that is opened by state and not by `packages/ui`'s two
 * (UX-113): the session ends under a field the reader is typing in, and once they are signed in again focus is back
 * in that field rather than on `body`. The stages behind the dialogue are their own specs' subject, so a button
 * stands in for them.
 */
vi.mock('./reauthentication-body', () => ({
  ReauthenticationBody: () => <button type="button">Continue</button>,
}));

/** The step behind the dialogue: a field the reader holds, and the session's end and return as the screen's state. */
function Step() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <label>
        Fuel
        <input />
      </label>
      <button type="button" onClick={() => setOpen(true)}>
        End the session
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Resume
      </button>
      <ReauthenticationDialogue
        open={open}
        account={{ id: 'a', email: 'ana@example.md', remembered: false }}
        organizationId={null}
        explanation="Your session ended."
        returnTo="/reports/r/b3"
        onResumed={() => undefined}
      />
    </>
  );
}

/** Radix hands focus back a tick after the content unmounts. */
const afterTheHandBack = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

describe('ReauthenticationDialogue', () => {
  it('returns focus to the field the reader was in when the session ended', async () => {
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <Step />
      </NextIntlClientProvider>,
    );
    const field = screen.getByLabelText('Fuel');
    field.focus();

    // The session ends while the field holds focus: the screen opens the dialogue from its own state.
    act(() => screen.getByRole('button', { name: 'End the session' }).click());
    expect(field).not.toHaveFocus();

    act(() => screen.getByRole('button', { name: 'Resume', hidden: true }).click());
    await afterTheHandBack();
    expect(field).toHaveFocus();
  });
});
