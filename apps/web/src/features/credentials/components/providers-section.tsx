'use client';

import { RecordSection } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { SECTION_READ } from '../tools/credentials';
import { CREDENTIALS_SECTION } from '../tools/credentials-state';
import { useCredentials } from './credentials-context';
import { ProvidersBody } from './providers-body';
import { SectionUnavailable } from './section-unavailable';

/**
 * S-28's linked accounts — UC-11 and UC-12.
 *
 * **Linking leaves by navigation, not by an action**, because it begins an OAuth round trip: the
 * button is an anchor to `/auth/social/{provider}/start?intent=link`, exactly as S-01's provider
 * buttons are. `ProviderButton` is the inventory component task 24 added for that, and reusing it
 * here is the whole of UX-89 — a second provider button on a settings screen would have been the
 * one-off it names.
 *
 * **The password is asked for on the way back, not on the way out** (§12.5.6's task-27.7 row), so
 * the confirmation below is a *state of this screen* rather than a step of the button. A reader who
 * abandons it has attached nothing: the code is spent only when the password completes it.
 *
 * BR-ID-4 is not mirrored here. The screen offers unlink on every linked provider and renders the
 * API's refusal when removing one would leave no credential — between a render and a click, a
 * password may have been set or removed, so the server's answer is the only authoritative one.
 */
export function ProvidersSection() {
  const t = useTranslations('identity.credentials.providers');
  const { read } = useCredentials();

  return (
    <RecordSection
      id={CREDENTIALS_SECTION.PROVIDERS}
      heading={t('heading')}
      description={t('description')}
    >
      {read.providers.status === SECTION_READ.READY ? (
        <ProvidersBody linked={read.providers.value} />
      ) : (
        <SectionUnavailable />
      )}
    </RecordSection>
  );
}
