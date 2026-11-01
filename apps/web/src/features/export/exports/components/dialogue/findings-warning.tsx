import type { ValidationFinding } from '@easyesg/contracts';
import { isEntityField } from '@easyesg/validation';
import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { VALIDATION_MESSAGES } from '@/features/wizard/components/shared/validation-messages';
import { fieldHref } from '@/features/wizard/tools/field-anchor';
import { findingKey } from '@/features/wizard/tools/finding-key';
import { findingWords } from '@/features/wizard/tools/finding-words';
import { Link } from '@/i18n/navigation';
import { entityFieldRoute } from '@/lib/entity-field-route';
import { reportRoute } from '@/lib/routes';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';
import styles from '../styles/exports.module.css';

/**
 * UX-25's warning (task 47.3; FR-44; 182/20): the report's unresolved findings, **listed as the api evaluated them for
 * this request** — each its field as the step names it, the same three parts S-08 shows, and the way to the field — and
 * the two ways on: export with them, which is the acknowledgement the api asks for, or fix them first. Export is never
 * silently blocked, and never proceeds without this having been shown. **A finding on the entity's IDNO, which no step
 * holds, leads to S-13's record at the field** (task 210; FR-42 behaviour 6).
 *
 * No directive: drawn inside the dialogue, a client boundary already, and it reads its own words.
 */
export function FindingsWarning({
  reportId,
  entityId,
  findings,
  busy,
  onAcknowledge,
}: {
  readonly reportId: string;
  /** The report's entity, whose record a finding on its IDNO leads to. */
  readonly entityId: string;
  readonly findings: readonly ValidationFinding[];
  /** While the acknowledging request runs: the list stays, the button waits. */
  readonly busy: boolean;
  readonly onAcknowledge: () => void;
}) {
  const t = useTranslations(EXPORTS_MESSAGES);
  const tValidation = useTranslations(VALIDATION_MESSAGES);
  const format = useFormatter();
  const count = findings.length;

  return (
    <Callout
      intent={CALLOUT_INTENT.WARNING}
      title={t('dialogue.findings.title', { count })}
      action={
        <span className={styles.commit}>
          <TextLink asChild>
            <Link href={reportRoute(reportId)}>{t('dialogue.findings.fix')}</Link>
          </TextLink>
          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={onAcknowledge} aria-disabled={busy || undefined}>
            {busy ? t('dialogue.submitting') : t('dialogue.findings.acknowledge', { count })}
          </Button>
        </span>
      }
    >
      {t('dialogue.findings.body')}
      {count === 0 ? null : (
        <ul className={styles.findings} aria-label={t('dialogue.findings.list')}>
          {findings.map((finding) => {
            // The step that presents the field — its first, as S-08 lists it.
            const step = finding.field.modules[0];
            const words = findingWords({ t: tValidation, format, finding });
            return (
              <li key={findingKey(finding)} className={styles.finding}>
                <span className={`t-body-strong ${styles.findingField}`}>{finding.field.label ?? step}</span>
                {words === null ? null : <span>{words.join(' ')}</span>}
                {step === undefined ? null : (
                  <TextLink asChild>
                    <Link
                      href={
                        isEntityField(finding.field.elementKey)
                          ? entityFieldRoute({ entityId, field: finding.field.elementKey })
                          : fieldHref({ reportId, module: step, field: finding.field })
                      }
                    >
                      {t('dialogue.findings.goToField')}
                    </Link>
                  </TextLink>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Callout>
  );
}
