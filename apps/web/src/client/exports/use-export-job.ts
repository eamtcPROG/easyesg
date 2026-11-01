'use client';

import type { Export } from '@easyesg/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nextExportPoll, settleExportJob, type ExportJobState } from './export-job-state';
import { readExport } from './read-export';

/** One export's key — under a scope of its own, so nothing else's invalidation reaches it. */
const exportJobQueryKey = (exportId: string) => ['exports', exportId] as const;

/**
 * One export, watched while its file is produced (task 47.3; FR-49, UX-46) — **from the record the request answered**,
 * so the card draws at once, then read every 5 s through the pass-through until it settles, and stopped while the tab
 * is hidden (OQ-36). The reader may leave the screen: the job does not depend on this, and past 30 s the person who
 * asked is told by a notice (`architecture.md` §12.5.6's task-47 row (5)).
 */
export function useExportJob(queued: Export): Export {
  const client = useQueryClient();
  const queryKey = exportJobQueryKey(queued.id);
  const { data } = useQuery({
    queryKey,
    queryFn: async (): Promise<ExportJobState> =>
      settleExportJob({
        // What the last poll left, or the record the request answered — a failed read keeps it rather than blanking it.
        previous: client.getQueryData<ExportJobState>(queryKey) ?? { export: queued, failures: 0 },
        read: await readExport({ exportId: queued.id }),
      }),
    initialData: { export: queued, failures: 0 },
    refetchInterval: (query) => (query.state.data === undefined ? false : nextExportPoll(query.state.data)),
    refetchIntervalInBackground: false,
  });
  return data.export;
}
