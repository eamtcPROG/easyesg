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
 * **Like `heading-loading.tsx`, it is defined rather than observed.** `readMemberships` is the same
 * memoized promise the global tier awaits outside any boundary, so the shell has this region's
 * content the moment it can flush at all. See that file for the measurement and for why the state is
 * still worth having.
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
