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
 * A-18's providers, ready (task 67.11) — the heading, the notice, the list with the chosen provider's record
 * beside it, and the confirmation a disable or a live save asks for (UX-70).
 *
 * **Every answer invalidates the providers**, the refusals included: a save refused because a colleague saved
 * first must redraw the record with the values now in force, which is what the conflict notice tells the operator
 * they are looking at.
 *
 * **Only `onOpen` is memoised**, because the list's columns are memoised on it; `perform` and `request` reach
 * plain buttons that observe no identity, so wrapping them would be noise (`reactCompiler` is off, AD-9).
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

  const perform = (action: ProviderAction) => {
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
  };

  const request = (action: ProviderAction) => {
    const enabled = providerNamed({ providers, provider: action.provider })?.enabled ?? false;
    if (actionAsksConfirmation({ action, enabled })) {
      dispatch({ type: PROVIDER_ACTION_EVENT.CONFIRMATION_REQUESTED, action });
    } else {
      perform(action);
    }
  };

  const onOpen = useCallback(
    (provider: SocialProvider) => onSearchChange(withProvider(search, provider)),
    [onSearchChange, search],
  );

  const selected = providerNamed({ providers, provider: search.provider });
  const confirmed = providerNamed({ providers, provider: state.confirming?.provider });

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[var(--space-5)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1 id={titleId} className="t-heading-1">
          {t('title')}
        </h1>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
      </header>

      <ProviderNotice
        notice={state.notice}
        onDismiss={() => dispatch({ type: PROVIDER_ACTION_EVENT.NOTICE_DISMISSED })}
      />

      <div
        className={
          selected === null
            ? 'min-w-0'
            : 'grid grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] items-start gap-[var(--space-5)]'
        }
      >
        <ProviderList providers={providers} onOpen={onOpen} />
        {selected === null ? null : (
          <ProviderRecord
            provider={selected}
            pending={state.pending}
            onAction={request}
            onClose={() => onSearchChange(withProvider(search, null))}
          />
        )}
      </div>

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
