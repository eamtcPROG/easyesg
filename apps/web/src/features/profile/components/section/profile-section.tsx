import { readProfile } from '@/server/data/profile';
import { ProfileForm } from '../form/profile-form';
import { ProfileUnreachable } from '../states/profile-unreachable';
import styles from '../styles/profile.module.css';

/**
 * S-27's one region: the read and which of §8.1's arms applies (task 52.3; UC-13, UC-14, UC-168).
 *
 * **The section reads; the parts render** — it resolves no string. Two arms only: the profile is the reader's own, so
 * there is no permission state — an account reaches its own profile or has no session, which the proxy answers before
 * this renders — and a read that failed is `error — recoverable`, the whole screen, for `readProfile`'s reason.
 */
export async function ProfileSection() {
  const record = await readProfile();

  return <div className={styles.screen}>{record === null ? <ProfileUnreachable /> : <ProfileForm record={record} />}</div>;
}
