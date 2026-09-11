'use client';

import { Callout, CALLOUT_INTENT, ConsequenceDialogue, RecordShell } from '@easyesg/ui';
import { FormSummary } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useReducer, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { NaceCodeMatch, ReportingEntity } from '@easyesg/contracts';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { failureNotice, successNotice } from '@/lib/notice';
import { RecordNotice } from '@/shared/record-notice';
import { useRouter } from '@/i18n/navigation';
import { ROUTES, entityRoute } from '@/lib/routes';
import { archiveEntityAction, createEntityAction, updateEntityAction } from '../../actions/actions';
import { ENTITY_STANDING } from '../../tools/entities';
import { toFields, toRequest, type EntityFields } from '../../tools/entity-fields';
import {
  ENTITY_EVENT,
  codesChanged,
  entityRecordReducer,
  initialEntityRecordState,
  visibleNotice,
} from '../../tools/entity-record-state';
import { BoundarySection } from '../sections/boundary-section';
import { IdentitySection } from '../sections/identity-section';
import { SitesSection } from '../sections/sites-section';
import { ENTITY_RECORD_MESSAGES } from '../shared/entity-messages';
import { EntityControls } from './entity-controls';

/**
 * S-13's Record — UC-52, UC-53, UC-54 and UC-55 on one screen (FR-17 … FR-20).
 *
 * **This file composes and commits; nothing else** (task 134, on S-15's precedent). It was 426
 * lines holding three sections' worth of fields, a controls row, three outcome callouts, two
 * conversions and four pieces of state. What is left is the two things no part can do: own the one
 * `control` every field registers against, and turn a settled action into the screen's next state.
 *
 * **One form, one save, and the artboard's own caption says why**: *"The wizard autosaves; this
 * does not. A change here rewrites what other people see inside an open report, so it waits for an
 * explicit act and says what the act will cause."* So `sections/` is grouping, not scope, and
 * `EntityControls` is the only thing that submits.
 *
 * **State is one reducer, not four `useState`s** — `tools/entity-record-state.ts` carries the
 * argument and the transitions are a unit spec. What is rendered is derived from that state: a
 * success clears the moment anything differs from what was saved and a refusal stands until the
 * next attempt, the asymmetry the owner decided for S-15 and which holds here for the same reason.
 *
 * States (§5's list): loading — initial and refresh are the page's · error — recoverable is the
 * API's problem document as received · success re-seeds and says so · **read-only** is the archived
 * entity — a fourth cause beside UX-13's three (a locked period, a view-only membership, a
 * suspended entitlement), so its banner is this screen's own: it names the cause and says nothing
 * restores editing, rather than implying a reversal exists.
 */
export interface EntityRecordFormProps {
  /** Null in create mode. §4.6's Record has no identity header until the object exists. */
  readonly entity: ReportingEntity | null;
  /** The words for the codes it already holds. Empty in create mode. */
  readonly activity: readonly NaceCodeMatch[];
  /** Legal forms for the organization's country, already labelled by the page. */
  readonly legalForms: readonly { readonly value: string; readonly label: string }[];
}

export function EntityRecordForm({ entity, activity, legalForms }: EntityRecordFormProps) {
  const t = useTranslations(ENTITY_RECORD_MESSAGES);
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [state, dispatch] = useReducer(entityRecordReducer, activity, initialEntityRecordState);

  const archived = entity?.status === ENTITY_STANDING.ARCHIVED;

  const { control, handleSubmit, reset, formState } = useForm<EntityFields>({
    mode: 'onTouched',
    defaultValues: toFields(entity),
  });

  // The activity list lives outside the form, so `isDirty` cannot see it — OR'd in from the state.
  const dirty = formState.isDirty || codesChanged(state);

  // The two failure arms differ only in which fallback copy applies: nothing reached the server, so
  // the screen owns the whole sentence including the "what now"; or the server answered, and its
  // own three-part text wins member by member with a fallback that says *the change was not saved*
  // rather than *we could not reach the server*, which would be false.
  const refused = (outcome: ApiOutcome<unknown>): void =>
    dispatch({
      kind: ENTITY_EVENT.REFUSED,
      notice:
        outcome.status === API_OUTCOME.Unreachable
          ? failureNotice({
              outcome,
              unreachable: { title: tCommon('unreachable.title'), body: tCommon('unreachable.body') },
              action: tCommon('unreachable.action'),
            })
          : failureNotice({
              outcome,
              unreachable: { title: t('problemTitle'), body: t('problemBody') },
            }),
    });

  const submit = handleSubmit((fields) => {
    dispatch({ kind: ENTITY_EVENT.SUBMITTED });
    const body = toRequest(fields, state.codes);

    startTransition(async () => {
      const result = entity
        ? await updateEntityAction({ entityId: entity.id, patch: body })
        : await createEntityAction(body);

      if (result.status !== API_OUTCOME.Ok) {
        refused(result);
        return;
      }
      if (!entity) {
        // Created: the record now has an address of its own, and staying on `/entities/new` would
        // leave a reader one refresh away from creating a second one.
        router.push(entityRoute(result.value.id));
        return;
      }
      // Re-seed from what was STORED, not from what was typed: the API normalises.
      reset(toFields(result.value));
      dispatch({
        kind: ENTITY_EVENT.SAVED,
        notice: successNotice({ copy: { title: t('saved.title'), body: t('saved.body') } }),
      });
    });
  });

  const archive = (): void => {
    if (!entity) return;
    startTransition(async () => {
      const result = await archiveEntityAction({ entityId: entity.id });
      if (result.status === API_OUTCOME.Ok) {
        router.push(ROUTES.ENTITIES);
        return;
      }
      refused(result);
    });
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <RecordShell
        title={entity ? entity.name : t('createTitle')}
        summary={entity ? t('lede') : t('createLede')}
        actions={
          archived ? null : (
            <EntityControls
              entity={entity}
              dirty={dirty}
              busy={pending}
              onDiscardAction={() => {
                dispatch({ kind: ENTITY_EVENT.DISCARDED });
                reset(toFields(entity));
              }}
              onArchiveRequestedAction={() => dispatch({ kind: ENTITY_EVENT.ARCHIVE_REQUESTED })}
            />
          )
        }
      >
        <FormSummary control={control} title={tForms('summaryTitle')} />

        {/* UX-13: a read-only state names which of the three causes applies. Here it is FR-20's
            archive, and nothing restores editing — saying so is more honest than implying a
            reversal the product does not offer. */}
        {archived ? (
          <Callout intent={CALLOUT_INTENT.INFO} title={t('archived.title')} action={null}>
            {t('archived.body')}
          </Callout>
        ) : null}

        <RecordNotice notice={visibleNotice(state, dirty)} />

        <IdentitySection
          control={control}
          legalForms={legalForms}
          archived={archived}
          codes={state.codes}
          onCodesChangeAction={(codes) => dispatch({ kind: ENTITY_EVENT.CODES_CHANGED, codes })}
        />
        <BoundarySection control={control} archived={archived} />
        <SitesSection control={control} archived={archived} />
      </RecordShell>

      {/* §6.14 and UX-70: the consequence names the object and what stops, and UX-69's reassurance
          names what survives. FR-20 makes that reassurance the whole point — filed reports stay
          downloadable exactly as distributed. */}
      {entity ? (
        <ConsequenceDialogue
          open={state.confirmingArchive}
          object={entity.name}
          title={t('archive.title')}
          consequence={t('archive.consequence')}
          retained={t('archive.retained')}
          confirmLabel={t('archive.confirm')}
          cancelLabel={t('archive.cancel')}
          busy={pending}
          onConfirm={archive}
          onCancel={() => dispatch({ kind: ENTITY_EVENT.ARCHIVE_DISMISSED })}
        />
      ) : null}
    </form>
  );
}
