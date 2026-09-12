'use client';

import { RecordShell } from '@easyesg/ui';
import { FormSummary } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useReducer, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Organization } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice, successNotice } from '@/lib/notice';
import { RecordNotice } from '@/shared/record-notice';
import { updateOrganizationProfileAction } from '../../actions/actions';
import { toFields, toPatch, type ProfileFields } from '../../tools/profile-fields';
import {
  PROFILE_EVENT,
  initialProfileState,
  profileReducer,
  visibleNotice,
} from '../../tools/profile-state';
import { AddressSection } from '../sections/address-section';
import { ContactsSection } from '../sections/contacts-section';
import { IdentifiersSection } from '../sections/identifiers-section';
import { IdentitySection } from '../sections/identity-section';
import { PROFILE_MESSAGES } from '../shared/profile-messages';
import type { CountryOption } from '../shared/vocabulary';
import { ProfileAttribution } from './profile-attribution';
import { ProfileControls } from './profile-controls';

/**
 * S-15's body — UC-50 and UC-51 on the Record archetype (FR-15, FR-16).
 *
 * **This file composes and commits; nothing else.** It was 430 lines holding four sections' worth of
 * fields, an attribution line, a controls row, three outcome callouts, two conversions and three
 * pieces of state (task 129). What is left is the two things no part can do: own the one `control`
 * every field registers against, and turn a settled action into the screen's next state.
 *
 * **One form over four sections, with one save**, which is the difference from S-28. That screen's
 * sections each commit their own thing because each is a separate credential operation; here §5's
 * Controls row is *edit; save; cancel* for the record, and the artboard draws a single Discard/Save
 * pair at the foot. So `sections/` is grouping, not scope — four groups of fields over one
 * `control`, and `ProfileControls` is the only thing that submits.
 *
 * **Save is inert until a field differs**, which the artboard states in words. `formState.isDirty` is
 * what react-hook-form computes against `defaultValues`, so the screen re-seeds them from the API's
 * answer after every successful save: the API normalises (a trimmed name, an upper-cased country and
 * LEI), and a form left holding what the reader typed would show a permanently dirty field they
 * cannot clean.
 *
 * **State is one reducer, not three `useState`s** — `tools/profile-state.ts` carries the argument and
 * the transitions are a unit spec. The tell was mechanical: every handler here called two or three
 * different setters.
 *
 * **What is rendered is derived from that state, not a fourth field.** Writing every branch out
 * surfaced a success notice that survived later edits — *"your changes were saved"* at the head of a
 * record whose foot read *"unsaved changes"* — and the owner's answer was that it clears. It clears
 * by `visibleNotice`, during render, because `rerender-derived-state-no-effect` is right and because
 * an event dispatched per keystroke is a second place that can disagree with `isDirty`.
 *
 * **The two failure arms differ only in which fallback copy applies**, which is why both go through
 * `failureNotice` and the branch is over the copy rather than over the rendering. Reaching for the
 * shared rule was the point — this screen was a third copy of it, spelled in JSX — but its
 * per-member fallback had to be given the *right* fallback per arm: answering a problem document
 * that omits a title with *"the server cannot be contacted"* would be false, because the server
 * answered. A single call with one `unreachable` copy would have done exactly that.
 *
 * States (§5's list, from §8.1): **loading — initial** is the page's · **loading — refresh** is the
 * busy save, which leaves every value readable · **error — recoverable** is the API's problem
 * document as received · **success** re-seeds and says so · **error — permission** is the page's,
 * because the refusal decides whether this renders at all · **read-only** has no cause at MVP —
 * every reader who reaches this screen is its administrator, and UX-13 requires a state to name
 * which of three causes applies, which is not a sentence that can be written yet.
 */
export interface OrganizationProfileFormProps {
  readonly organization: Organization;
  /** Each country the platform operates in, labelled, with its own labelled legal forms. */
  readonly countries: readonly CountryOption[];
}

export function OrganizationProfileForm({
  organization,
  countries,
}: OrganizationProfileFormProps) {
  const t = useTranslations(PROFILE_MESSAGES);
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');

  const [pending, startTransition] = useTransition();
  const [state, dispatch] = useReducer(profileReducer, organization, initialProfileState);

  const { control, handleSubmit, reset, formState } = useForm<ProfileFields>({
    mode: 'onTouched',
    defaultValues: toFields(organization),
  });

  // **There is deliberately no effect re-seeding this from the `organization` prop.** It was written
  // and removed: `react-hooks/set-state-in-effect` flagged it, and the rule was right twice over.
  // The case it guarded — the server re-rendering a newer record under a form that is still mounted
  // — is not one this screen produces: a save resets from its own response below, and any other
  // route to a newer record (a navigation, a reload) remounts this component and re-runs
  // `defaultValues`. And the cure was worse than the disease in the one case it would have fired,
  // since resetting a form somebody is typing in discards their work.
  //
  // The legal forms of the country currently CHOSEN, not the one stored: the API re-checks the form
  // against the country the patch results in and refuses a move that would strand it, so offering
  // the old country's forms after a change would build a request the API is about to reject.
  // `useWatch`, not `watch()`: it subscribes to this one field instead of re-rendering the whole
  // form on every keystroke anywhere in it, and it is the API `react-hooks/incompatible-library`
  // accepts — `watch()` cannot be memoized safely. `register-form.tsx` records the same choice.
  // It stays here rather than in `IdentitySection` so there is one subscription, not two.
  const chosenCountry = useWatch({ control, name: 'countryCode' });
  const legalForms = countries.find((country) => country.value === chosenCountry)?.legalForms ?? [];

  const submit = handleSubmit((fields) => {
    dispatch({ kind: PROFILE_EVENT.SUBMITTED });

    startTransition(async () => {
      const outcome = await updateOrganizationProfileAction(toPatch(fields));

      if (outcome.status === API_OUTCOME.Ok) {
        // Re-seed from what was STORED, not from what was typed — see the docblock.
        reset(toFields(outcome.value));
        dispatch({
          kind: PROFILE_EVENT.SAVED,
          stored: outcome.value,
          notice: successNotice({ copy: { title: t('saved.title'), body: t('saved.body') } }),
        });
        return;
      }

      dispatch({
        kind: PROFILE_EVENT.REFUSED,
        notice:
          outcome.status === API_OUTCOME.Unreachable
            ? // Nothing reached the server, so the screen owns the whole sentence including the
              // "what now" the API could not compose (NFR-79).
              failureNotice({
                outcome,
                unreachable: {
                  title: tCommon('unreachable.title'),
                  body: tCommon('unreachable.body'),
                },
                action: tCommon('unreachable.action'),
              })
            : // The server answered. Its own three-part text wins member by member, and the
              // fallbacks say *the change was not saved* rather than *we could not reach the
              // server*, which would be false here. No `action`: NFR-79 has the API compose the
              // next step into `detail`, so a catalogue sentence beside it duplicates at best.
              failureNotice({
                outcome,
                unreachable: { title: t('problemTitle'), body: t('problemBody') },
              }),
      });
    });
  });

  return (
    <form method="post" onSubmit={(event) => void submit(event)} noValidate>
      <RecordShell
        title={t('title')}
        summary={t('lede')}
        attribution={<ProfileAttribution lastChange={state.record.lastChange} />}
        actions={
          <ProfileControls
            dirty={formState.isDirty}
            busy={pending}
            onDiscardAction={() => {
              dispatch({ kind: PROFILE_EVENT.DISCARDED });
              reset(toFields(state.record));
            }}
          />
        }
      >
        <FormSummary control={control} title={tForms('summaryTitle')} />
        {/* Derived, not stored: a success says *the record on screen is what was saved*, which
            stops being true the moment a field differs — while a refusal stands until the next
            attempt, because the reader is editing in response to it. `visibleNotice` holds that
            asymmetry in one place and is a unit spec. */}
        <RecordNotice notice={visibleNotice(state, formState.isDirty)} />

        <IdentitySection control={control} countries={countries} legalForms={legalForms} />
        <IdentifiersSection control={control} />
        <AddressSection control={control} />
        <ContactsSection control={control} />
      </RecordShell>
    </form>
  );
}
