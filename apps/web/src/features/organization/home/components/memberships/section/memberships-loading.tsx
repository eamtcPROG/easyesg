import { Panel, Skeleton, SKELETON_SHAPE } from '@easyesg/ui';
import styles from '../../styles/home.module.css';

/**
 * `MembershipsSection`'s §8.1 `loading — initial`.
 *
 * Two rows, which is the list's commonest length: UC-16's *view memberships* is most often one
 * organization, and the region that matters is the one where a reader holds two and cannot yet tell
 * which is active (task 83's switcher is what ends that). The heading and lede bars sit above them
 * as the real region draws them.
 *
 * **Unlike `heading-loading.tsx`, it is observed.** `readMemberships` is the same memoized promise
 * the global tier awaits outside any boundary, so the data is ready the moment the shell can flush —
 * but the region's rows each await their own translators since task 128, and the shell goes out
 * before they have, so this is the markup it carries in their place. `e2e/web/home.spec.ts` counts it
 * among the boundaries still pending inside `<main>`. This paragraph said *defined rather than
 * observed* until task 159, having outlived task 128.
 */
export function MembershipsLoading() {
  return (
    <Panel>
      <Skeleton shape={SKELETON_SHAPE.HEADING} className={styles.loadingHeading} />
      <Skeleton className={styles.loadingLede} />
      <div className={styles.loadingRows}>
        <Skeleton shape={SKELETON_SHAPE.BLOCK} />
        <Skeleton shape={SKELETON_SHAPE.BLOCK} />
      </div>
    </Panel>
  );
}
