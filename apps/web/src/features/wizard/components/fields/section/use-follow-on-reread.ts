'use client';

import type { DisclosureField } from '@easyesg/contracts';
import { useRouter } from '@/i18n/navigation';
import { useEffect, useMemo, useRef, useTransition } from 'react';
import { driverAnswersKey } from '../../../tools/driver-answers';
import { useAutosaveContext } from '../../providers/autosave-context';

/**
 * Read the step again once a follow-on's question is answered and stored (task 80.1; `architecture.md` §12.5.6's task-80.1
 * row (2)) — so B4's URL appears under its *publicly available* yes, and C7's follow-ons under an incident's, as the
 * reporter answers. **The verdict stays the api's**: the browser re-reads rather than re-evaluating, one rule in one place.
 *
 * **From the first change after the step arrived**, never on arrival: the answers already acknowledged when the step
 * mounts are what it was read with, so reading it again would change nothing. An effect, because the moment is the
 * acknowledgement autosave's queue receives, not an event this component handles.
 */
export function useFollowOnReread(fields: readonly DisclosureField[]): void {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { state } = useAutosaveContext();
  const drivers = useMemo(
    () => new Set(fields.filter((field) => field.drivesApplicability).map((field) => field.elementKey)),
    [fields],
  );
  const key = driverAnswersKey({ committed: state.committed, drivers });
  const read = useRef(key);

  useEffect(() => {
    if (key === read.current) return;
    read.current = key;
    startTransition(() => router.refresh());
  }, [key, router]);
}
