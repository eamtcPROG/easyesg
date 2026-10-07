'use client';

import type { CalcLine, Calculator } from '@easyesg/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { calculatorQueryKey } from './calculator-query-keys';
import { readCalculator } from './read-calculator';

/**
 * S-09's figures as a client island holds them (task 39.2): **the server's read first**, then read again each time the
 * wizard's queue has a line acknowledged — the moment the server's working figures change — so the converted and
 * emissions columns and the totals follow what the reader entered without a reload.
 *
 * **Query owns the read and nothing else** (the root `CLAUDE.md`'s server state; AD-9): what is unsent stays the
 * queue's, and the board lays it over these figures. **Forgotten on unmount** (`gcTime: 0`), so a later visit starts
 * from its own server-rendered read rather than from a cache older than it. A read that fails keeps what is shown.
 */
export function useCalculator(input: {
  readonly reportId: string;
  readonly initial: Calculator;
  /** The queue's acknowledged lines — a new object only when a flush acknowledged some (`autosave-state.ts`). */
  readonly committedLines: Readonly<Record<string, CalcLine | null>>;
}): Calculator {
  const client = useQueryClient();
  const queryKey = calculatorQueryKey(input.reportId);
  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const read = await readCalculator({ reportId: input.reportId });
      if (read === null) throw new Error('The calculator could not be read again');
      return read;
    },
    initialData: input.initial,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const { committedLines } = input;
  // Syncing with the server after an event it does not announce: an acknowledgement is the one moment the working
  // figures change. Keyed on the overlay's identity, which moves only when a flush acknowledged lines.
  useEffect(() => {
    if (Object.keys(committedLines).length === 0) return;
    void client.invalidateQueries({ queryKey: calculatorQueryKey(input.reportId) });
  }, [client, committedLines, input.reportId]);
  return data;
}
