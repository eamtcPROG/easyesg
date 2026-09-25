import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type IdentityProvider, type SocialProvider } from '@easyesg/contracts';
import { useCallback, useId, useReducer } from 'react';
import { useTranslations } from 'use-intl';
import { IDENTITY_PROVIDERS_QUERY_KEY, runProviderAction } from '../../../queries/identity-providers';
import { withProvider, type IdentityProvidersSearch } from '../../../tools/identity-providers-search';
import {
  INITIAL_PROVIDER_ACTION_STATE,
  PROVIDER_ACTION_EVENT,
  actionAsksConfirmation,
  providerActionReducer,
  type ProviderAction,
} from '../../../tools/provider-action-state';
import { providerNamed } from '../../../tools/providers-read';
import { ProviderConfirmation } from '../confirm/provider-confirmation';
import { ProviderList } from '../list/provider-list';
import { ProviderNotice } from '../notice/provider-notice';
import { ProviderRecord } from '../record/provider-record';

/**
 * A-18's providers, ready (task 67.11) — the heading, the notice, the list at full width, the chosen provider's record
 * in a dialogue over it (task 170; `design_spec.md` §5.2's preamble), and the confirmation a disable or a live save
 * asks for (UX-70), which opens over the dialogue when the record asked for it.
 *
 * **Every answer invalidates the providers**, the refusals included: a save refused because a colleague saved
 * first must redraw the record with the values now in force, which is what the conflict notice tells the operator
 * they are looking at.
 *
 * **One notice, drawn where the operator is looking**: inside the record's dialogue while it is open, since the page
 * behind a modal dialogue is hidden from assistive technology, and on the board otherwise — after a row's menu acted,
 * or once the dialogue is closed.
 *
 * **`onOpen` and `request` are memoised, and `perform` because `request` calls it**: the list's columns are memoised
 * on them since the row's menu offers the enable or disable (task 170). `mutate` and `queryClient` are stable, so
 * `request` changes only when the providers are read again (`reactCompiler` is off, AD-9).
 */
export function ProvidersBoard({
  providers,
  search,
  onSearchChange,
}: {
  readonly providers: readonly IdentityProvider[];
  readonly search: IdentityProvidersSearch;
  readonly onSearchChange: (next: IdentityProvidersSearch) => void;
}) {
  const t = useTranslations('platform.identityProviders');
  const titleId = useId();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(providerActionReducer, INITIAL_PROVIDER_ACTION_STATE);
  const { mutate: run } = useMutation({ mutationFn: runProviderAction });

  const perform = useCallback(
    (action: ProviderAction) => {
      dispatch({ type: PROVIDER_ACTION_EVENT.STARTED, action });
      run(action, {
        onSuccess: (outcome) => {
          dispatch(
            outcome.status === API_OUTCOME.Ok
              ? { type: PROVIDER_ACTION_EVENT.SUCCEEDED }
              : { type: PROVIDER_ACTION_EVENT.REFUSED, failure: outcome },
          );
          void queryClient.invalidateQueries({ queryKey: IDENTITY_PROVIDERS_QUERY_KEY });
        },
      });
    },
    [run, queryClient],
  );

  const request = useCallback(
    (action: ProviderAction) => {
      const enabled = providerNamed({ providers, provider: action.provider })?.enabled ?? false;
      if (actionAsksConfirmation({ action, enabled })) {
        dispatch({ type: PROVIDER_ACTION_EVENT.CONFIRMATION_REQUESTED, action });
      } else {
        perform(action);
      }
    },
    [providers, perform],
  );

  const onOpen = useCallback(
    (provider: SocialProvider) => onSearchChange(withProvider(search, provider)),
    [onSearchChange, search],
  );

  const selected = providerNamed({ providers, provider: search.provider });
  const confirmed = providerNamed({ providers, provider: state.confirming?.provider });
  const notice = (
    <ProviderNotice
      notice={state.notice}
      onDismiss={() => dispatch({ type: PROVIDER_ACTION_EVENT.NOTICE_DISMISSED })}
    />
  );

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[var(--space-5)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1 id={titleId} className="t-heading-1">
          {t('title')}
        </h1>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
      </header>

      {selected === null ? notice : null}

      <ProviderList providers={providers} pending={state.pending} onOpen={onOpen} onRequest={request} />

      {selected === null ? null : (
        <ProviderRecord
          provider={selected}
          pending={state.pending}
          notice={notice}
          onAction={request}
          onClose={() => onSearchChange(withProvider(search, null))}
        />
      )}

      <ProviderConfirmation
        action={state.confirming}
        provider={confirmed}
        busy={state.pending !== null}
        onConfirm={() => {
          if (state.confirming !== null) perform(state.confirming);
        }}
        onCancel={() => dispatch({ type: PROVIDER_ACTION_EVENT.CONFIRMATION_CANCELLED })}
      />
    </section>
  );
}
