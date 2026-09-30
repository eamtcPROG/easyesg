import { Breadcrumb, type NavLinkComponent } from '@easyesg/ui';
import type { ReportingEntity } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { ENTITIES_MESSAGES } from '@/features/entities/components/shared/entity-messages';
import { ROUTES, entityPeriodsRoute, entityRoute } from '@/lib/routes';
import { PERIODS_MESSAGES } from './periods-messages';

/**
 * S-14's trail — *Reporting entities / OkFlora / Reporting periods*, and on a record *… / Reporting periods / 2026
 * period* — S-13's breadcrumb carried down the address (project owner, 30 Sep 2026: S-14 takes S-13's conventions).
 * Each step is named as the page it leads to names itself, so a step says where it lands: S-13's heading, the entity,
 * S-14's heading.
 *
 * **`record` is the one difference between the two screens**: without it this is S-14's list and its heading is the
 * current page; with it the heading is a step and the record is current. **Directive-free and not async**, so the list
 * renders it on the server with the plain link and the record inside its client form with the guarded one.
 */
export function PeriodsBreadcrumb({
  entity,
  record,
  linkComponent,
}: {
  readonly entity: Pick<ReportingEntity, 'id' | 'name'>;
  /** The record's title, when the trail ends at one period rather than at the list. */
  readonly record?: string;
  readonly linkComponent: NavLinkComponent;
}) {
  const t = useTranslations(PERIODS_MESSAGES);
  const tEntities = useTranslations(ENTITIES_MESSAGES);
  const tChrome = useTranslations('chrome.breadcrumb');

  const upToEntity = [
    { href: ROUTES.ENTITIES, label: tEntities('title') },
    { href: entityRoute(entity.id), label: entity.name },
  ];

  return (
    <Breadcrumb
      label={tChrome('label')}
      trail={record === undefined ? upToEntity : [...upToEntity, { href: entityPeriodsRoute(entity.id), label: t('title') }]}
      current={record ?? t('title')}
      linkComponent={linkComponent}
    />
  );
}
