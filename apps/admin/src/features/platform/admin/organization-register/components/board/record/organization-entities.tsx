import { useQuery } from '@tanstack/react-query';
import { API_OUTCOME } from '@easyesg/contracts';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { organizationEntitiesQuery } from '../../../queries/organization-entities';

/**
 * The organization's reporting entities, in its record (task 175; `design_spec.md` A-02) — each company it reports
 * for, with the IDNO it holds and whether it is archived. The IDNO is each entity's (FR-16 as amended), and the
 * register's row shows one; this is where support tells apart the company a caller names. **Master data, not content**
 * (FR-77, D-5): no site, boundary or period reaches it, so the boundary callout beside it stays true.
 */
export function OrganizationEntities({ organizationId }: { readonly organizationId: string }) {
  const t = useTranslations('platform.organizations.record.entityList');
  const { data } = useQuery(organizationEntitiesQuery(organizationId));

  let body;
  if (data === undefined) {
    body = <p className="t-body text-[var(--text-muted)]">{t('loading')}</p>;
  } else if (data.status !== API_OUTCOME.Ok) {
    body = <RefusalCallout failure={data} title={t('unavailableTitle')} fallback={t('unavailableBody')} />;
  } else if (data.value.items.length === 0) {
    body = <p className="t-body text-[var(--text-muted)]">{t('none')}</p>;
  } else {
    body = (
      <ul className="flex flex-col gap-[var(--space-3)]">
        {data.value.items.map((entity) => (
          <li key={entity.id} className="t-body flex flex-col gap-[var(--space-1)]">
            <span className="t-body-strong">{entity.name}</span>
            {entity.idno === null ? (
              <span className="text-[var(--text-muted)]">{t('noIdno')}</span>
            ) : (
              <span className="t-numeric" translate="no">
                {t('idno', { idno: entity.idno })}
              </span>
            )}
            <span className="t-caption text-[var(--text-muted)]">{t(`status.${entity.status}`)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="organization-entities" className="flex flex-col gap-[var(--space-3)]">
      <h3 id="organization-entities" className="t-label">
        {t('heading')}
      </h3>
      {body}
    </section>
  );
}
