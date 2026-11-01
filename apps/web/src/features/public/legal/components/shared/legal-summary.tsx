import { ContentSection } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

/** Where the contents list sends a reader to the summary — the same address in every document of the set. */
export const LEGAL_SUMMARY_ID = 'summary';

/**
 * A document's plain-language summary, above its formal text (FR-205 behaviour 2, AC-4; `design_spec.md` S-30) — its
 * own section, unnumbered because it is not part of the text it summarises. **In `shared/` because every document of
 * the set draws it**; the points are the document's own.
 */
export async function LegalSummary({ children }: { readonly children: ReactNode }) {
  const t = await getTranslations('legal.summary');
  return (
    <ContentSection id={LEGAL_SUMMARY_ID} heading={t('heading')}>
      {children}
    </ContentSection>
  );
}
