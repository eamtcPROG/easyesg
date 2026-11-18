import { CONTENT_KIND, type ContentKind } from '@easyesg/contracts';

/**
 * A-03's addressable state (task 67.5; UX-4): the item whose editor is open — `kind/key` — or a new one of a kind, and
 * whether the publication dialogue is open. **A value this screen does not understand is dropped**, A-17's rule, so a
 * stale address shows the list.
 */
export const CONTENT_PANEL = {
  PUBLISH: 'publish',
} as const;

export type ContentPanel = (typeof CONTENT_PANEL)[keyof typeof CONTENT_PANEL];

export interface ContentConsoleSearch {
  /** `<kind>/<key>` of the item whose editor is open. */
  readonly item?: string;
  /** A new item of this kind, its key not yet chosen. */
  readonly create?: ContentKind;
  readonly panel?: ContentPanel;
}

const isContentKind = (value: unknown): value is ContentKind =>
  typeof value === 'string' && (Object.values(CONTENT_KIND) as readonly string[]).includes(value);

/** An item reference out of the address, or null — `kind/key`, the key lower-case words and hyphens. */
export const itemRefOf = (value: string | undefined): { readonly kind: ContentKind; readonly key: string } | null => {
  if (value === undefined) return null;
  const [kind, key, ...rest] = value.split('/');
  return isContentKind(kind) && key !== undefined && rest.length === 0 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(key)
    ? { kind, key }
    : null;
};

export const readContentConsoleSearch = (raw: Record<string, unknown>): ContentConsoleSearch => ({
  ...(typeof raw.item === 'string' && itemRefOf(raw.item) !== null ? { item: raw.item } : {}),
  ...(isContentKind(raw.create) ? { create: raw.create } : {}),
  ...(raw.panel === CONTENT_PANEL.PUBLISH ? { panel: CONTENT_PANEL.PUBLISH } : {}),
});

export const itemAddress = (item: { readonly kind: ContentKind; readonly key: string }): string => `${item.kind}/${item.key}`;
