'use client';

import { RecordSection } from '@easyesg/ui';
import { FormSelect, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useWatch, type Control } from 'react-hook-form';
import { CONSOLIDATION_BASIS } from '../../../tools/entities';
import { EMPTY_MEMBER, type EntityFields } from '../../../tools/entity-fields';
import { IDENTIFIER_FAULT, idnoFault } from '../../../tools/identifiers';
import { ENTITY_RECORD_MESSAGES } from '../../shared/entity-messages';
import { EditableRow } from '../shared/editable-row';
import { RemovedRow } from '../shared/removed-row';
import { RowList } from '../shared/row-list';
import { ROW_COLLECTION, useRemovableRows } from '../shared/use-removable-rows';
import styles from '../../styles/entities.module.css';

/**
 * The reporting boundary (FR-19): the consolidation basis, null until stated, and the members a consolidated boundary
 * names. Setting `consolidated` with no member is refused by the API and not pre-empted here — the refusal names the
 * boundary, and a client-side guard would be a second copy of a rule that can change.
 *
 * **The members are offered once the basis is consolidated, or while any are held** (28 Sep 2026). An individual
 * boundary names no subsidiaries, so an empty list and its add control there asked a question the basis had already
 * answered; and members stored under an earlier consolidated basis stay visible, because the API keeps them whatever the
 * basis says and a list the reader cannot see is one they cannot remove from.
 *
 * **A subsidiary's IDNO is judged as it is typed** (task 215; FR-19's behaviour 8), by the identity section's tool and so
 * by the function the API re-validates with (§9.8), under two sentences of this section's that send the reader to the
 * subsidiary's certificate. Unlike the empty boundary, this is a rule the shared package holds rather than a copy of
 * one: the field says it before the save, and the API's refusal names the subsidiary for a caller that is not this
 * screen.
 */
export function BoundarySection({
  control,
  archived,
}: {
  readonly control: Control<EntityFields>;
  readonly archived: boolean;
}) {
  const t = useTranslations(`${ENTITY_RECORD_MESSAGES}.boundary`);
  // A basis's word is the shared catalogue's, which S-12's history words it by too (task 84).
  const tBasis = useTranslations('vocabulary.consolidationBases');
  const basis = useWatch({ control, name: 'consolidationBasis' });
  const members = useRemovableRows({ control, name: ROW_COLLECTION.MEMBERS, blank: EMPTY_MEMBER });
  const offersMembers = basis === CONSOLIDATION_BASIS.CONSOLIDATED || members.entries.length > 0;

  return (
    <RecordSection id="boundary" heading={t('heading')} description={t('lede')}>
      <div className={styles.fieldPair}>
        <FormSelect
          control={control}
          name="consolidationBasis"
          label={t('basis')}
          help={t('basisHelp')}
          placeholder={t('basisPlaceholder')}
          disabled={archived}
          options={Object.values(CONSOLIDATION_BASIS).map((option) => ({
            value: option,
            label: tBasis(option),
          }))}
        />
      </div>

      {offersMembers ? (
        <RowList
          count={members.entries.length}
          empty={t('membersNone')}
          addLabel={t('addMember')}
          addButton={members.addButton}
          readOnly={archived}
          onAddAction={members.add}
        >
          {members.entries.map((entry, index) => {
            const member = entry.name.trim() || t('member', { position: index + 1 });

            return entry.removed ? (
              <RemovedRow
                key={entry.key}
                sentence={t('memberRemoved', { member })}
                onRestoreAction={() => members.restoreAt(index)}
              />
            ) : (
              <EditableRow
                key={entry.key}
                name={member}
                removeLabel={t('removeMember', { member })}
                readOnly={archived}
                onRemoveAction={() => members.removeAt(index)}
              >
                <FormTextField
                  control={control}
                  name={`consolidationMembers.${index}.name`}
                  label={t('memberName')}
                  disabled={archived}
                  rules={{ required: t('memberNameRequired') }}
                />
                <FormTextField
                  control={control}
                  name={`consolidationMembers.${index}.idno`}
                  label={t('memberIdno')}
                  disabled={archived}
                  rules={{
                    validate: (value: string) => {
                      const fault = idnoFault(value);
                      if (fault === null) return true;
                      return fault === IDENTIFIER_FAULT.MALFORMED ? t('memberIdnoMalformed') : t('memberIdnoCheckDigits');
                    },
                  }}
                />
              </EditableRow>
            );
          })}
        </RowList>
      ) : null}
    </RecordSection>
  );
}
