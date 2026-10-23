import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { LEGAL_STANDING, type LegalDocument } from '@easyesg/i18n';

/**
 * A document published before counsel has approved it says so, above its summary (FR-205 behaviour 10, AC-14;
 * `architecture.md` §12.5.6's task-75 row (6)) — and says nothing once the release that carries the approved text
 * drops the marking. **In `shared/` because every document of the set draws it.**
 */
export async function LegalProvisional({ document }: { readonly document: LegalDocument }) {
  if (!LEGAL_STANDING[document].provisional) return null;
  const t = await getTranslations('legal.provisional');

  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
