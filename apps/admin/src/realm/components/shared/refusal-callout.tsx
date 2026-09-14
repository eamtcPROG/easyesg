import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';
import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A write the api did not carry out, drawn as the api said it (tasks 67.4) — A-20's steps and A-08's
 * invitation form and notice read this. **The api's `detail` is the whole of NFR-79's *what now***, so
 * the action slot stays empty for a refusal, the rule A-01 records; an api that could not be reached
 * has no sentence of its own, and gets the realm's.
 */
export function RefusalCallout({
  failure,
  title,
  fallback,
}: {
  readonly failure: ApiFailure;
  /** Used where the problem document carries no title of its own. */
  readonly title: string;
  /** Used where it carries no detail. */
  readonly fallback: string;
}) {
  const t = useTranslations('realm.unreachable');

  if (failure.status === API_OUTCOME.Problem) {
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={failure.problem.title ?? title} action={null}>
        {failure.problem.detail ?? fallback}
      </Callout>
    );
  }

  return (
    <Callout intent={CALLOUT_INTENT.ERROR} title={t('title')} action={t('action')}>
      {t('body')}
    </Callout>
  );
}
