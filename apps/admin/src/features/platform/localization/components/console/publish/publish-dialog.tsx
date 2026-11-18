import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  API_OUTCOME,
  CONTENT_DRAFT_STATE,
  type ApiFailure,
  type ContentItem,
} from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Checkbox, DIALOG_SIZE, Dialog, Fieldset, useDismissible } from '@easyesg/ui';
import { useReducer, useState } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import {
  CONTENT_CONSOLE_QUERY_KEY,
  previewContentPublication,
  publishContentSet,
  type ContentItemRef,
} from '../../../queries/content-console';
import { itemTitle } from '../../../tools/content-payload';
import { INITIAL_PUBLISH_STATE, PUBLISH_EVENT, publishReducer, readyToPublish } from '../../../tools/publish-state';

const sameItem = (a: ContentItemRef, b: ContentItemRef) => a.kind === b.kind && a.key === b.key;

/**
 * UX-123 for a content set (task 67.5; UC-72; FR-62), at `?panel=publish`: **choose** the items waiting in review,
 * **preview** what each carries and who the set reaches, **sign off** every locale it carries (NFR-23), **publish** —
 * in one transaction, for every tenant at once — and read the **result**; the one-step revert is each item's, in its
 * editor. Changing the choice discards a preview made of the previous one, so the sign-off is always given to the set
 * the operator saw.
 *
 * The choice, its preview and the sign-off are one reducer (`publish-state.ts`): a new choice voids the other two.
 */
export function PublishDialog({
  items,
  onPublished,
  onClose,
}: {
  readonly items: readonly ContentItem[];
  readonly onPublished: () => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.content.publish');
  const tLocales = useTranslations('platform.content.locales');
  const tChrome = useTranslations('chrome.dialog');
  const queryClient = useQueryClient();
  const waiting = items.filter((item) => item.draft?.state === CONTENT_DRAFT_STATE.IN_REVIEW);

  const [state, dispatch] = useReducer(publishReducer, INITIAL_PUBLISH_STATE);
  const { chosen, preview, signedOff } = state;
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const choose = (next: readonly ContentItemRef[]) => dispatch({ type: PUBLISH_EVENT.CHOSEN, chosen: next });

  const { mutate: askPreview, isPending: previewing } = useMutation({
    mutationFn: previewContentPublication,
    onSuccess: (outcome) => {
      if (outcome.status === API_OUTCOME.Ok) dispatch({ type: PUBLISH_EVENT.PREVIEWED, preview: outcome.value });
      else setFailure(outcome);
    },
  });
  const { mutate: publish, isPending: publishing } = useMutation({
    mutationFn: publishContentSet,
    onSuccess: async (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: CONTENT_CONSOLE_QUERY_KEY });
      onPublished();
    },
  });


  return (
    <Dialog
      open
      onClose={onClose}
      size={DIALOG_SIZE.WIDE}
      title={t('title')}
      description={t('lede')}
      closeLabel={tChrome('close')}
      footer={
        <>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
            {t('cancel')}
          </Button>
          {preview === null ? (
            <Button
              type="button"
              busy={previewing}
              disabled={chosen.length === 0}
              onClick={() => {
                setFailure(null);
                askPreview(chosen);
              }}
            >
              {t('preview')}
            </Button>
          ) : (
            <Button
              type="button"
              busy={publishing}
              disabled={!readyToPublish(state)}
              onClick={() => {
                setFailure(null);
                publish({ items: chosen, signedOff });
              }}
            >
              {t('confirm', { count: chosen.length })}
            </Button>
          )}
        </>
      }
    >
      {shownFailure === null ? null : (
        <ExpiringRefusal failure={shownFailure} title={t('problemTitle')} fallback={t('problemBody')} onDismiss={dismissFailure} />
      )}

      {waiting.length === 0 ? (
        <p className="t-body">{t('nothingWaiting')}</p>
      ) : (
        <Fieldset legend={t('choose')}>
          {waiting.map((item) => {
            const ref = { kind: item.kind, key: item.key };
            const checked = chosen.some((candidate) => sameItem(candidate, ref));
            return (
              <Checkbox
                key={`${item.kind}/${item.key}`}
                label={itemTitle({ payload: item.draft?.payload ?? null, key: item.key })}
                help={item.inForce === null ? t('firstPublication') : t('replaces', { revision: item.inForce.revision })}
                checked={checked}
                disabled={previewing || publishing}
                onChange={(event) =>
                  choose(event.currentTarget.checked ? [...chosen, ref] : chosen.filter((candidate) => !sameItem(candidate, ref)))
                }
              />
            );
          })}
        </Fieldset>
      )}

      {preview === null ? null : (
        <section aria-labelledby="content-scope" className="flex flex-col gap-[var(--space-3)]">
          <h3 id="content-scope" className="t-label">
            {t('scopeHeading')}
          </h3>
          <p className="t-body">{t('reach', { organizations: preview.reach.organizations })}</p>
          <ul className="t-body flex flex-col gap-[var(--space-1)]">
            {preview.items.map((entry) => (
              <li key={`${entry.kind}/${entry.key}`}>
                {entry.publishable
                  ? t('itemReady', {
                      key: entry.key,
                      locales: entry.locales.map((locale) => tLocales(locale)).join(', '),
                    })
                  : t('itemNotReady', { key: entry.key })}
              </li>
            ))}
          </ul>
          <Fieldset legend={t('signOff')}>
            {preview.locales.map((locale) => (
              <Checkbox
                key={locale}
                label={t('signOffLocale', { locale: tLocales(locale) })}
                checked={signedOff.includes(locale)}
                disabled={publishing}
                onChange={(event) =>
                  dispatch({
                    type: PUBLISH_EVENT.SIGNED,
                    signedOff: event.currentTarget.checked
                      ? [...signedOff, locale]
                      : signedOff.filter((candidate) => candidate !== locale),
                  })
                }
              />
            ))}
          </Fieldset>
        </section>
      )}
    </Dialog>
  );
}
