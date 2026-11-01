'use client';

import { ConsequenceDialogue } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useTransition,
  type ReactNode,
} from 'react';
import { useUnsentWork } from '@/client/unsent-work/unsent-work';
import { usePathname, useRouter } from '@/i18n/navigation';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { switchOrganizationAction } from '../actions/actions';
import {
  CHOICE_STAGE,
  choiceAt,
  INITIAL_SWITCH_STATE,
  pendingOrganizationId,
  SWITCH_EVENT,
  switchReducer,
  UNSENT_STEP,
  unsentStep,
  visibleFailure,
} from '../tools/switch-state';
import { SWITCH_MESSAGES } from './switch-messages';

/**
 * The organization switch, held once for the whole `(app)` layout (task 83.2; UC-16, UX-3, UX-37).
 *
 * **Why the flow lives here and not in the switcher.** The switcher is drawn twice — in the band, and in
 * the compact drawer — and the drawer closes the moment a row is chosen, unmounting whatever was inside it.
 * A choice's wait, its question and its refusal therefore belong above both, where neither closing menu nor
 * closing drawer can take them: the triggers call `choose`, and this provider carries it through.
 *
 * **What a choice goes through** is `switch-state.ts`'s docblock, and so is what this file reads off it. What
 * this file adds is what a reducer cannot do: reading the registry's standing of unsent answers as they move,
 * sending, and learning that the reader has left a screen. The two effects below are the first and the last —
 * the answers drain or stall on their own clock, and a navigation is not an event of this component's.
 *
 * **UX-37's dialogue is rendered here**, beside the flow that opens it, in the wizard's words for the same
 * consequence and one clause more: the answers are sent once the reader is back in their organization and
 * opens the report here, which the wizard's own exit never has to say.
 */
export interface OrganizationSwitchValue {
  readonly choose: (organizationId: string) => void;
  /** The organization a choice is waiting on, or on its way to; `null` when none is. */
  readonly pendingOrganizationId: string | null;
  /** Unsent answers anywhere under the layout — for the switcher's note. */
  readonly unsynced: number;
  /** The last choice's refusal, on the screen it was made on, until the next choice. */
  readonly failure: ApiFailure | null;
}

const OrganizationSwitchContext = createContext<OrganizationSwitchValue | null>(null);

export function OrganizationSwitchProvider({ children }: { readonly children: ReactNode }) {
  const t = useTranslations(SWITCH_MESSAGES);
  const pathname = usePathname();
  const router = useRouter();
  const { unsynced, blocked, retry } = useUnsentWork();
  const [state, dispatch] = useReducer(switchReducer, INITIAL_SWITCH_STATE);
  const [sending, startTransition] = useTransition();

  const send = useCallback(
    (organizationId: string) => {
      dispatch({ type: SWITCH_EVENT.SEND_STARTED, organizationId });
      startTransition(async () => {
        const outcome = await switchOrganizationAction({ organizationId, from: pathname });
        if (outcome.status !== API_OUTCOME.Ok) {
          dispatch({ type: SWITCH_EVENT.REFUSED, failure: outcome, pathname });
          // The memberships the band offers are read again, so an organization that refused is not offered twice.
          router.refresh();
          return;
        }
        // **Marked as a transition again, because it follows an `await`**: React no longer knows an update
        // made after one belongs to the transition, and this one is what keeps the switcher busy until the
        // landing screen commits — and no longer. The action answers the landing rather than redirecting,
        // for the reason its docblock measures: this provider outlives the navigation.
        startTransition(() => router.push(outcome.value.href));
      });
    },
    [pathname, router],
  );

  const choose = useCallback(
    (organizationId: string) => {
      if (unsynced === 0) {
        send(organizationId);
        return;
      }
      dispatch({ type: SWITCH_EVENT.CHOSEN_WHILE_UNSENT, organizationId });
      // UX-3's *flushed first*: another attempt now, rather than on the queue's own backoff.
      retry();
    },
    [unsynced, retry, send],
  );

  const waiting = choiceAt(state, CHOICE_STAGE.WAITING);

  // A waiting choice moves when its answers do: sent once they have gone, put to the reader once they cannot go.
  useEffect(() => {
    if (waiting === null) return;
    const step = unsentStep({ unsynced, blocked });
    if (step === UNSENT_STEP.SEND) send(waiting);
    else if (step === UNSENT_STEP.ASK) dispatch({ type: SWITCH_EVENT.UNSENT_BLOCKED });
  }, [waiting, unsynced, blocked, send]);

  // A refusal is forgotten once the reader has left its screen. Whether it shows is derived below, so this
  // never decides what a render draws; it only keeps a return to that address from bringing the refusal back.
  useEffect(() => {
    dispatch({ type: SWITCH_EVENT.NAVIGATED, pathname });
  }, [pathname]);

  const pending = pendingOrganizationId(state, sending);
  const failure = visibleFailure(state, pathname);
  const value = useMemo<OrganizationSwitchValue>(
    () => ({ choose, pendingOrganizationId: pending, unsynced, failure }),
    [choose, pending, unsynced, failure],
  );

  const confirming = choiceAt(state, CHOICE_STAGE.CONFIRMING);

  return (
    <OrganizationSwitchContext.Provider value={value}>
      {children}
      <ConsequenceDialogue
        open={confirming !== null}
        title={t('confirm.title')}
        object={t('confirm.object', { count: unsynced })}
        consequence={t('confirm.consequence')}
        retained={t('confirm.retained')}
        confirmLabel={t('confirm.proceed')}
        cancelLabel={t('confirm.cancel')}
        onConfirm={() => {
          dispatch({ type: SWITCH_EVENT.CONFIRMATION_ANSWERED });
          if (confirming !== null) send(confirming);
        }}
        onCancel={() => dispatch({ type: SWITCH_EVENT.CONFIRMATION_ANSWERED })}
      />
    </OrganizationSwitchContext.Provider>
  );
}

export function useOrganizationSwitch(): OrganizationSwitchValue {
  const value = use(OrganizationSwitchContext);
  if (value === null) {
    throw new Error('useOrganizationSwitch must be used within OrganizationSwitchProvider.');
  }
  return value;
}
