'use client';

import { TextField } from '@easyesg/ui';
import type { ReactNode } from 'react';
import { useCommitDraft } from './use-commit-draft';

/**
 * One of a line's single-line text values — its description — committed on blur (`use-commit-draft.ts`). A figure and a month
 * are `NumberField`'s since task 220, which reads them by the language's own marks.
 */
export function CommitField({
  label,
  value,
  onCommit,
  help,
}: {
  readonly label: string;
  readonly value: string;
  /** Called on blur with what was typed, when it differs from `value`. Answers the refusal to show, or `null`. */
  readonly onCommit: (draft: string) => string | null;
  readonly help?: ReactNode;
}) {
  const { draft, error, edit, commit } = useCommitDraft({ value, onCommit });
  return (
    <TextField
      label={label}
      help={help}
      value={draft}
      onChange={(event) => edit(event.currentTarget.value)}
      onBlur={commit}
      error={error}
    />
  );
}
