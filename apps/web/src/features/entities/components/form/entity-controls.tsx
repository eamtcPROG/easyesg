'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { ReportingEntity } from '@easyesg/contracts';
import { ENTITY_RECORD_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/**
 * §5's Controls row for the record — the surface's foot bar, as the S-13 artboard draws it: whether anything is
 * unsaved, then *discard* and *save* at the end (UC-52, UC-53; 28 Sep 2026). The archive moved to the side column,
 * beside the sentence that says what it keeps (`entity-archive-panel.tsx`).
 *
 * **One save for three sections**: the artboard's own caption says the wizard autosaves and this
 * does not, because a change here rewrites what other people see inside an open report, so it
 * waits for an explicit act. `sections/` holds three groups of fields over **one** `control`, and
 * this is the only place that submits.
 *
 * It takes the record rather than a `creating` flag — the label follows from whether one exists — and `dirty` and
 * `busy` rather than `formState`, which keeps it out of react-hook-form entirely.
 */
export function EntityControls({
  entity,
  dirty,
  busy,
  onDiscardAction,
}: {
  readonly entity: ReportingEntity | null;
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly onDiscardAction: () => void;
}) {
  const t = useTranslations(ENTITY_RECORD_MESSAGES);

  return (
    <>
      {dirty ? <span className={`t-caption ${styles.unsaved}`}>{t('unsaved')}</span> : null}
      <Button
        type="button"
        variant={BUTTON_VARIANT.SECONDARY}
        disabled={!dirty || busy}
        onClick={onDiscardAction}
      >
        {t('discard')}
      </Button>
      <Button type="submit" busy={busy} disabled={!dirty}>
        {entity ? t('save') : t('create')}
      </Button>
    </>
  );
}
