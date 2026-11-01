import type {
  Locale,
  MessageKeys,
  Messages,
  NamespaceKeys,
  NestedKeyOf,
} from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/**
 * The per-page locale ritual, declared once.
 *
 * Every page under `[locale]` used to open with the same four lines — a `Props` type
 * asserting the param is a `Locale`, `await params`, `setRequestLocale`, and a
 * `generateMetadata` that resolved the same namespace again for the tab title. Five screens in,
 * that was eleven copies of the same knowledge (post-task-22 review, 21 Aug 2026). This module
 * is the one place it lives now.
 *
 * **What deliberately cannot move here: the call itself.** Next renders layouts and pages in
 * parallel, so a `setRequestLocale` in `[locale]/layout.tsx` does not reach its pages —
 * next-intl requires the call in every layout AND page it should cover. The ritual is
 * definable once; the invocation is one line per page, and that line is the floor. The calls
 * are kept (rather than leaning on `force-dynamic` making them redundant today) because
 * un-forcing `(public)`/`(identity)` is §14.2's own open caching decision, and removing its
 * precondition in a DRY pass would close that decision in passing.
 *
 * `Locale` here is next-intl's, already narrowed to the registry union by `global.d.ts`'s
 * `AppConfig` — the claim is sound at runtime because `[locale]/layout.tsx` 404s anything
 * `hasLocale` rejects before a page runs.
 */
export type LocaleParams = Promise<{ locale: Locale }>;

/** Awaits the segment and pins it for this render's next-intl server APIs. */
export async function activateRequestLocale(params: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  setRequestLocale(locale);
  return locale;
}

type Namespace = NamespaceKeys<Messages, NestedKeyOf<Messages>>;
type CatalogueLeaf = MessageKeys<Messages, NestedKeyOf<Messages>>;

/**
 * Namespaces whose catalogue block carries a `title` leaf — the only ones a page may name
 * here, so a namespace without one fails `pnpm typecheck` at the call site rather than
 * rendering an untitled tab.
 *
 * Membership is checked POSITIVELY (`${N}.title` among the leaf paths) and not as
 * `NestedValueOf<…> extends string`: a missing path resolves to `never`, and `never extends
 * string` is true, which made the first draft of this constraint accept every namespace —
 * found by probing the negative case, exactly the "a rule that matches nothing looks like a
 * rule that passes" failure the boundary gates are built around.
 */
type TitledNamespace = {
  [N in Namespace]: `${N}.title` extends CatalogueLeaf ? N : never;
}[Namespace];

/**
 * The whole `generateMetadata` for the common case — WCAG 2.2 AA 2.4.2 (Page Titled): the tab
 * names the task, from the same namespace the screen renders.
 *
 *     export const generateMetadata = localizedPageTitle('identity.signIn');
 *
 * The locale is passed to `getTranslations` explicitly because `generateMetadata` runs outside
 * the page render, where `setRequestLocale`'s pin does not reach. A title that needs ICU
 * params has outgrown this helper — that page writes its own `generateMetadata`.
 */
export function localizedPageTitle(namespace: TitledNamespace) {
  return async ({ params }: { params: LocaleParams }): Promise<{ title: string }> => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace });
    return { title: t('title') };
  };
}
