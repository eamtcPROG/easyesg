import { ContentPeers } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LEGAL_DOCUMENT, legalDocumentHref, type LegalDocument } from '../../tools/legal-documents';

/**
 * The legal set's peer strip (FR-205 AC-3; UC-178: a reader at any of the three can reach the other two) — the three
 * documents by name, the one being read marked as current, through the app's own link so the locale prefix holds.
 *
 * **In `shared/` because every document of the set draws it** — the cookie policy since task 75.3, the terms and the
 * privacy notice when their text arrives (75.4).
 */
export async function LegalPeers({ current }: { readonly current: LegalDocument }) {
  const t = await getTranslations('legal');
  return (
    <ContentPeers
      label={t('set.peers')}
      currentKey={current}
      linkComponent={Link}
      peers={Object.values(LEGAL_DOCUMENT).map((document) => ({
        key: document,
        href: legalDocumentHref(document),
        label: t(`documents.${document}`),
      }))}
    />
  );
}
