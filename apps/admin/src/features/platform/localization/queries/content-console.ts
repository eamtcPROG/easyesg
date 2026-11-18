import { queryOptions } from '@tanstack/react-query';
import type {
  ApiOutcome,
  ContentConsole,
  ContentDraft,
  ContentItemsRequest,
  ContentKind,
  ContentPublication,
  ContentPublicationPreview,
  ContentVersion,
  LocaleRegistrationRequest,
  PublishContentRequest,
  SaveContentDraftRequest,
} from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { api } from '~/realm/api/api-client';

/**
 * A-03's read, its preview and its writes (task 67.5), through the realm's one client — the outcome the answer, not a
 * thrown error, A-17's arrangement. **No poll** (UX-116): a write invalidates the key, and every write the api judges
 * against what it holds, whatever this cache says.
 */
export const CONTENT_CONSOLE_QUERY_KEY = ['admin', 'content'] as const;

export const contentConsoleQuery = () =>
  queryOptions({
    queryKey: CONTENT_CONSOLE_QUERY_KEY,
    queryFn: () => api.get<ContentConsole>('/admin/content'),
  });

export interface ContentItemRef {
  readonly kind: ContentKind;
  readonly key: string;
}

const itemPath = (item: ContentItemRef) =>
  `/admin/content/${encodeURIComponent(item.kind)}/${encodeURIComponent(item.key)}`;

export const saveContentDraft = (input: ContentItemRef & { readonly payload: Record<string, unknown> }) =>
  api.put<SaveContentDraftRequest, ContentDraft>(`${itemPath(input)}/draft`, { payload: input.payload });

export const submitContentDraft = (item: ContentItemRef): Promise<ApiOutcome<ContentDraft>> =>
  api.post<undefined, ContentDraft>(`${itemPath(item)}/draft/submission`, undefined);

export const discardContentDraft = (item: ContentItemRef): Promise<ApiOutcome<{ readonly id: string }>> =>
  api.delete<undefined, { readonly id: string }>(`${itemPath(item)}/draft`);

export const revertContentItem = (item: ContentItemRef): Promise<ApiOutcome<ContentVersion>> =>
  api.post<undefined, ContentVersion>(`${itemPath(item)}/reversion`, undefined);

export const previewContentPublication = (items: readonly ContentItemRef[]) =>
  api.post<ContentItemsRequest, ContentPublicationPreview>('/admin/content/publication/preview', { items: [...items] });

export const publishContentSet = (input: {
  readonly items: readonly ContentItemRef[];
  readonly signedOff: readonly Locale[];
}) =>
  api.post<PublishContentRequest, ContentPublication>('/admin/content/publication', {
    items: [...input.items],
    signedOff: [...input.signedOff],
  });

export const publishLocaleRegistration = (input: { readonly codes: readonly Locale[]; readonly expectedRevision: number }) =>
  api.put<LocaleRegistrationRequest, ContentVersion>('/admin/content/locale-registration', {
    codes: [...input.codes],
    expectedRevision: input.expectedRevision,
  });
