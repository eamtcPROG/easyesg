'use client';

import { EXPORT_STATUS, type Export } from '@easyesg/contracts';
import { useEffect } from 'react';
import { useExportJob } from '@/client/exports/use-export-job';
import { useRouter } from '@/i18n/navigation';
import { ExportStatusChip } from './export-status-chip';

/**
 * **A row still being made is watched where it stands** (task 47.3; UX-46): the history is the place a reader who left
 * and came back finds their file, so a requested row reads its export every 5 s (OQ-36) — the dialogue's own card, when
 * it is open, shares the read, the key being the export's — and **once it settles the screen is drawn again**, so the
 * row gains its download from the server rather than from a copy kept here.
 */
export function WatchedStatus({ row }: { readonly row: Export }) {
  const router = useRouter();
  const watched = useExportJob(row);
  const settled = watched.status !== EXPORT_STATUS.REQUESTED;
  useEffect(() => {
    if (settled) router.refresh();
  }, [router, settled]);
  return <ExportStatusChip status={watched.status} />;
}
