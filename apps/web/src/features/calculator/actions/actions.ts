'use server';

import type { CalcRun } from '@easyesg/contracts';
import { mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';

/**
 * *Use these figures in B3* — UC-33's run (task 39.2; FR-34, FR-35): `POST /reports/{id}/calculator/runs`, which
 * retains every line, pins the set in force for the period, and writes Scope 1 and location-based Scope 2 into B3.
 *
 * **A Server Action, not the queue** (§12.5.6's task-39 row (2)): a run is not idempotent and its figures are the
 * server's, so it is a direct request made while the reader watches, and the summary disables it offline and while a
 * line is still unsent. **Nothing is revalidated**: the reader is sent on to B3, whose step is read fresh, and S-09 is
 * read fresh on its next visit. The refusal travels as the api composed it (NFR-79).
 */
export async function recordRunAction(input: { readonly reportId: string }): Promise<ApiOutcome<null>> {
  const outcome = await api.post<undefined, CalcRun>(`/reports/${input.reportId}/calculator/runs`, undefined);
  return mapOutcome(outcome, () => null);
}

/**
 * UC-34's three acts on a B3 figure a run computed (task 39.3; FR-36, UX-43), each a direct request (§12.5.6's task-39
 * row (2)) the reader confirms against the figure in front of them: **replace** it with their own tonnes and a reason,
 * **restore** the computed figure, or **explain** it with a note. The api holds the rules — a reason required, only the
 * two scopes, only a figure a run produced — and its refusal travels as it composed it. **Nothing is revalidated**: the
 * control refreshes the step it sits on, which is read fresh.
 */
export async function overrideFigureAction(input: {
  readonly reportId: string;
  readonly elementKey: string;
  readonly valueNumeric: string;
  readonly explanation: string;
}): Promise<ApiOutcome<null>> {
  const outcome = await api.put<{ valueNumeric: string; explanation: string }, undefined>(
    `/reports/${input.reportId}/calculator/figures/${encodeURIComponent(input.elementKey)}/override`,
    { valueNumeric: input.valueNumeric, explanation: input.explanation },
  );
  return mapOutcome(outcome, () => null);
}

export async function restoreFigureAction(input: {
  readonly reportId: string;
  readonly elementKey: string;
}): Promise<ApiOutcome<null>> {
  const outcome = await api.delete(
    `/reports/${input.reportId}/calculator/figures/${encodeURIComponent(input.elementKey)}/override`,
  );
  return mapOutcome(outcome, () => null);
}

export async function explainFigureAction(input: {
  readonly reportId: string;
  readonly elementKey: string;
  /** The note, or `null` to remove it. */
  readonly explanation: string | null;
}): Promise<ApiOutcome<null>> {
  const outcome = await api.put<{ explanation: string | null }, undefined>(
    `/reports/${input.reportId}/calculator/figures/${encodeURIComponent(input.elementKey)}/explanation`,
    { explanation: input.explanation },
  );
  return mapOutcome(outcome, () => null);
}
