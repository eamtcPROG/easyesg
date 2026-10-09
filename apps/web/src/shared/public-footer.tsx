import { SiteFooter } from './site-footer';
import styles from './public-footer.module.css';

/**
 * The public footer (task 74.1's other half; `architecture.md` §12.5.6's task-74 row, item (1)) — `SiteFooter`'s note
 * and legal links in the band the Public Home artboard draws under every public page: the default surface, a rule
 * above, the note at one end and the links at the other.
 *
 * **It carries what renders.** The artboard's footer also holds product and support columns and a language choice;
 * those lead to S-29's sections, the help centre and a status page, none of which exists yet, so they wait for their
 * screens as the public header's sections did (OQ-10: a prototype governs values, never scope). The language choice
 * is already on the band above.
 *
 * **A frame of its own rather than `WorkspaceFooter`**, because the two artboards draw different bands around the same
 * content — the workspace's 56px rule, the public pages' deeper one — and a flag choosing between them is the boolean
 * UX-89 names. It owns the `<footer>` element and `SiteFooter` the content, as `FocusShell` does for the identity
 * screens: one `contentinfo` landmark per page.
 *
 * Its links answer §8.1's *not yet available* (task 103) until task 75 publishes the documents, as they already do from
 * the identity and workspace screens.
 */
export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <SiteFooter />
    </footer>
  );
}
