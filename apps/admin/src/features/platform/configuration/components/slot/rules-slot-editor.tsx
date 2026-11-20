import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type ApiFailure, type RulesSlot } from '@easyesg/contracts';
import { Button, TextArea, useDismissible } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { RULES_CONSOLE_QUERY_KEY, publishRules } from '../../queries/rules-console';
import { draftOf, readDraft } from '../../tools/rules-draft';

/**
 * One slot of a family, edited (task 67.8; UC-80 … UC-82): the artefact as the store holds it, changed as text and
 * published for the window it was read in, against the revision read. **Keyed by the board on the revision**, so a
 * publication remounts it with what is in force. A text that is not a JSON object is named at the field; what the family's
 * reader refuses is the api's refusal.
 */
export function RulesSlotEditor({ slot }: { readonly slot: RulesSlot }) {
  const t = useTranslations('platform.rules.slot');
  const queryClient = useQueryClient();
  const [text, setText] = useState(() => draftOf(slot.payload));
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);
  const read = readDraft(text);

  const { mutate: publish, isPending } = useMutation({
    mutationFn: publishRules,
    onSuccess: async (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: RULES_CONSOLE_QUERY_KEY });
    },
  });

  return (
    <form
      method="post"
      className="flex flex-col gap-[var(--space-3)]"
      onSubmit={(event) => {
        event.preventDefault();
        if (!('payload' in read)) return;
        setFailure(null);
        publish({ family: slot.family, scope: slot.scope, payload: read.payload, validFrom: slot.validFrom, validTo: slot.validTo, expectedRevision: slot.revision });
      }}
    >
      <TextArea
        label={t('label', { scope: slot.scope, revision: slot.revision })}
        help={
          slot.validFrom === null && slot.validTo === null
            ? t('undated')
            : t('window', { from: slot.validFrom ?? t('always'), to: slot.validTo ?? t('open') })
        }
        error={'fault' in read ? t(`faults.${read.fault}`) : undefined}
        rows={14}
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
      />
      <div>
        <Button type="submit" busy={isPending} disabled={'fault' in read}>
          {t('publish')}
        </Button>
      </div>
      {shownFailure === null ? null : (
        <ExpiringRefusal failure={shownFailure} title={t('problemTitle')} fallback={t('problemBody')} onDismiss={dismissFailure} />
      )}
    </form>
  );
}
