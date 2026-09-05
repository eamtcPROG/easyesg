import { BUTTON_VARIANT, Button, Callout, CALLOUT_INTENT, Panel, TextLink, VersionPinIndicator } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { CreateReportForm } from '@/features/reports/components/create-report-form';
import styles from '@/features/reports/components/reports.module.css';
import { readReportCreation, type ReportCreationRead } from '@/server/data/reports';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES, entityPeriodsRoute, withQuery } from '@/lib/routes';

/**
 * Report creation · OA, RC · UC-18 · Focus-shaped (task 32.3)
 *
 * **No `S-nn`, and that is `design_spec.md` OQ-21** — raised by this task rather than settled in
 * this comment, which is where the first draft left it. §4.4 goes S-06 (Index) → S-07 (Wizard) with
 * no record screen between them, and the creation artboard in `EasyESG Reporting Core.dc.html` is
 * labelled `S-05` where its own heading says *"creating a report"* — a prototype label, not an
 * inventory entry. It is built as S-06's exit because that is where §4.6 requires the Index's empty
 * state to lead; the register row carries what is assumed meanwhile and what changes if it is wrong.
 *
 * **Both choices are links, not state.** The entity and the period ride the address, so a half-made
 * choice is something the reader can reload, share or come back to (UX-4) — and the whole screen is
 * a Server Component except the confirm. That is also what lets the period list depend on the
 * entity: `GET /periods` is scoped to one entity by design (FR-21), so the second decision cannot
 * be offered until the first is made.
 *
 * **The pins are the deliverable, not decoration.** Task 32.3 exists because *DR-4 is only checkable
 * by a user if the pin is on the screen*: the versions shown here are the chosen period's, they are
 * what the report will copy at creation (FR-66), and nothing on this screen can change them.
 *
 * **Three of the artboard's decisions, and only two are ours.** The standard is one option shown
 * rather than hidden, as it draws it. Carry-forward — *"what to bring over from VSME 2024"* — is
 * per-field in the wizard (§6.6, UX-32) and has no field on `POST /reports`; refused rather than
 * drawn inert. **Scope is not asked, and FR-177 says it should be** — its acceptance criteria read
 * *"the scope flag is settable at creation"*, so this is a recorded **deferral** and not the
 * requirement being satisfied: `architecture.md` §12.5.6's task-32.3 row carries what is assumed
 * meanwhile, what changes if it is wrong, and the fact that no task row owns the creation-surface
 * control. What FR-177 does grant is adding Comprehensive later, which is what the screen tells the
 * reader.
 */
const MESSAGES = 'organization.reports.create';

type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

const single = (
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

export default async function NewReportPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  const t = await getTranslations(MESSAGES);
  const query = await searchParams;
  const entityId = single(query, 'entity');
  const read = await readReportCreation(entityId);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
          <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
        </div>
      </header>

      <NewReportBody read={read} entityId={entityId} periodId={single(query, 'period')} />
    </div>
  );
}

/** The read's three arms, as a top-level component rather than a closure — every other screen in
 *  this app makes the same move (`rerender-no-inline-components`). */
async function NewReportBody({
  read,
  entityId,
  periodId,
}: {
  readonly read: ReportCreationRead;
  readonly entityId?: string;
  readonly periodId?: string;
}) {
  const t = await getTranslations(MESSAGES);

  if (read.status === TENANT_READ.FORBIDDEN) {
    return (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('permission.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HOME}>{t('permission.action')}</Link>
          </TextLink>
        }
      >
        {t('permission.body')}
      </Callout>
    );
  }

  if (read.status === TENANT_READ.UNREACHABLE) {
    return (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('unreachable.title')}
        action={t('unreachable.action')}
      >
        {t('unreachable.body')}
      </Callout>
    );
  }

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
          <CreateReportForm periodId={period.id} />
        </section>
      )}
    </div>
  );
}
