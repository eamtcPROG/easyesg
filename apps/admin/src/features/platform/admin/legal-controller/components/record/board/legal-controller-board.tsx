import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type LegalControllerRecord, type PublishLegalControllerRequest } from '@easyesg/contracts';
import { useCallback, useId, useReducer } from 'react';
import { useTranslations } from 'use-intl';
import { LEGAL_CONTROLLER_QUERY_KEY, publishLegalController } from '../../../queries/legal-controller';
import {
  INITIAL_LEGAL_CONTROLLER_SAVE_STATE,
  LEGAL_CONTROLLER_SAVE_EVENT,
  legalControllerSaveReducer,
} from '../../../tools/legal-controller-save-state';
import { LegalControllerNotice } from '../notice/legal-controller-notice';
import { LegalControllerAttribution } from './legal-controller-attribution';
import { LegalControllerForm } from './legal-controller-form';

/**
 * A-21's record, ready (task 75; FR-205) — §4.6's Record: the identity header, the notice, the change attribution and
 * the one group of fields with its explicit save.
 *
 * **Every answer invalidates the record**, the refusals included: a save refused because a colleague saved first must
 * redraw the form with the values now in force, which is what the conflict notice tells the operator they are looking
 * at. **The form is keyed by the revision it opened on**, so a save — or a colleague's — remounts it with those values.
 *
 * **`save` is memoised** because the form is its reader; `mutate` and `queryClient` are stable, and `dispatch` is
 * React's own, so it never changes (`reactCompiler` is off, AD-9).
 */
export function LegalControllerBoard({ record }: { readonly record: LegalControllerRecord }) {
  const t = useTranslations('platform.legalController');
  const titleId = useId();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(legalControllerSaveReducer, INITIAL_LEGAL_CONTROLLER_SAVE_STATE);
  const { mutate: publish } = useMutation({ mutationFn: publishLegalController });

  const save = useCallback(
    (request: PublishLegalControllerRequest) => {
      dispatch({ type: LEGAL_CONTROLLER_SAVE_EVENT.STARTED });
      publish(request, {
        onSuccess: (outcome) => {
          dispatch(
            outcome.status === API_OUTCOME.Ok
              ? { type: LEGAL_CONTROLLER_SAVE_EVENT.SUCCEEDED }
              : { type: LEGAL_CONTROLLER_SAVE_EVENT.REFUSED, failure: outcome },
          );
          void queryClient.invalidateQueries({ queryKey: LEGAL_CONTROLLER_QUERY_KEY });
        },
      });
    },
    [publish, queryClient],
  );

  return (
    <section aria-labelledby={titleId} className="flex max-w-[48rem] flex-col gap-[var(--space-5)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1 id={titleId} className="t-heading-1">
          {t('title')}
        </h1>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
      </header>

      <LegalControllerNotice
        notice={state.notice}
        onDismiss={() => dispatch({ type: LEGAL_CONTROLLER_SAVE_EVENT.NOTICE_DISMISSED })}
      />

      <LegalControllerAttribution record={record} />

      <LegalControllerForm key={record.revision} record={record} pending={state.pending} onSave={save} />
    </section>
  );
}
