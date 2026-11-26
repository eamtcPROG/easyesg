import { Skeleton } from '@easyesg/ui';
import styles from '../../styles/home.module.css';

/**
 * `MembershipsSection`'s §8.1 `loading — initial`, in the rail card it resolves into (task 255).
 *
 * Two rows, which is the list's commonest length: UC-16's *view memberships* is most often one
 * organization, and the region that matters is the one where a reader holds two and cannot yet tell
 * which is active (task 83's switcher is what ends that). The eyebrow's bar sits above them as the
 * card draws it, inside the card's own insets, so what resolves changes the words and not the box.
 *
 * **Unlike `heading-loading.tsx`, it is observed.** `readMemberships` is the same memoized promise
 * the global tier awaits outside any boundary, so the data is ready the moment the shell can flush —
 * but the region's rows each await their own translators since task 128, and the shell goes out
 * before they have, so this is the markup it carries in their place. `e2e/web/home.spec.ts` counts it
 * among the boundaries still pending inside `<main>`.
 */
export function MembershipsLoading() {
  return (
    <div className={`${styles.card} ${styles.railCard}`}>
      <div className={styles.railCardInner}>
        <Skeleton className={styles.loadingEyebrow} />
        <div className={styles.loadingLines}>
          <Skeleton className={styles.loadingLong} />
          <Skeleton className={styles.loadingShort} />
        </div>
      </div>
    </div>
  );
}
