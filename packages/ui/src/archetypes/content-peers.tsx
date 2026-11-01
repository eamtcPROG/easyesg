import { Anchor, type NavLinkComponent } from '../navigation/nav-link';
import { ARIA_CURRENT } from '../navigation/nav-link-vocabulary';
import { ContentPeersScroll } from './content-peers-scroll';
import styles from './content-peers.module.css';

/**
 * The peer strip of a Content page that is one of a set (§4.6; task 74.2) — S-30's *Terms · Privacy · Cookies*, each
 * addressable, the page being read marked as current.
 *
 * **One row at every width, scrolled to the current page** where the row is wider than its room (`design_spec.md`
 * §4.6, resolved 9 Oct 2026). The scroll is `ContentPeersScroll`'s, a client leaf, so this strip is a Server Component
 * like the shell around it.
 *
 * **It builds its own anchors from data**, through the app's injected link where there is one (`nav-link.tsx`'s
 * reason): `aria-current` belongs on the interactive element, and a finished anchor handed in could only be wrapped.
 */
export interface ContentPeer {
  readonly key: string;
  readonly href: string;
  readonly label: string;
}

export interface ContentPeersProps {
  /** The set's name — *Legal documents* — which names the strip. */
  readonly label: string;
  readonly peers: readonly ContentPeer[];
  /** The page being read. */
  readonly currentKey: string;
  readonly linkComponent?: NavLinkComponent;
}

export function ContentPeers({ label, peers, currentKey, linkComponent: Link = Anchor }: ContentPeersProps) {
  return (
    <nav aria-label={label} className={styles.peers}>
      <ul className={styles.list}>
        {peers.map((peer) => (
          <li key={peer.key}>
            <Link
              href={peer.href}
              className={`t-label ${styles.peer}`}
              aria-current={peer.key === currentKey ? ARIA_CURRENT.PAGE : undefined}
            >
              {peer.label}
            </Link>
          </li>
        ))}
      </ul>
      <ContentPeersScroll />
    </nav>
  );
}
