import type { DisclosureModuleSummary, ReportScope } from '@easyesg/contracts';
import { isLocale, type Locale } from '@easyesg/i18n';
import type { DocumentPage } from '@easyesg/ui';
import { modulesInScope } from '@/features/wizard/tools/module-state';

/**
 * S-10's rules, pure (task 43.2) — which language the preview is in, where the document is, and which pages it has.
 */

/** The frame's name, which the page list opens each page in. */
export const PREVIEW_FRAME = 'report-document';

/**
 * The language the document is in: the one the address asks for where it names a language the platform publishes in,
 * else the account's export default (182/34), else the reader's own.
 */
export function previewLanguage(input: {
  readonly asked: string | readonly string[] | undefined;
  readonly exportDefault: Locale | null;
  readonly reader: Locale;
}): Locale {
  const asked = typeof input.asked === 'string' ? input.asked : undefined;
  if (asked !== undefined && isLocale(asked)) return asked;
  return input.exportDefault ?? input.reader;
}

/**
 * The document, through the session pass-through (AD-9): the api's rendering in one language (`architecture.md`
 * §12.5.6's task-43 row (1)). Same-origin, so the frame carries the session and the access token stays on the server.
 */
export const documentAddress = (input: { readonly reportId: string; readonly locale: Locale }): string =>
  `/api/v1/reports/${input.reportId}/preview?locale=${input.locale}`;

/** The pages the document forces that are not a module's, in the document's own order around the modules. */
export const PREVIEW_PAGE = {
  COVER: 'cover',
  CONTENTS: 'contents',
  OMISSIONS: 'omissions',
  PROVENANCE: 'provenance',
} as const;

export type PreviewPage = (typeof PREVIEW_PAGE)[keyof typeof PREVIEW_PAGE];

/**
 * The document's pages, in the order it prints them — the cover, the contents, the omissions and findings, one per
 * module the report's scope asks, the provenance (UX-117) — each by its anchor in the document. The modules are
 * `modulesInScope`'s, the wizard's one list, which is the list the document prints a page for.
 */
export function documentPages(input: {
  readonly modules: readonly DisclosureModuleSummary[];
  readonly scope: ReportScope;
  readonly pageName: (page: PreviewPage) => string;
  readonly moduleName: (module: string) => string;
}): readonly DocumentPage[] {
  const page = (id: PreviewPage): DocumentPage => ({ id, label: input.pageName(id) });
  return [
    page(PREVIEW_PAGE.COVER),
    page(PREVIEW_PAGE.CONTENTS),
    page(PREVIEW_PAGE.OMISSIONS),
    ...modulesInScope({ modules: input.modules, scope: input.scope }).map(({ module }) => ({
      id: module,
      label: input.moduleName(module),
      reference: module,
    })),
    page(PREVIEW_PAGE.PROVENANCE),
  ];
}
