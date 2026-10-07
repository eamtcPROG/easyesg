'use client';

import { useState } from 'react';

/**
 * A value typed into one of a line's fields, committed when the reader leaves it, as every value in the wizard is
 * (UX-34, FR-37): no save button, nothing sent on each keystroke. **Shared by the single-line and the multi-line field**,
 * which differ in their control and nothing else (`vercel-composition-patterns`: two components over one hook rather
 * than one component switching on a `multiline` flag).
 *
 * **`onCommit` answers the refusal, or `null`**: the caller knows what its value must be — a figure that reads as a
 * number, a reason with words in it — and says so in NFR-79's three parts; this holds the draft and what was said.
 * **One value, the draft and its refusal together**, because a blur writes both and a keystroke clears the one and
 * moves the other (the root `CLAUDE.md`'s reducer rule, met by a single `useState` over one object).
 *
 * **Remounted, not resynchronised**, when the stored value changes: the caller keys the field by that value, so an
 * acknowledgement that rewrote it shows the stored text rather than a stale draft.
 */
export function useCommitDraft(input: {
  readonly value: string;
  readonly onCommit: (draft: string) => string | null;
}) {
  const [entry, setEntry] = useState<{ readonly draft: string; readonly error: string | null }>({
    draft: input.value,
    error: null,
  });
  return {
    draft: entry.draft,
    error: entry.error ?? undefined,
    edit: (draft: string) => setEntry({ draft, error: null }),
    commit: () => {
      if (entry.draft !== input.value) setEntry({ draft: entry.draft, error: input.onCommit(entry.draft) });
    },
  };
}
