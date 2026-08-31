import { Button, CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { PeriodsList } from '@/features/periods/components/periods-list';
import { applyPeriodView, readPeriodView, toPeriodRows } from '@/features/periods/periods';
import styles from '@/features/periods/components/periods.module.css';
import { readPeriodList, type PeriodListRead } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES, newPeriodRoute } from '@/lib/routes';

/**
 * S-14 — Reporting periods · OA · UC-56 … UC-58 · Index
 *
 * The years an entity files against (FR-21, FR-22, FR-45, FR-66). **The heading names the entity**,
 * because a period only means anything against one and an organization reporting on three has three
 * of these lists — a heading reading only "Reporting periods" would make them indistinguishable in
 * a bookmark or a screenshot.
 *
 * **The screen never computes the caller's role**, which is S-13's and S-15's rule: the writes are
 * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` and the reads are open to every member, so this
 * renders what it is given and the record's own refusal names the boundary.
 *
 * States (§8.1): ready · empty — first use · empty — filtered · error — permission · error —
 * recoverable. The two empty states are `PeriodsList`'s, because §4.6 requires them to teach.
 */
const MESSAGES = 'organization.periods';

type Props = {
  params: Promise<{ locale: string; entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function ReportingPeriodsPage({ params, searchParams }: Props) {
  const { entityId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  const t = await getTranslations(MESSAGES);
  // Independent: the query string is in hand and the read is an API round trip, so the parse does
  // not wait on the fetch (`async-parallel`).
  const [query, read, messages] = await Promise.all([
    searchParams,
    readPeriodList(entityId),
    getMessages(),
  ]);

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

      <PeriodsScreenBody entityId={entityId} read={read} query={query} messages={messages} />
    </div>
  );
}

/** The read's three arms, as a top-level component rather than a closure — the shape
 *  `rerender-no-inline-components` names, and every other Index page makes the same move. */
async function PeriodsScreenBody({
  entityId,
  read,
  query,
  messages,
}: {
  readonly entityId: string;
  readonly read: PeriodListRead;
  readonly query: Record<string, string | string[] | undefined>;
  readonly messages: Awaited<ReturnType<typeof getMessages>>;
}) {
  const t = await getTranslations(MESSAGES);

  if (read.status === TENANT_READ.FORBIDDEN) {
    return (
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
  }

  if (read.status === TENANT_READ.UNREACHABLE) {
    return (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('error.unreachable.title')}
        action={t('error.unreachable.action')}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  }

  const view = readPeriodView(query);
  const page = applyPeriodView({ rows: toPeriodRows(read.periods), view });

  return (
    <NextIntlClientProvider
      messages={{
        organization: { periods: messages.organization.periods },
        chrome: { index: messages.chrome.index },
        forms: messages.forms,
      }}
    >
      <p className="t-caption">{read.entity.name}</p>
      <PeriodsList entityId={entityId} page={page} view={view} />
    </NextIntlClientProvider>
  );
}
