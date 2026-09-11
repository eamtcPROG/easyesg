import { BUTTON_VARIANT, Button, Callout, CALLOUT_INTENT, Panel, VersionPinIndicator, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { ReportCreationRead } from '@/server/data/reports';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { ROUTES, entityPeriodsRoute, withQuery } from '@/lib/routes';
import { CreateReportForm } from './create-report-form';
import { REPORT_CREATION_MESSAGES } from './report-creation-messages';
import styles from './reports.module.css';

/** The read once it answered: the section narrows it and this part takes the narrowed shape. */
type ReadyCreation = Extract<ReportCreationRead, { readonly status: typeof TENANT_READ.READY }>;

/**
 * The ready arm — the standard, the entity, the period and the pins, as the artboard draws them.
 *
 * **Both choices are links, not state.** The entity and the period ride the address, so a half-made
 * choice is something the reader can reload, share or come back to (UX-4) — and the whole part is a
 * Server Component except the confirm. That is also what lets the period list depend on the entity:
 * `GET /periods` is scoped to one entity by design (FR-21), so the second decision cannot be offered
 * until the first is made. **The pins are the deliverable, not decoration** — they are the chosen
 * period's, what the report will copy at creation (FR-66), and nothing here can change them.
 */
export async function NewReportDecisions({
  read,
  entityId,
  periodId,
}: {
  readonly read: ReadyCreation;
  readonly entityId?: string;
  readonly periodId?: string;
}) {
  const t = await getTranslations(REPORT_CREATION_MESSAGES);

  // The chosen period, re-found in the read rather than trusted from the address: an id that names
  // nothing — a stale link, a period that gained a report since — must not reach the write.
  const period = read.periods.find((candidate) => candidate.id === periodId);

  return (
    <div className={styles.decisions}>
      <section className={styles.decision}>
        <h2 className={`t-heading-3 ${styles.decisionTitle}`}>{t('standard.title')}</h2>
        {/* One option, shown rather than hidden — the artboard's own anatomy note. A select with a
            single member would ask the reader to make a choice that does not exist. */}
        <Panel>
          <p className="t-body-strong">{t('standard.value')}</p>
          <p className={`t-caption ${styles.decisionHint}`}>{t('standard.hint')}</p>
        </Panel>
      </section>

      <section className={styles.decision}>
        <h2 className={`t-heading-3 ${styles.decisionTitle}`}>{t('entity.title')}</h2>
        <p className={`t-body ${styles.decisionHint}`}>{t('entity.hint')}</p>
        {read.entities.length === 0 ? (
          /* Three parts, which §11.5 requires of everything in Feedback: what happened, the
             consequence, and the way out. The first draft folded the first two into the title and
             passed `null` for the body — which compiles, since `children` is a `ReactNode`, and
             leaves the reader the "so what" to infer. */
          <Callout
            intent={CALLOUT_INTENT.ATTENTION}
            title={t('entity.noneTitle')}
            action={
              <TextLink asChild>
                <Link href={ROUTES.ENTITY_NEW}>{t('entity.noneAction')}</Link>
              </TextLink>
            }
          >
            {t('entity.noneBody')}
          </Callout>
        ) : (
          <div className={styles.periods}>
            {read.entities.map((entity) => (
              <Button
                key={entity.id}
                asChild
                variant={entity.id === entityId ? BUTTON_VARIANT.PRIMARY : BUTTON_VARIANT.SECONDARY}
              >
                {/* Choosing an entity clears the period: a period id belongs to the entity it was
                    chosen under, and carrying it across would name a row this list cannot show. */}
                <Link href={withQuery(ROUTES.REPORT_NEW, `entity=${encodeURIComponent(entity.id)}`)}>
                  {entity.name}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </section>

      {entityId === undefined || read.entities.length === 0 ? null : (
        <section className={styles.decision}>
          <h2 className={`t-heading-3 ${styles.decisionTitle}`}>{t('period.title')}</h2>
          <p className={`t-body ${styles.decisionHint}`}>{t('period.hint')}</p>
          {read.periods.length === 0 ? (
            <Callout
              intent={CALLOUT_INTENT.ATTENTION}
              title={t('period.noneTitle')}
              action={
                <TextLink asChild>
                  <Link href={entityPeriodsRoute(entityId)}>{t('period.noneAction')}</Link>
                </TextLink>
              }
            >
              {t('period.noneBody')}
            </Callout>
          ) : (
            <div className={styles.periods}>
              {read.periods.map((candidate) => (
                <Button
                  key={candidate.id}
                  asChild
                  variant={
                    candidate.id === periodId ? BUTTON_VARIANT.PRIMARY : BUTTON_VARIANT.SECONDARY
                  }
                >
                  {/* The year as buttons rather than a picker, which is the artboard's own anatomy
                      note: a handful of open periods is a set to see, not a list to search. */}
                  <Link
                    href={withQuery(
                      ROUTES.REPORT_NEW,
                      `entity=${encodeURIComponent(entityId)}&period=${encodeURIComponent(candidate.id)}`,
                    )}
                  >
                    {candidate.fiscalYear}
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </section>
      )}

      {period === undefined ? null : (
        <section className={styles.decision}>
          <h2 className={`t-heading-3 ${styles.decisionTitle}`}>{t('pins.title')}</h2>
          <p className={`t-body ${styles.decisionHint}`}>{t('pins.hint')}</p>
          <div className={styles.pins}>
            {/* Task 32.3's deliverable, literally: DR-4's pin on the screen before the report is
                created, so the reader can check it rather than infer it. No standing is claimed —
                nothing yet tells a screen a version has been superseded (task 33.3). */}
            <VersionPinIndicator label={t('pins.template')} version={period.templateVersion} />
            <VersionPinIndicator label={t('pins.taxonomy')} version={period.taxonomyVersion} />
          </div>
          <p className={`t-numeric ${styles.decisionHint}`}>
            {t('period.value', { start: period.periodStart.date, end: period.periodEnd.date })}
          </p>
          <p className={`t-caption ${styles.decisionHint}`}>{t('comprehensive')}</p>
          {/* Its own provider since task 99 — see `i18n/client-messages.ts`. */}
          <CreateReportForm periodId={period.id} />
        </section>
      )}
    </div>
  );
}
