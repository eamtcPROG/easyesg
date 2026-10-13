import { CALLOUT_INTENT, Callout, ContentShell } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { LegalDocument } from '../../tools/legal-documents';
import { LegalPeers } from './legal-peers';

/**
 * A document whose operator could not be read (task 75) — the Content archetype's *error — recoverable*: the frame
 * kept, with the title the page knows without its text and the set's peers, and a callout in the text's place, so the
 * reader still knows where they are and can reach the other two. **In `shared/` because the terms and the privacy
 * notice both answer with it.** None in force is not this state; it is *not yet available* (`legal-controller-read.ts`).
 */
export async function LegalUnavailable({ document }: { readonly document: LegalDocument }) {
  const [tSet, t] = await Promise.all([getTranslations('legal'), getTranslations('legal.unavailable')]);

  return (
    <ContentShell
      eyebrow={tSet('set.eyebrow')}
      title={tSet(`documents.${document}`)}
      peers={<LegalPeers current={document} />}
    >
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('title')} action={null}>
        {t('body')}
      </Callout>
    </ContentShell>
  );
}
