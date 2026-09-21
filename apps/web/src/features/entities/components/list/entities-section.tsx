import { Button, Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { readEntityList } from '@/server/data/entities';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToSignIn } from '@/server/session/sign-in-redirect';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { applyEntityView, readEntityView } from '../../tools/entities';
import { ENTITIES_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';
import { EntitiesList } from './entities-list';

/**
 * S-13's index region: the reads, the header, and which of §8.1's arms applies (UC-52 … UC-55; cut
 * out of the route by task 134's parent-close review). The query string is in hand and the read is
 * an API round trip, so they run together (`async-parallel`). **The screen never computes the
 * caller's role** — the writes are `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` and the reads are
 * open to every member, so this renders what it is given and the record's own refusal names the
 * boundary. Legal-form keys are resolved to words here, where the catalogue object can be indexed
 * — S-04's page records why a translator call cannot take a value configuration supplies.
 */
export async function EntitiesSection({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, read, messages, t] = await Promise.all([
    searchParams,
    readEntityList(),
    getMessages(),
    getTranslations(ENTITIES_MESSAGES),
  ]);

  // Task 160: the api has ended the session this browser still names — sign in, and back here.
  if (read.status === TENANT_READ.SIGNED_OUT) return redirectToSignIn();

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
    const view = readEntityView(query);
    const page = applyEntityView({ rows: read.rows, view });
    const legalForms: Readonly<Record<string, string>> = messages.organization.legalForms;
    body = <EntitiesList page={page} view={view} legalForms={legalForms} />;
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
            <Link href={ROUTES.ENTITY_NEW}>{t('add')}</Link>
          </Button>
        ) : null}
      </header>
      {body}
    </div>
  );
}
