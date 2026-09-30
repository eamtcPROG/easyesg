import { Callout, CALLOUT_INTENT, PageHeading, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { readPeriodList } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { Link } from '@/i18n/navigation';
import { PERIODS_FROM, type PeriodsFrom } from '@/lib/periods-from';
import { ROUTES } from '@/lib/routes';
import { periodsBack } from '../tools/periods-back';
import { applyPeriodView, readPeriodView, toPeriodRows } from '../tools/periods';
import { PeriodsBreadcrumb } from './periods-breadcrumb';
import { PeriodsList } from './periods-list';
import { PERIODS_MESSAGES } from './periods-messages';
import styles from './periods.module.css';

/**
 * S-14's index region: the read, the heading, and which of §8.1's arms applies (UC-56 … UC-58; cut
 * out of the route by task 134's parent-close review). **The trail names the entity** once the
 * read answers, because a period only means anything against one and an organization reporting on
 * three has three of these lists — and the arrow beside the heading **returns to where the reader
 * came from** (§11.5's Back-to-context, project owner, 30 Sep 2026): the list of entities, the
 * entity, or the new report, as the link that opened this page said, and up to the entity when
 * nothing said (`tools/periods-back.ts`). Both wait on the read, since both name what it answers;
 * a refused or failed read draws the heading alone, as S-13's record does. The screen never
 * computes the caller's role — the writes are `@RequiresRole(ORGANIZATION_ADMINISTRATOR)`, the
 * reads are open to every member.
 */
/** The arrow's name for each place it returns to — the entity's with its name, the others named as they name themselves. */
const BACK_LABEL = {
  [PERIODS_FROM.ENTITIES]: 'back.entities',
  [PERIODS_FROM.ENTITY]: 'back.entity',
  [PERIODS_FROM.NEW_REPORT]: 'back.newReport',
} as const satisfies Record<PeriodsFrom, string>;

export async function PeriodsSection({
  entityId,
  searchParams,
}: {
  readonly entityId: string;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, read, t] = await Promise.all([
    searchParams,
    readPeriodList(entityId),
    getTranslations(PERIODS_MESSAGES),
  ]);

  const view = readPeriodView(query);

  let body: ReactNode;
  if (read.status === TENANT_READ.FORBIDDEN) {
    // A choice not made is S-37's to answer, and this arm renders on every navigation (the gate says why).
    await redirectToChoiceIfOwed();
    body = (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('error.permission.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HOME}>{t('error.permission.action')}</Link>
          </TextLink>
        }
      >
        {t('error.permission.body')}
      </Callout>
    );
  } else if (read.status === TENANT_READ.UNREACHABLE) {
    body = (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('error.unreachable.title')}
        action={t('error.unreachable.action')}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  } else {
    const page = applyPeriodView({ rows: toPeriodRows(read.periods), view });
    body = <PeriodsList entityId={entityId} page={page} view={view} />;
  }

  const ready = read.status === TENANT_READ.READY;
  const back = periodsBack({ entityId, from: view.from });

  return (
    <div className={styles.screen}>
      <PageHeading
        breadcrumb={ready ? <PeriodsBreadcrumb entity={read.entity} linkComponent={Link} /> : undefined}
        back={ready ? { href: back.href, label: t(BACK_LABEL[back.to], { name: read.entity.name }) } : undefined}
        linkComponent={Link}
        title={t('title')}
        summary={t('lede')}
      />
      {body}
    </div>
  );
}
