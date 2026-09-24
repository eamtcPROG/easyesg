'use client';

import { BUTTON_VARIANT, Button, STATUS_TONE, StatusChip, type ButtonVariant } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { SECTION_READ } from '../../tools/credentials';
import {
  CREDENTIALS_SECTION,
  CREDENTIALS_STAGE,
  stageSection,
  type CredentialsStage,
  type OpenableStage,
} from '../../tools/credentials-state';
import { CredentialRow, rowBodyId } from '../shared/credential-row';
import { FACTOR_MESSAGES } from '../shared/credentials-messages';
import { useCredentials } from '../shared/credentials-context';
import { SectionUnavailable } from '../shared/section-unavailable';
import { FactorExhausted } from './factor-exhausted';
import { FactorStep } from './factor-step';

/**
 * S-28's second factor — UC-193, as a row (task 169; OQ-19 closed): *Two-step verification*, its chip, and *Turn on*;
 * once on, *New recovery codes* and *Turn off*. The artboard draws the row at rest and off; the on state's two
 * triggers are the two actions §5 names for an enrolled factor, and each opens the row at its own step.
 *
 * **Every step is the screen's `stage`, not this component's**, because the codes arrive from a re-issue as well as
 * from enrolment and must look identical, and because one open row across the record is what the reducer guarantees.
 */
export function FactorRow() {
  const t = useTranslations(FACTOR_MESSAGES);
  const { read, stage, open, dismiss } = useCredentials();
  const id = CREDENTIALS_SECTION.FACTOR;

  if (read.factor.status !== SECTION_READ.READY) {
    return (
      <CredentialRow id={id} heading={t('heading')}>
        <SectionUnavailable />
      </CredentialRow>
    );
  }

  const factor = read.factor.value;
  const isOpen = stageSection(stage) === id;
  // With no codes left the warning carries the re-issue, and a second identical button beside it would ask the reader
  // which to trust (29 Aug 2026) — so the trigger steps aside while the warning stands.
  const exhausted = factor.enrolled && factor.recoveryCodesRemaining === 0;
  // The codes are shown once, so while they are on screen no trigger here may close them — only putting them away.
  const showingCodes = stage.kind === CREDENTIALS_STAGE.SHOWING_CODES;
  /**
   * A trigger opens its first step and stays expanded through the steps that follow from it; pressed while expanded
   * it closes the row. `steps` is that family — *Turn on* is also the enrolment's second step.
   */
  const trigger = (input: {
    readonly step: OpenableStage;
    readonly steps: readonly CredentialsStage[];
    readonly label: string;
    readonly variant: ButtonVariant;
  }) => {
    const expanded = input.steps.includes(stage.kind);
    return (
      <Button
        type="button"
        variant={input.variant}
        disabled={showingCodes}
        aria-expanded={expanded}
        aria-controls={rowBodyId(id)}
        onClick={() => (expanded ? dismiss() : open(input.step))}
      >
        {input.label}
      </Button>
    );
  };

  return (
    <CredentialRow
      id={id}
      heading={t('heading')}
      status={
        factor.enrolled ? (
          <StatusChip tone={STATUS_TONE.POSITIVE}>{t('statusOn')}</StatusChip>
        ) : (
          <StatusChip tone={STATUS_TONE.ATTENTION}>{t('statusOff')}</StatusChip>
        )
      }
      description={
        factor.enrolled ? t('remaining', { remaining: factor.recoveryCodesRemaining }) : t('description')
      }
      triggers={
        factor.enrolled ? (
          <>
            {exhausted
              ? null
              : trigger({
                  step: { kind: CREDENTIALS_STAGE.REISSUING_CODES },
                  steps: [CREDENTIALS_STAGE.REISSUING_CODES, CREDENTIALS_STAGE.SHOWING_CODES],
                  label: t('reissue'),
                  variant: BUTTON_VARIANT.SECONDARY,
                })}
            {trigger({
              step: { kind: CREDENTIALS_STAGE.DISABLING_FACTOR },
              steps: [CREDENTIALS_STAGE.DISABLING_FACTOR],
              label: t('disable'),
              variant: BUTTON_VARIANT.SECONDARY,
            })}
          </>
        ) : (
          trigger({
            step: { kind: CREDENTIALS_STAGE.BEGINNING_ENROLMENT },
            steps: [CREDENTIALS_STAGE.BEGINNING_ENROLMENT, CREDENTIALS_STAGE.ENROLLING],
            label: t('enable'),
            variant: BUTTON_VARIANT.PRIMARY,
          })
        )
      }
    >
      {isOpen ? (
        <FactorStep />
      ) : exhausted ? (
        // Zero codes on an enrolled account is a designed state (UC-195) and the one moment it can still be fixed, so
        // it stands in the row at rest, carrying the fix.
        <FactorExhausted onReissue={() => open({ kind: CREDENTIALS_STAGE.REISSUING_CODES })} />
      ) : null}
    </CredentialRow>
  );
}
