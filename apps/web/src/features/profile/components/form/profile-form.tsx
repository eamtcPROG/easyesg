'use client';

import { RecordShell } from '@easyesg/ui';
import { FormSummary } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useReducer, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { failureNotice, successNotice } from '@/lib/notice';
import { RECORD_EVENT, initialRecordState, recordReducer, visibleNotice } from '@/lib/record-state';
import { RecordControls } from '@/shared/record-controls';
import { RecordNotice } from '@/shared/record-notice';
import { savePreferencesAction, saveProfileAction } from '../../actions/actions';
import {
  changedParts,
  toFields,
  toPreferencesSave,
  toProfileSave,
  type ProfileFields,
  type ProfileRecord,
} from '../../tools/profile-fields';
import { IdentitySection } from '../sections/identity-section';
import { LanguagesSection } from '../sections/languages-section';
import { NotificationsSection } from '../sections/notifications-section';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/**
 * S-27's body — UC-13, UC-14 and UC-168 on the Record archetype (task 52.3; FR-9, FR-10, FR-52, FR-163, FR-169).
 *
 * **This file composes and commits; nothing else**, S-15's shape: one `control` every field registers against, and a
 * settled save turned into the screen's next state through `@/lib/record-state`, the reducer the two Record screens
 * share.
 *
 * **One form, one save, two resources.** The artboard draws a single Discard/Save pair at the foot, and the profile
 * and the preferences are separate owners' routes; `changedParts` says which the save must write, and an unchanged
 * half is not rewritten. **The preferences go first**, because a new interface language ends the profile's write in a
 * navigation to the screen in that language (`saveProfileAction`), and nothing after a navigation runs. A refusal of
 * either stops the save there and says so; a half already written stays written, and the form is re-seeded from it so
 * the fields that still differ are the ones that were not saved.
 *
 * States (§5's list, from §8.1): **loading — initial** is the page's `Suspense` fallback, `ProfileLoading` · **error —
 * recoverable** is `ProfileUnreachable` for the read and the API's problem document here for a save · **success** re-seeds and says so · **read-only** is the
 * mandatory categories, drawn as locked with the reason stated.
 */
export function ProfileForm({ record }: { readonly record: ProfileRecord }) {
  const t = useTranslations(PROFILE_MESSAGES);
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');

  const [pending, startTransition] = useTransition();
  const [state, dispatch] = useReducer(recordReducer<ProfileRecord>, record, initialRecordState);

  const { control, handleSubmit, reset, formState } = useForm<ProfileFields>({
    mode: 'onTouched',
    defaultValues: toFields(record),
  });

  const refused = (outcome: ApiFailure, written?: ProfileRecord) =>
    dispatch({
      kind: RECORD_EVENT.REFUSED,
      stored: written,
      notice:
        outcome.status === API_OUTCOME.Unreachable
          ? failureNotice({
              outcome,
              unreachable: { title: tCommon('unreachable.title'), body: tCommon('unreachable.body') },
              action: tCommon('unreachable.action'),
            })
          : failureNotice({ outcome, unreachable: { title: t('problemTitle'), body: t('problemBody') } }),
    });

  const submit = handleSubmit((fields) => {
    dispatch({ kind: RECORD_EVENT.SUBMITTED });

    startTransition(async () => {
      const parts = changedParts({ fields, stored: state.record });
      let stored = state.record;

      if (parts.preferences) {
        const outcome = await savePreferencesAction(toPreferencesSave(fields));
        if (outcome.status !== API_OUTCOME.Ok) return refused(outcome);
        if (outcome.value === null) return refused(NO_BODY);
        stored = { ...stored, preferences: outcome.value };
      }

      if (parts.profile) {
        const outcome = await saveProfileAction(toProfileSave(fields));
        if (outcome.status !== API_OUTCOME.Ok || outcome.value === null) {
          // Preferences written before the profile was refused stay written: the form measures against them —
          // `keepValues`, so the reader's profile edits stay on screen as the only fields still unsaved — and the
          // record moves to them, so a discard restores what is actually stored.
          const written = stored === state.record ? undefined : stored;
          if (written) reset(toFields(written), { keepValues: true });
          return refused(outcome.status === API_OUTCOME.Ok ? NO_BODY : outcome, written);
        }
        stored = { ...stored, profile: outcome.value };
      }

      // Re-seed from what was STORED — the api trims the names and gives the phone one spelling.
      reset(toFields(stored));
      dispatch({
        kind: RECORD_EVENT.SAVED,
        stored,
        notice: successNotice({ copy: { title: t('saved.title'), body: t('saved.body') } }),
      });
    });
  });

  return (
    <form method="post" onSubmit={(event) => void submit(event)} noValidate>
      <RecordShell
        title={t('title')}
        summary={t('lede')}
        actions={
          <RecordControls
            dirty={formState.isDirty}
            busy={pending}
            onDiscardAction={() => {
              dispatch({ kind: RECORD_EVENT.DISCARDED });
              reset(toFields(state.record));
            }}
          />
        }
      >
        <FormSummary control={control} title={tForms('summaryTitle')} />
        <RecordNotice notice={visibleNotice(state, formState.isDirty)} />

        <IdentitySection control={control} profile={state.record.profile} />
        <LanguagesSection control={control} />
        <NotificationsSection control={control} preferences={state.record.preferences} />
      </RecordShell>
    </form>
  );
}

/**
 * An `Ok` with no body — a save answers the resource it wrote, so an empty answer means nothing can be said about what
 * was stored. Drawn as the unreachable arm, rather than leaving the screen after `SUBMITTED` with no report at all (task
 * 52's close review).
 */
const NO_BODY: ApiFailure = { status: API_OUTCOME.Unreachable };
