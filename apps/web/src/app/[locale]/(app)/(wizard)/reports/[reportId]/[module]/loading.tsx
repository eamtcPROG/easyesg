import { getTranslations } from 'next-intl/server';
import { Panel, Spinner } from '@easyesg/ui';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';


/**
 * The screen's **loading — initial** (§8.1, UX-90), on S-16's precedent: the whole body blocks on
 * one read, so there is no shell worth streaming ahead of it and a route-level `loading.tsx` is
 * the boundary. The heading is the real one, so nothing shifts when the content arrives. **No
 * `activateRequestLocale` here** — Next passes `loading.tsx` no props, so messages resolve through
 * `requestLocale` alone, which is correct only while `[locale]` declares `force-dynamic`
 * (`apps/web/CLAUDE.md` names this file kind as the first to check when §14.2's decision is taken).
 */
export default async function ReportModuleStepLoading() {
  const t = await getTranslations(WIZARD_MESSAGES);

  return (
    <div>
      <hgroup>
        <h1 className="t-heading-1">{t('title')}</h1>
      </hgroup>
      <Panel>
        <p className="t-body" role="status">
          <Spinner /> {t('loading')}
        </p>
      </Panel>
    </div>
  );
}
