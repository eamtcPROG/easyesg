import { useMutation } from '@tanstack/react-query';
import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, useDismissible } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { discloseMemberPhone } from '../../../queries/organization-members';

/**
 * One member's phone, behind *Show* (task 167; §12.5.6's task-167 row) — asked for one person at a time, because each
 * disclosure is written to the system audit log that A-08 reads. **The number is held here and nowhere else**: not in
 * the query cache, not in the address, so closing the record forgets it. A person who gave none is said to have.
 */
export function MemberPhone({
  organizationId,
  accountId,
  hasPhone,
}: {
  readonly organizationId: string;
  readonly accountId: string;
  readonly hasPhone: boolean;
}) {
  const t = useTranslations('platform.organizations.record.members');
  const [phone, setPhone] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  // A refusal leaves after a while, or when closed (design_spec.md §8.1, 28 Sep 2026); the next attempt's is a new
  // object and shows again.
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const { mutate: disclose, isPending } = useMutation({
    mutationFn: discloseMemberPhone,
    onSuccess: (outcome) => {
      if (outcome.status === API_OUTCOME.Ok) setPhone(outcome.value.phone);
      else setFailure(outcome);
    },
  });

  if (!hasPhone) return <span className="text-[var(--text-muted)]">{t('noPhone')}</span>;
  if (phone !== null) {
    return (
      <a className="t-body" href={`tel:${phone}`} translate="no">
        {phone}
      </a>
    );
  }
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <div>
        <Button
          type="button"
          variant={BUTTON_VARIANT.SECONDARY}
          busy={isPending}
          onClick={() => {
            setFailure(null);
            disclose({ organizationId, accountId });
          }}
        >
          {t('show')}
        </Button>
      </div>
      {shownFailure === null ? null : (
        <ExpiringRefusal
          failure={shownFailure}
          title={t('problemTitle')}
          fallback={t('problemBody')}
          onDismiss={dismissFailure}
        />
      )}
    </div>
  );
}
