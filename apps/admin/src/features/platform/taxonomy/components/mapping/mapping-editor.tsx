import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  API_OUTCOME,
  TAXONOMY_COMPATIBILITY,
  TAXONOMY_FIELD_CHANGE,
  type ApiFailure,
  type VersionMapping,
} from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, RadioGroup, Select, TextField, useDismissible } from '@easyesg/ui';
import { useReducer, useState } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { TAXONOMY_QUERY_SCOPE, publishVersionMapping } from '../../queries/taxonomy-console';
import {
  MAPPING_EVENT,
  isCompatibility,
  isFieldChange,
  mappedFields,
  mappingReducer,
  type MappingDraft,
} from '../../tools/mapping-draft';

const EMPTY: MappingDraft = { determination: TAXONOMY_COMPATIBILITY.COMPATIBLE, fields: [] };

/**
 * A pair's mapping, edited (task 67.6; FR-67; 182/40): each field by its element and its kind of change alone, and the
 * pair's determination — forced to breaking the moment a field is removed or altered, since a report's answer to such a
 * field cannot move unreviewed (`mapping-draft.ts`). Published against the revision read; a publication remounts the
 * editor on the new revision, whose line says it is in force.
 */
export function MappingEditor({
  pair,
  initial,
  revision,
  proposal,
}: {
  readonly pair: { readonly from: string; readonly to: string };
  readonly initial: VersionMapping | null;
  readonly revision: number;
  readonly proposal: VersionMapping | null;
}) {
  const t = useTranslations('platform.taxonomy.mapping');
  const queryClient = useQueryClient();
  const [draft, dispatch] = useReducer(mappingReducer, initial ?? EMPTY);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const { mutate: publish, isPending } = useMutation({
    mutationFn: publishVersionMapping,
    onSuccess: async (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: TAXONOMY_QUERY_SCOPE });
    },
  });

  return (
    <form
      method="post"
      className="flex flex-col gap-[var(--space-4)]"
      onSubmit={(event) => {
        event.preventDefault();
        setFailure(null);
        publish({ ...pair, determination: draft.determination, fields: mappedFields(draft), expectedRevision: revision });
      }}
    >
      <p className="t-body">{revision === 0 ? t('unpublished') : t('inForce', { revision })}</p>
      {proposal === null ? null : (
        <div>
          <Button
            type="button"
            variant={BUTTON_VARIANT.SUBTLE}
            onClick={() => dispatch({ type: MAPPING_EVENT.LOADED, mapping: proposal })}
          >
            {t('useProposal', { count: proposal.fields.length })}
          </Button>
        </div>
      )}

      {draft.fields.length === 0 ? (
        <p className="t-body text-[var(--text-muted)]">{t('noFields')}</p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-3)]">
          {draft.fields.map((field, index) => (
            // A row's position is its identity while it is edited; the element is what the operator is typing.
            <li key={index} className="flex flex-wrap items-end gap-[var(--space-3)]">
              <TextField
                label={t('element')}
                value={field.element}
                onChange={(event) =>
                  dispatch({ type: MAPPING_EVENT.FIELD_CHANGED, index, field: { ...field, element: event.currentTarget.value } })
                }
              />
              <Select
                label={t('change')}
                value={field.change}
                options={Object.values(TAXONOMY_FIELD_CHANGE).map((change) => ({ value: change, label: t(`changes.${change}`) }))}
                onValueChange={(change) => {
                  if (isFieldChange(change)) dispatch({ type: MAPPING_EVENT.FIELD_CHANGED, index, field: { ...field, change } });
                }}
              />
              <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => dispatch({ type: MAPPING_EVENT.FIELD_REMOVED, index })}>
                {t('removeField')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => dispatch({ type: MAPPING_EVENT.FIELD_ADDED })}>
          {t('addField')}
        </Button>
      </div>

      <RadioGroup
        label={t('determination')}
        help={t('determinationHelp')}
        value={draft.determination}
        onValueChange={(determination) => {
          if (isCompatibility(determination)) dispatch({ type: MAPPING_EVENT.DETERMINATION_CHOSEN, determination });
        }}
        options={Object.values(TAXONOMY_COMPATIBILITY).map((determination) => ({
          value: determination,
          label: t(`determinations.${determination}.label`),
          description: t(`determinations.${determination}.description`),
        }))}
      />

      <div>
        <Button type="submit" busy={isPending}>
          {t('publish')}
        </Button>
      </div>
      {shownFailure === null ? null : (
        <ExpiringRefusal failure={shownFailure} title={t('problemTitle')} fallback={t('problemBody')} onDismiss={dismissFailure} />
      )}
    </form>
  );
}
