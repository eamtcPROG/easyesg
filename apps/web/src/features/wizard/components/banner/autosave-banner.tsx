import { SetAsideBanner } from './set-aside-banner';
import { UnsyncedBanner } from './unsynced-banner';

/**
 * S-07's and S-09's banners about what is not on the record (UX-37; task 35.2) — what has not reached the api, and
 * since task 218 what the api refused for each write's own sake. **Two banners, because they ask two things**: the
 * first waits or retries, the second names a field to change or a change to let go, and the two can stand at once.
 */
export function AutosaveBanner() {
  return (
    <>
      <UnsyncedBanner />
      <SetAsideBanner />
    </>
  );
}
