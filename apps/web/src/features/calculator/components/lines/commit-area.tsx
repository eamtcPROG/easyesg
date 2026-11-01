'use client';

import { TextArea } from '@easyesg/ui';
import type { ReactNode } from 'react';
import { useCommitDraft } from './use-commit-draft';

/** A line's few-sentence value — why there is no figure — committed on blur (`use-commit-draft.ts`). */
export function CommitArea({
  label,
  value,
  onCommit,
  help,
}: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (draft: string) => string | null;
  readonly help?: ReactNode;
}) {
  const { draft, error, edit, commit } = useCommitDraft({ value, onCommit });
  return (
    <TextArea
      label={label}
      help={help}
      value={draft}
      onChange={(event) => edit(event.currentTarget.value)}
      onBlur={commit}
      error={error}
    />
  );
}
