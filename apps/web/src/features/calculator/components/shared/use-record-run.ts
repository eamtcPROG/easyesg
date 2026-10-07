'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { reportStepRoute } from '@/lib/routes';
import { recordRunAction } from '../../actions/actions';
import { CALCULATOR_MODULE } from '../../tools/calculator-module';

/**
 * Recording a run and handing back to B3 (task 39.2; UC-33, `design_spec.md` S-09's *"exits: back to the B3 step"*) —
 * the summary's *use these figures in B3* and UX-44's *recalculate* are the same act, so they share this.
 *
 * **On success the reader lands on B3**, where the figures now stand marked as calculated: the sub-flow computes and
 * hands back, which is the row's own wording. **On a refusal it stays**, holding the outcome to show — a single value
 * nothing else moves with, so one `useState` beside the transition that says the request is out.
 */
export function useRecordRun(reportId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const record = () => {
    setFailure(null);
    startTransition(async () => {
      const outcome = await recordRunAction({ reportId });
      if (outcome.status === API_OUTCOME.Ok) {
        router.push(reportStepRoute({ reportId, module: CALCULATOR_MODULE }));
        return;
      }
      setFailure(outcome);
    });
  };

  return { record, pending, failure };
}
