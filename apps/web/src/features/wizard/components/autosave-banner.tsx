'use client';

import { BUTTON_VARIANT, Banner, Button, CALLOUT_INTENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { CONNECTION, FLUSH_FAILURE } from '../autosave-state';
import { useAutosaveContext } from './autosave-context';

/**
 * UX-37's standing warning: *"The user shall be warned while anything is unsynced"* (task 35.2).
 *
 * §8.3 gives the unsynced queue to the Banner — persistent, page-level — and this renders it for as
 * long as the condition holds and not a moment longer. Three conditions share the vehicle and none
 * shares wording, because each has a different *what now*:
 *
 * - **offline** — nothing to do; the queue sends itself when the connection returns (FR-38);
 * - **unreachable** — the API did not answer while online; retried on a clock, and on request;
 * - **refused** — the API answered no. The copy is `failureNotice`'s: the API's own three-part
 *   `detail` (NFR-79), falling back per member to the catalogue — the one rule for that
 *   translation, in `lib/notice.ts`, rather than a fourth hand-written copy of it. The retry is
 *   offered because the reader may have changed what was refused (a value under a period that has
 *   since been reopened).
 *
 * The count is in the sentence — *"3 changes are waiting"* — because a banner that says "changes
 * are unsynced" without saying how many leaves the reader unable to tell whether it is the one
 * they just made or the whole afternoon's.
 */
export function AutosaveBanner() {
  const t = useTranslations('organization.wizard.queue');
  const { state, unsynced, hasUnsynced, retry, durable } = useAutosaveContext();

  if (!hasUnsynced) return null;

  if (state.connection === CONNECTION.OFFLINE) {
    return (
      <Banner intent={CALLOUT_INTENT.ATTENTION} title={t('offlineTitle')} action={null}>
        {t('offlineBody', { count: unsynced })}
        {durable ? null : ` ${t('notDurable')}`}
      </Banner>
    );
  }

  if (state.failure === null) return null;

  const notice = failureNotice({
    outcome:
      state.failure.kind === FLUSH_FAILURE.REFUSED
        ? { status: API_OUTCOME.Problem, problem: state.failure.problem }
        : { status: API_OUTCOME.Unreachable },
    unreachable: {
      title: t('unreachableTitle'),
      body: t('unreachableBody', { count: unsynced }),
    },
  });

  return (
    <Banner
      intent={notice.intent}
      title={notice.title}
      action={
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={retry}>
          {t('retry')}
        </Button>
      }
    >
      {notice.body}
    </Banner>
  );
}
