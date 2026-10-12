'use client';

import { EXPORT_FORMAT, isExportFormat, type ExportLanguage } from '@easyesg/contracts';
import { LOCALES, isLocale, type Locale } from '@easyesg/i18n';
import { BUTTON_VARIANT, Button, Callout, Panel, RadioGroup } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useReducer, useTransition } from 'react';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { requestExportAction } from '../../actions/actions';
import {
  DIALOGUE_EVENT,
  DIALOGUE_PHASE,
  acknowledgesFindings,
  dialogueReducer,
  initialDialogueState,
} from '../../tools/export-dialogue';
import { carriesNoStanding, recommendedLanguage } from '../../tools/export-languages';
import { refusedFindings } from '../../tools/refused-findings';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';
import styles from '../styles/exports.module.css';
import { ExportPending } from './export-pending';
import { FindingsWarning } from './findings-warning';
import { LanguageCaveat } from './language-caveat';

/**
 * S-11's dialogue (tasks 47.2 … 47.4; UC-42, UC-43; UX-46, UX-47; FR-44, FR-52) — the Panel archetype, non-modal, in
 * place. **Exactly two decisions**: the format and the language, the second starting from the account's export language
 * and chosen apart from the interface's, with the caveat beside a language whose labels carry no EFRAG standing.
 *
 * **The request is asked without the acknowledgement first** (§12.5.6's task-47 row (b)): a report holding unresolved
 * findings is refused with them listed, the warning draws that list, and *export with them* asks again with it. Once
 * queued, the panel watches the export (`ExportPending`). Its state is one reducer (`tools/export-dialogue.ts`).
 */
export function ExportDialogue({
  reportId,
  entityId,
  languages,
  initialLanguage,
}: {
  readonly reportId: string;
  /** The report's entity, whose record a finding on its IDNO leads to (task 210). */
  readonly entityId: string;
  readonly languages: readonly ExportLanguage[];
  readonly initialLanguage: Locale;
}) {
  const t = useTranslations(EXPORTS_MESSAGES);
  const tLocales = useTranslations('chrome.locales');
  const [state, dispatch] = useReducer(dialogueReducer, initialLanguage, initialDialogueState);
  const [, startTransition] = useTransition();
  const { phase } = state;
  const submitting = phase.kind === DIALOGUE_PHASE.SUBMITTING;

  const formats = useMemo(
    () =>
      Object.values(EXPORT_FORMAT).map((format) => ({
        value: format,
        label: t(`dialogue.formats.${format}.label`),
        description: t(`dialogue.formats.${format}.description`),
      })),
    [t],
  );
  // Each language named in itself, as every language choice in the product names it.
  const locales = useMemo(() => LOCALES.map((locale) => ({ value: locale, label: tLocales(locale) })), [tLocales]);
  const recommended = useMemo(() => recommendedLanguage(languages), [languages]);

  const submit = useCallback(() => {
    if (submitting) return;
    const acknowledged = acknowledgesFindings(phase);
    dispatch({ type: DIALOGUE_EVENT.SUBMITTED });
    startTransition(async () => {
      const outcome = await requestExportAction({
        reportId,
        request: {
          format: state.format,
          locale: state.language,
          ...(acknowledged ? { acknowledgeUnresolvedFindings: true } : {}),
        },
      });
      if (outcome.status === API_OUTCOME.Ok) {
        dispatch({ type: DIALOGUE_EVENT.QUEUED, export: outcome.value });
        return;
      }
      const findings = outcome.status === API_OUTCOME.Problem ? refusedFindings(outcome.problem) : null;
      dispatch(
        findings === null
          ? { type: DIALOGUE_EVENT.FAILED, failure: outcome }
          : { type: DIALOGUE_EVENT.REFUSED_FOR_FINDINGS, findings },
      );
    });
  }, [phase, reportId, state.format, state.language, submitting]);

  const restart = useCallback(() => dispatch({ type: DIALOGUE_EVENT.RESTARTED }), []);

  if (phase.kind === DIALOGUE_PHASE.QUEUED) {
    // Keyed by the export, so the next file's card is a fresh watch rather than the last one's.
    return <ExportPending key={phase.export.id} queued={phase.export} onRestart={restart} />;
  }

  const failure =
    phase.kind === DIALOGUE_PHASE.CHOOSING || phase.kind === DIALOGUE_PHASE.UNRESOLVED ? phase.failure : null;
  const failed =
    failure === null ? null : failureNotice({ outcome: failure, unreachable: { title: t('dialogue.unreachable.title'), body: t('dialogue.unreachable.body') } });
  const findings =
    phase.kind === DIALOGUE_PHASE.UNRESOLVED ? phase.findings : phase.kind === DIALOGUE_PHASE.SUBMITTING ? phase.findings : null;

  return (
    <Panel className={styles.panel}>
      <h2 className={`t-heading-3 ${styles.sectionTitle}`}>{t('dialogue.title')}</h2>
      <div className={styles.decisions}>
        <RadioGroup
          label={t('dialogue.format')}
          options={formats}
          value={state.format}
          onValueChange={(value) => {
            if (isExportFormat(value)) dispatch({ type: DIALOGUE_EVENT.FORMAT_CHOSEN, format: value });
          }}
        />
        <div className={styles.region}>
          <RadioGroup
            label={t('dialogue.language')}
            help={t('dialogue.languageHelp')}
            options={locales}
            value={state.language}
            onValueChange={(value) => {
              if (isLocale(value)) dispatch({ type: DIALOGUE_EVENT.LANGUAGE_CHOSEN, language: value });
            }}
          />
          {carriesNoStanding({ languages, locale: state.language }) ? <LanguageCaveat recommended={recommended} /> : null}
        </div>
      </div>
      {failed === null ? null : (
        <Callout intent={failed.intent} title={failed.title} action={failed.action}>
          {failed.body}
        </Callout>
      )}
      {findings === null ? (
        <div className={styles.commit}>
          <Button variant={BUTTON_VARIANT.PRIMARY} onClick={submit} aria-disabled={submitting || undefined}>
            {submitting ? t('dialogue.submitting') : t('dialogue.submit')}
          </Button>
        </div>
      ) : (
        <FindingsWarning
          reportId={reportId}
          entityId={entityId}
          findings={findings}
          busy={submitting}
          onAcknowledge={submit}
        />
      )}
    </Panel>
  );
}
