'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { API_OUTCOME, type ApiFailure, type ApiOutcome } from '@/lib/api-outcome';

/**
 * One of UC-34's acts on a B3 figure, made and then shown (task 39.3): the request out, and on success the step read
 * again so the field stands as the api now holds it — calculated, overridden, explained — with **the refusal kept** where
 * there is one. Shared by the control's restore and its two forms, which are the same lifecycle over three requests.
 */
export function useFigureAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const run = (request: () => Promise<ApiOutcome<null>>, onDone?: () => void) => {
    setFailure(null);
    startTransition(async () => {
      const outcome = await request();
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      onDone?.();
      router.refresh();
    });
  };

  return { run, pending, failure };
}
