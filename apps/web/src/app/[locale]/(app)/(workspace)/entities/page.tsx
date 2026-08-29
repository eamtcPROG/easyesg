import { Button, Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { EntitiesList } from '@/features/entities/components/entities-list';
import { applyEntityView, readEntityView } from '@/features/entities/entities';
import styles from '@/features/entities/components/entities.module.css';
import { readEntityList, type EntityListRead } from '@/server/data/entities';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES } from '@/lib/routes';

/**
 * S-13 — Entities index · OA · UC-52 … UC-55 · Index
 *
 * The legal entities that are reported on (FR-17 … FR-20). **Four of the artboard's six columns
 * belong to other tasks and are refused rather than invented**: entity IDNO and its *verified*
 * marker are FR-107's fiscal lookup on the billing account, employee count is B1 disclosure data
 * (UC-19) rather than entity master data, the periods column is task 31's, and the entitlement
 * counter above the action is task 54.2's — the same deferral S-16 recorded for seats.
 *
 * **The screen never computes the caller's role**, which is S-15's and S-16's rule: the writes are
 * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` and the reads are open to every member, so this
 * renders what it is given and the record's own refusal names the boundary.
 *
 * States (§8.1): ready · empty — first use · empty — filtered · error — permission · error —
 * recoverable. The two empty states are `EntitiesList`'s, because §4.6 requires them to teach and
 * teaching means naming this object.
 */
const MESSAGES = 'organization.entities';

type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function EntitiesIndexPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  const t = await getTranslations(MESSAGES);
  // Independent: the query string is already in hand and the read is an API round trip, so the
  // parse does not wait on the fetch (`async-parallel`).
  const [query, read, messages] = await Promise.all([searchParams, readEntityList(), getMessages()]);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
          <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
        </div>
        {read.status === TENANT_READ.READY ? (
          <Button asChild>
            <Link href={ROUTES.ENTITY_NEW}>{t('add')}</Link>
          </Button>
        ) : null}
      </header>

      <EntitiesScreenBody read={read} query={query} messages={messages} />
    </div>
  );
}

/**
 * The read's three arms, as a top-level component rather than a closure — the shape
 * `rerender-no-inline-components` names, and S-15's and S-16's pages make the same move.
 */
async function EntitiesScreenBody({
  read,
  query,
  messages,
}: {
  readonly read: EntityListRead;
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

  const view = readEntityView(query);
  const page = applyEntityView({ rows: read.rows, view });
  // Keys to words on the server, where the catalogue object can be indexed — S-04's page records
  // why a translator call cannot take a value configuration supplies.
  const legalForms: Readonly<Record<string, string>> = messages.organization.legalForms;

  return (
    <NextIntlClientProvider
      messages={{
        organization: { entities: messages.organization.entities },
        chrome: { index: messages.chrome.index },
        forms: messages.forms,
      }}
    >
      <EntitiesList page={page} view={view} legalForms={legalForms} />
    </NextIntlClientProvider>
  );
}
