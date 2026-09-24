import { getTranslations } from 'next-intl/server';
import { Panel, RecordShell, Spinner } from '@easyesg/ui';
import { ScriptingRequired } from '@/shared/scripting-required';

/**
 * S-28's **loading — initial** (§8.1, UX-90; task 137), on S-16's precedent: the whole body waits on the section's two
 * reads, so a route-level boundary is the one there is. The Record's own title and summary are the real ones, so
 * nothing shifts when the sections arrive. **No `activateRequestLocale` here** — Next passes `loading.tsx` no props,
 * so messages resolve through `requestLocale` alone, correct only while `[locale]` declares `force-dynamic`.
 *
 * **It carries the scripting notice** (task 153's rule, reaching a route that gained a boundary): behind one, Next
 * sends this fallback first and streams the sections into hidden markup a script swaps in, so a browser with scripting
 * off shows this, for good — and the password form's own `<noscript>` never reaches it. The browser suite found it.
 */
export default async function CredentialsLoading() {
  const t = await getTranslations('identity.credentials');

  return (
    <RecordShell title={t('title')} summary={t('lede')}>
      <ScriptingRequired />
      <Panel>
        <p className="t-body" role="status">
          <Spinner /> {t('loading')}
        </p>
      </Panel>
    </RecordShell>
  );
}
