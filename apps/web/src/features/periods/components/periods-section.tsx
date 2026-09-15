import { Button, Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { readPeriodList } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { Link } from '@/i18n/navigation';
import { ROUTES, newPeriodRoute } from '@/lib/routes';
import { applyPeriodView, readPeriodView, toPeriodRows } from '../tools/periods';
import { PeriodsList } from './periods-list';
import { PERIODS_MESSAGES } from './periods-messages';
import styles from './periods.module.css';

/**
 * S-14's index region: the read, the header, and which of §8.1's arms applies (UC-56 … UC-58; cut
 * out of the route by task 134's parent-close review). **The heading names the entity** once the
 * read answers, because a period only means anything against one and an organization reporting on
 * three has three of these lists. The screen never computes the caller's role — the writes are
 * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)`, the reads are open to every member.
 */
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
    const view = readPeriodView(query);
    const page = applyPeriodView({ rows: toPeriodRows(read.periods), view });
    body = (
      <>
        <p className="t-caption">{read.entity.name}</p>
        <PeriodsList entityId={entityId} page={page} view={view} />
      </>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
          <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
        </div>
        {read.status === TENANT_READ.READY ? (
          <Button asChild>
            <Link href={newPeriodRoute(entityId)}>{t('open')}</Link>
          </Button>
        ) : null}
      </header>
      {body}
    </div>
  );
}
