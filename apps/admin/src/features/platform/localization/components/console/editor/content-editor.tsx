import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  API_OUTCOME,
  CONTENT_DRAFT_STATE,
  CONTENT_KIND,
  type ContentItem,
  type ContentKind,
} from '@easyesg/contracts';
import { LOCALES, SOURCE_LOCALE, isLocale, type Locale } from '@easyesg/i18n';
import { BUTTON_VARIANT, Button, DIALOG_SIZE, Dialog, RadioGroup, TextField, useDismissible } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import {
  CONTENT_CONSOLE_QUERY_KEY,
  discardContentDraft,
  revertContentItem,
  saveContentDraft,
  submitContentDraft,
  type ContentItemRef,
} from '../../../queries/content-console';
import { CONTENT_KIND_LABEL } from '../../../tools/content-kind-labels';
import { blockOf, emptyPayload, itemTitle, withoutLocale, type ContentPayload } from '../../../tools/content-payload';
import { EDITOR_ACTION, EDITOR_OUTCOME, type EditorAction, type EditorOutcome } from '../../../tools/editor-action';
import { DraftChip } from '../shared/draft-chip';
import { ArticleSections } from './article-sections';
import { ContentFields } from './content-fields';

const KEY_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** The ask the editor sends, with the item it is about and the payload a save carries. */
const runAction = (input: { readonly action: EditorAction; readonly item: ContentItemRef; readonly payload: ContentPayload }) => {
  switch (input.action) {
    case EDITOR_ACTION.SAVE:
      return saveContentDraft({ ...input.item, payload: input.payload });
    case EDITOR_ACTION.SUBMIT:
      return submitContentDraft(input.item);
    case EDITOR_ACTION.DISCARD:
      return discardContentDraft(input.item);
    case EDITOR_ACTION.REVERT:
      return revertContentItem(input.item);
  }
};

/**
 * A-03's editor (task 67.5; UC-71, UC-72; FR-61, FR-62), in a dialogue over the list (task 170) at `?item=` — or, for a
 * new item, at `?create=` until its first save gives it an address. **It edits the item's draft**, starting from the
 * open draft or else from what is in force: saving makes or edits the draft, which nobody reads until a reviewed set
 * is published; *Send to review* readies it for that; *Drop the draft* returns to what is in force; and, for an operator
 * who may publish, *Put back the previous version* is UX-123's one step.
 *
 * **One locale at a time, chosen above its fields**, with the shared fields once beneath the key: every locale is
 * authored separately (NFR-23) and Romanian is the source. A locale with nothing written is not carried — a reader in
 * it is served Romanian and FR-64's queue says so.
 */
export function ContentEditor({
  item,
  createKind,
  canPublish,
  onCreated,
  onClose,
}: {
  /** The item being edited; null while a new one has no key yet. */
  readonly item: ContentItem | null;
  /** The kind of a new item — read only where `item` is null. */
  readonly createKind: ContentKind | null;
  readonly canPublish: boolean;
  /** A new item's first save — its address, so the dialogue moves to it. */
  readonly onCreated: (item: ContentItemRef) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.content.editor');
  const tKinds = useTranslations('platform.content.kinds');
  const tLocales = useTranslations('platform.content.locales');
  const tChrome = useTranslations('chrome.dialog');
  const queryClient = useQueryClient();

  const kind = item?.kind ?? createKind ?? null;
  const [payload, setPayload] = useState<ContentPayload>(
    () => item?.draft?.payload ?? item?.inForce?.payload ?? (kind === null ? {} : emptyPayload(kind)),
  );
  const [locale, setLocale] = useState<Locale>(SOURCE_LOCALE);
  const [newKey, setNewKey] = useState('');
  const [outcome, setOutcome] = useState<EditorOutcome | null>(null);
  const failure = outcome?.kind === EDITOR_OUTCOME.REFUSED ? outcome.failure : null;
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const { mutate: run, isPending } = useMutation({
    mutationFn: runAction,
    onSuccess: async (answer, asked) => {
      if (answer.status !== API_OUTCOME.Ok) {
        setOutcome({ kind: EDITOR_OUTCOME.REFUSED, failure: answer });
        return;
      }
      setOutcome({ kind: EDITOR_OUTCOME.DONE, action: asked.action });
      await queryClient.invalidateQueries({ queryKey: CONTENT_CONSOLE_QUERY_KEY });
      if (item === null && asked.action === EDITOR_ACTION.SAVE) onCreated(asked.item);
    },
  });

  if (kind === null) return null;
  const ref: ContentItemRef = { kind, key: item?.key ?? newKey };
  const keyValid = item !== null || KEY_SHAPE.test(newKey);
  const ask = (action: EditorAction) => run({ action, item: ref, payload });

  return (
    <Dialog
      open
      onClose={onClose}
      size={DIALOG_SIZE.WIDE}
      title={item === null ? t('newTitle', { kind: tKinds(CONTENT_KIND_LABEL[kind]) }) : itemTitle({ payload, key: item.key })}
      description={item === null ? t('newLede') : t('lede', { kind: tKinds(CONTENT_KIND_LABEL[kind]) })}
      closeLabel={tChrome('close')}
      footer={
        <>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
            {t('close')}
          </Button>
          <Button type="button" busy={isPending} disabled={!keyValid} onClick={() => ask(EDITOR_ACTION.SAVE)}>
            {t('save')}
          </Button>
        </>
      }
    >
      {outcome?.kind === EDITOR_OUTCOME.DONE ? (
        <p role="status" className="t-body">
          {t(`done.${outcome.action}`)}
        </p>
      ) : null}
      {shownFailure === null ? null : (
        <ExpiringRefusal failure={shownFailure} title={t('problemTitle')} fallback={t('problemBody')} onDismiss={dismissFailure} />
      )}

      {item === null ? (
        <TextField
          label={t('key')}
          help={t('keyHelp')}
          value={newKey}
          error={newKey !== '' && !keyValid ? t('keyInvalid') : undefined}
          onChange={(event) => setNewKey(event.currentTarget.value)}
          autoComplete="off"
        />
      ) : (
        <div className="flex flex-wrap items-center gap-[var(--space-3)]">
          <span className="t-caption text-[var(--text-muted)]" translate="no">
            {item.key}
          </span>
          {item.inForce === null ? (
            <span className="t-caption">{t('notPublished')}</span>
          ) : (
            <span className="t-caption">{t('inForce', { revision: item.inForce.revision })}</span>
          )}
          {item.draft === null ? null : <DraftChip state={item.draft.state} />}
        </div>
      )}

      <section aria-labelledby="content-shared" className="flex flex-col gap-[var(--space-3)]">
        <h3 id="content-shared" className="t-label">
          {t('shared')}
        </h3>
        <ContentFields kind={kind} payload={payload} locale={null} disabled={isPending} onChange={setPayload} />
      </section>

      <section aria-labelledby="content-locale" className="flex flex-col gap-[var(--space-3)]">
        <h3 id="content-locale" className="t-label">
          {t('localeHeading')}
        </h3>
        <RadioGroup
          label={t('localeLegend')}
          name="content-locale"
          value={locale}
          options={LOCALES.map((code) => ({
            value: code,
            label: blockOf(payload, code) === null ? t('localeMissing', { locale: tLocales(code) }) : tLocales(code),
          }))}
          onValueChange={(value) => {
            if (isLocale(value)) setLocale(value);
          }}
        />
        <ContentFields kind={kind} payload={payload} locale={locale} disabled={isPending} onChange={setPayload} />
        {kind === CONTENT_KIND.HELP_ARTICLE ? (
          <ArticleSections payload={payload} locale={locale} disabled={isPending} onChange={setPayload} />
        ) : null}
        {locale === SOURCE_LOCALE || blockOf(payload, locale) === null ? null : (
          <div>
            <Button
              type="button"
              variant={BUTTON_VARIANT.SECONDARY}
              disabled={isPending}
              onClick={() => setPayload(withoutLocale(payload, locale))}
            >
              {t('withdrawLocale', { locale: tLocales(locale) })}
            </Button>
          </div>
        )}
      </section>

      {item === null ? null : (
        <div className="flex flex-wrap gap-[var(--space-3)]">
          {item.draft?.state === CONTENT_DRAFT_STATE.DRAFT ? (
            <Button type="button" variant={BUTTON_VARIANT.SECONDARY} busy={isPending} onClick={() => ask(EDITOR_ACTION.SUBMIT)}>
              {t('submit')}
            </Button>
          ) : null}
          {item.draft === null ? null : (
            <Button type="button" variant={BUTTON_VARIANT.SECONDARY} busy={isPending} onClick={() => ask(EDITOR_ACTION.DISCARD)}>
              {t('discard')}
            </Button>
          )}
          {canPublish && item.inForce?.revertible === true ? (
            <Button type="button" variant={BUTTON_VARIANT.SECONDARY} busy={isPending} onClick={() => ask(EDITOR_ACTION.REVERT)}>
              {t('revert')}
            </Button>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
