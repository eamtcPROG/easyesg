'use client';

import { Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { ApiFailure } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { REFUSAL_ABOUT, type RefusalAbout } from '../../tools/refusal-about';
import { CALCULATOR_MESSAGES } from './calculator-messages';

/**
 * A request the api would not carry out, said where it was asked for (tasks 39.2, 39.3): a run — the summary's *use
 * these figures in B3* and UX-44's *recalculate* — or one of UC-34's acts on a B3 figure. **The api's own three parts, as
 * received** (NFR-79) — a line the set no longer covers, a locked period, a figure no run produced — with the screen's
 * words only for an answer that never arrived, which differ by what was asked.
 */
export function RequestRefusal({ failure, about }: { readonly failure: ApiFailure; readonly about: RefusalAbout }) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.refusal`);
  const unreachable =
    about === REFUSAL_ABOUT.RUN
      ? { title: t('run.title'), body: t('run.body') }
      : { title: t('figure.title'), body: t('figure.body') };
  const notice = failureNotice({ outcome: failure, unreachable });
  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
