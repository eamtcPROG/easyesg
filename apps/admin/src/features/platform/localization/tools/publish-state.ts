import type { ContentKind, ContentPublicationPreview } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';

/**
 * A-03's publication dialogue (task 67.5; UX-123): the items chosen, the preview of exactly that choice, and the
 * locales signed off for it. **One reducer, because a new choice voids the other two**: a preview or a sign-off given
 * for a different set must never stand beside this one — as three `useState`s, the choice's handler would have to
 * remember to clear both.
 */
export interface PublishItem {
  readonly kind: ContentKind;
  readonly key: string;
}

export interface PublishState {
  readonly chosen: readonly PublishItem[];
  readonly preview: ContentPublicationPreview | null;
  readonly signedOff: readonly Locale[];
}

export const PUBLISH_EVENT = {
  CHOSEN: 'chosen',
  PREVIEWED: 'previewed',
  SIGNED: 'signed',
} as const;

export type PublishEvent =
  | { readonly type: typeof PUBLISH_EVENT.CHOSEN; readonly chosen: readonly PublishItem[] }
  | { readonly type: typeof PUBLISH_EVENT.PREVIEWED; readonly preview: ContentPublicationPreview }
  | { readonly type: typeof PUBLISH_EVENT.SIGNED; readonly signedOff: readonly Locale[] };

export const INITIAL_PUBLISH_STATE: PublishState = { chosen: [], preview: null, signedOff: [] };

export const publishReducer = (state: PublishState, event: PublishEvent): PublishState => {
  switch (event.type) {
    case PUBLISH_EVENT.CHOSEN:
      return { chosen: event.chosen, preview: null, signedOff: [] };
    case PUBLISH_EVENT.PREVIEWED:
      return { ...state, preview: event.preview, signedOff: [] };
    case PUBLISH_EVENT.SIGNED:
      return { ...state, signedOff: event.signedOff };
  }
};

/** Whether the previewed set may be published: every item publishable, and every locale it carries signed off. */
export const readyToPublish = (state: PublishState): boolean =>
  state.preview !== null &&
  state.preview.items.every((item) => item.publishable) &&
  state.preview.locales.every((locale) => state.signedOff.includes(locale));
