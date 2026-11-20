import { queryOptions } from '@tanstack/react-query';
import { API_OUTCOME, type MigrationRun, type MigrationRunId, type MigrationRunRequest, type MigrationRuns, type MigrationSelectionPreview } from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';
import { runIsMoving } from '../tools/run-progress';
import { TAXONOMY_QUERY_SCOPE } from './taxonomy-console';

/**
 * A-04's migration runs (tasks 67.23, 67.7; UC-78; UX-123). **A run's read polls while the worker is moving it** and
 * stops once nothing is pending or it was reverted — every read is a logged acquisition, so a settled run is never read
 * on a timer (A-07's log, the same reason). The list is read on arrival and after each write.
 */
const RUNS_SCOPE = [...TAXONOMY_QUERY_SCOPE, 'runs'] as const;

/** How often a moving run's progress is read — the artboard's per-organization progress, not a spinner. */
const PROGRESS_POLL_MS = 3000;

export const migrationRunsQuery = () =>
  queryOptions({ queryKey: [...RUNS_SCOPE, 'list'], queryFn: () => api.get<MigrationRuns>('/admin/taxonomy/migration-runs') });

export const migrationRunQuery = (runId: string) =>
  queryOptions({
    queryKey: [...RUNS_SCOPE, 'one', runId],
    queryFn: () => api.get<MigrationRun>(`/admin/taxonomy/migration-runs/${encodeURIComponent(runId)}`),
    refetchInterval: (query) => {
      const outcome = query.state.data;
      return outcome !== undefined && outcome.status === API_OUTCOME.Ok && runIsMoving(outcome.value) ? PROGRESS_POLL_MS : false;
    },
  });

export const previewMigrationRun = (request: MigrationRunRequest) =>
  api.post<MigrationRunRequest, MigrationSelectionPreview>('/admin/taxonomy/migration-runs/preview', request);

export const startMigrationRun = (request: MigrationRunRequest) =>
  api.post<MigrationRunRequest, MigrationRunId>('/admin/taxonomy/migration-runs', request);

export const retryMigrationRun = (runId: string) =>
  api.post<undefined, MigrationRunId>(`/admin/taxonomy/migration-runs/${encodeURIComponent(runId)}/retry`, undefined);

export const revertMigrationRun = (runId: string) =>
  api.post<undefined, MigrationRunId>(`/admin/taxonomy/migration-runs/${encodeURIComponent(runId)}/reversion`, undefined);
