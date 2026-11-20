import type { UseQueryResult } from '@tanstack/react-query';
import type { ApiOutcome } from '@easyesg/contracts';
import type { ReactNode } from 'react';
import { SessionEnded } from '~/realm/components/shared/session-ended';
import { REALM_READ } from '~/realm/tools/realm-read';
import { readTaxonomyOutcome } from '../../tools/taxonomy-read';
import { TaxonomyForbidden } from './taxonomy-forbidden';
import { TaxonomyLoading } from './taxonomy-loading';
import { TaxonomyUnavailable } from './taxonomy-unavailable';

/**
 * Any A-04 read drawn by its arm (tasks 67.6, 67.7): loading, the session ended, the permission state, a retry, or the
 * value handed to `ready`. Every region reads its own query and draws the same four failures, so the choice is one
 * component rather than a switch per region.
 */
export function TaxonomyReadArms<T>({
  query,
  ready,
}: {
  readonly query: UseQueryResult<ApiOutcome<T>>;
  readonly ready: (value: T) => ReactNode;
}) {
  if (query.data === undefined) {
    return query.isError ? <TaxonomyUnavailable onRetry={() => void query.refetch()} /> : <TaxonomyLoading />;
  }
  const read = readTaxonomyOutcome(query.data);
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
      return <SessionEnded />;
    case REALM_READ.FORBIDDEN:
      return <TaxonomyForbidden />;
    case REALM_READ.UNAVAILABLE:
      return <TaxonomyUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY:
      return ready(read.value);
  }
}
