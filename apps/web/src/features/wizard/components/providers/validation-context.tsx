'use client';

import type { Validation } from '@easyesg/contracts';
import type { FieldValue, Finding } from '@easyesg/validation';
import { createContext, use, useCallback, useMemo, type ReactNode } from 'react';
import type { InlineRules } from '@/server/data/validation';
import { answersHeld } from '../../tools/answers-held';
import { findingsByField } from '../../tools/findings-by-field';
import { stepFindings } from '../../tools/step-findings';
import { useAutosaveContext } from './autosave-context';

/**
 * **The open step's verdicts, live** (task 42.1; FR-40, OQ-49; `architecture.md` §12.5.6's task-42 row (1)) — the
 * interpreter run in the browser over the answers the wizard holds, merged with the last run's findings for the rules
 * the step cannot evaluate, and handed to each field by the key the queue addresses it with.
 *
 * **Inside the autosave provider, reading its state**, because what is held — served, acknowledged, unacknowledged —
 * is that reducer's, and a verdict that followed anything else would contradict the field it sits on. It recomputes
 * when the held answers move, which is a commit (a blur), never a keystroke: the reducer learns of an answer when it
 * leaves its field (UX-34).
 *
 * **A provider rather than a prop threaded to every field**, for the autosave provider's reason: several regions read
 * the same verdicts — each field now, S-08's panel and the step heading with task 42.2 — and a provider around any one
 * of them would invite the others to compute their own.
 */
export interface ValidationContextValue {
  /**
   * The last run as the validation read answered it, or `null` where the read failed — held here so S-08 reads it from
   * the provider rather than as a second copy across the client boundary (`server-dedup-props`).
   */
  readonly validation: Validation | null;
  /** The findings a field carries, most severe first — empty where none names it, and the field is OK. */
  readonly findingsOf: (key: string) => readonly Finding[];
  /**
   * Whether the answers held now no longer raise a finding the last run listed — by `findingKey` (task 42.2). S-08
   * keeps such a finding in view as cleared since the last check.
   */
  readonly isCleared: (findingKey: string) => boolean;
}

const ValidationContext = createContext<ValidationContextValue | null>(null);

const NONE: readonly Finding[] = [];

export function ValidationProvider({
  served,
  rules,
  validation,
  prior,
  children,
}: {
  /** The step's answers as the step read served them, projected on the server (`servedAnswers`). */
  readonly served: readonly FieldValue[];
  /** The rules a run would read and the report's scope, or `null` where they could not be read. */
  readonly rules: InlineRules | null;
  /** The last run as the validation read answered it, or `null` where the read failed. */
  readonly validation: Validation | null;
  /** Last year's comparable answers, for the year-over-year rule (FR-46). */
  readonly prior: readonly FieldValue[];
  readonly children: ReactNode;
}) {
  const { state } = useAutosaveContext();
  const { committed, pending } = state;

  // Expensive enough to keep off every render — the interpreter over the step's rules and rows — and it feeds a
  // context value, so it is recomputed only when what it reads moves (the rerender rule, by hand: no compiler here).
  const verdicts = useMemo(() => {
    const lastRun = validation?.findings ?? NONE;
    const stepElements = new Set(served.map((answer) => answer.elementKey));
    const values = answersHeld({ served, state: { committed, pending } });
    const step = stepFindings({ rules, stepElements, values, prior, lastRun });
    return { byField: findingsByField(step.findings), cleared: step.cleared };
  }, [served, committed, pending, rules, prior, validation]);

  const findingsOf = useCallback((key: string) => verdicts.byField.get(key) ?? NONE, [verdicts]);
  const isCleared = useCallback((findingKey: string) => verdicts.cleared.has(findingKey), [verdicts]);
  const value = useMemo<ValidationContextValue>(
    () => ({ validation, findingsOf, isCleared }),
    [validation, findingsOf, isCleared],
  );

  return <ValidationContext.Provider value={value}>{children}</ValidationContext.Provider>;
}

export function useValidationContext(): ValidationContextValue {
  const value = use(ValidationContext);
  if (value === null) {
    throw new Error('useValidationContext must be used within ValidationProvider (S-07).');
  }
  return value;
}
