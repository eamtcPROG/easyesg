'use client';

import { TextField } from '@easyesg/ui';
import type { ReactNode } from 'react';
import { useCommitDraft } from './use-commit-draft';

/**
 * One of a line's single-line values — a figure, a month, its name — committed on blur (`use-commit-draft.ts`).
 * `inputMode` passes through, so a figure asks a phone for the decimal keypad (S-09's narrow frames).
 */
export function CommitField({
  label,
  value,
  onCommit,
  help,
  inputMode,
  labelHidden = false,
}: {
  readonly label: string;
  readonly value: string;
  /** Called on blur with what was typed, when it differs from `value`. Answers the refusal to show, or `null`. */
  readonly onCommit: (draft: string) => string | null;
  readonly help?: ReactNode;
  readonly inputMode?: 'decimal';
  readonly labelHidden?: boolean;
}) {
  const { draft, error, edit, commit } = useCommitDraft({ value, onCommit });
  return (
    <TextField
      label={label}
      labelHidden={labelHidden}
      help={help}
      inputMode={inputMode}
      value={draft}
      onChange={(event) => edit(event.currentTarget.value)}
      onBlur={commit}
      error={error}
    />
  );
}
