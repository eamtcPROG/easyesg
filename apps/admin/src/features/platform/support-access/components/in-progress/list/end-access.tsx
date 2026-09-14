import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { SUPPORT_ACCESS_QUERY_KEY, endSupportAccess } from '../../../queries/support-access';
import type { GrantScope } from '../../../tools/support-access-search';

/**
 * *End access* on a running grant (task 67.9) — any Platform Administrator's, on any grant. **No confirmation**:
 * ending takes nothing from the organization and nothing from the record; the operator who asked can ask again,
 * with a new reason. On success the log is re-read and the grant leaves what is in progress.
 */
export function EndAccess({ grant }: { readonly grant: GrantScope }) {
  const t = useTranslations('platform.supportAccess.inProgress');
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const { mutate: end, isPending } = useMutation({
    mutationFn: endSupportAccess,
    onSuccess: (outcome) => {
      if (outcome.status === API_OUTCOME.Ok) void queryClient.invalidateQueries({ queryKey: SUPPORT_ACCESS_QUERY_KEY });
      else setFailure(outcome);
    },
  });

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <Button
        type="button"
        variant={BUTTON_VARIANT.SECONDARY}
        busy={isPending}
        onClick={() => {
          setFailure(null);
          end(grant);
        }}
      >
        {t('end')}
      </Button>
      {failure === null ? null : (
        <RefusalCallout failure={failure} title={t('endProblemTitle')} fallback={t('endProblemTitle')} />
      )}
    </div>
  );
}
