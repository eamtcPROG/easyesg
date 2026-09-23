import { useQuery } from '@tanstack/react-query';
import { API_OUTCOME } from '@easyesg/contracts';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { organizationMembersQuery } from '../../../queries/organization-members';
import { MEMBER_ROLE_LABEL } from '../../../tools/member-role-labels';
import { MemberPhone } from './member-phone';

/**
 * The organization's people, in its record (task 167; §12.5.6's task-167 row, `design_spec.md` A-02) — who each account
 * belongs to and how support reaches them: name, sign-in address, role, and a phone where one was given, one reveal at
 * a time. **Contact data, not content**: nothing here is what an organization reports (FR-77, D-5), which is why the
 * boundary callout beside it stays true.
 */
export function OrganizationMembers({ organizationId }: { readonly organizationId: string }) {
  const t = useTranslations('platform.organizations.record.members');
  const { data } = useQuery(organizationMembersQuery(organizationId));

  let body;
  if (data === undefined) {
    body = <p className="t-body text-[var(--text-muted)]">{t('loading')}</p>;
  } else if (data.status !== API_OUTCOME.Ok) {
    body = <RefusalCallout failure={data} title={t('unavailableTitle')} fallback={t('unavailableBody')} />;
  } else if (data.value.items.length === 0) {
    body = <p className="t-body text-[var(--text-muted)]">{t('none')}</p>;
  } else {
    body = (
      <ul className="flex flex-col gap-[var(--space-4)]">
        {data.value.items.map((member) => (
          <li key={member.accountId} className="t-body flex flex-col gap-[var(--space-1)]">
            <span className="t-body-strong">{member.displayName}</span>
            <span className="text-[var(--text-muted)]" translate="no">
              {member.email}
            </span>
            <span className="t-caption text-[var(--text-muted)]">{t(`roles.${MEMBER_ROLE_LABEL[member.role]}`)}</span>
            <MemberPhone organizationId={organizationId} accountId={member.accountId} hasPhone={member.hasPhone} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="organization-members" className="flex flex-col gap-[var(--space-3)]">
      <h3 id="organization-members" className="t-label">
        {t('heading')}
      </h3>
      {body}
    </section>
  );
}
