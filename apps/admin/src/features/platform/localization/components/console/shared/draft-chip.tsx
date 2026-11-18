import { CONTENT_DRAFT_STATE, type ContentDraftState } from '@easyesg/contracts';
import { STATUS_TONE, StatusChip } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

const TONE = {
  [CONTENT_DRAFT_STATE.DRAFT]: STATUS_TONE.NEUTRAL,
  [CONTENT_DRAFT_STATE.IN_REVIEW]: STATUS_TONE.PENDING,
} as const satisfies Record<ContentDraftState, (typeof STATUS_TONE)[keyof typeof STATUS_TONE]>;

const LABEL = {
  [CONTENT_DRAFT_STATE.DRAFT]: 'draft',
  [CONTENT_DRAFT_STATE.IN_REVIEW]: 'inReview',
} as const satisfies Record<ContentDraftState, string>;

/** Where an item's draft stands (task 67.5): being edited, or waiting for review — the word carries it, not the tone. */
export function DraftChip({ state }: { readonly state: ContentDraftState }) {
  const t = useTranslations('platform.content.draftState');
  return <StatusChip tone={TONE[state]}>{t(LABEL[state])}</StatusChip>;
}
