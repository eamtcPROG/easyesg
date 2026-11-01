import styles from './document-shell.module.css';

/** One page a document forces — its anchor in the document, what it is called, and a module's reference beside it. */
export interface DocumentPage {
  /** The page's anchor in the document. */
  readonly id: string;
  readonly label: string;
  /** A module's reference, shown beside its name and left out of the link's name. */
  readonly reference?: string;
}

/**
 * The pages a document forces, each a link that opens it in the frame (§4.6; task 43.2) — *paginate*, on a document
 * whose pages are the ones it forces (`architecture.md` §12.5.6's task-43 row (2)). **Plain anchors with a `target`**,
 * not the router's links: the frame is what navigates, to an anchor of the document already loaded in it, and the
 * screen around it stays where it is. **A Server Component**: nothing here needs the browser.
 */
export function DocumentPages(props: {
  /** The list's name — what the navigation is announced as. */
  readonly label: string;
  /** The document's address, which each page's anchor is appended to. */
  readonly document: string;
  /** The frame's name, which each link opens its page in. */
  readonly frame: string;
  readonly pages: readonly DocumentPage[];
}) {
  return (
    <nav aria-label={props.label} className={styles.pages}>
      <ol className={styles.pageList}>
        {props.pages.map((page) => (
          <li key={page.id}>
            <a className={styles.page} href={`${props.document}#${page.id}`} target={props.frame}>
              {page.reference === undefined ? null : (
                <span className={styles.reference} aria-hidden="true">
                  {page.reference}
                </span>
              )}
              {page.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
