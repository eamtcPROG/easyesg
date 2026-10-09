import styles from './content-contents.module.css';

/**
 * A Content page's *On this page* list (§4.6: *"heading hierarchy as the navigation"*; task 74.2) — each
 * `ContentSection` by its id and its heading's words, numbered as the legal set's artboards number them.
 *
 * **Docked beside the text at `wide`, a closed disclosure above it below** (`design_spec.md` §4.6, resolved 9 Oct
 * 2026) — the move S-07's module list makes. Both forms are drawn and a media query shows one, so the list is built by
 * a function called twice rather than one element placed twice; whichever is hidden is `display: none` and leaves the
 * accessibility tree with it. **The disclosure is a native `<details>`**, so the archetype stays a Server Component —
 * the one §14.2 lets the framework cache — and it opens and closes with no script.
 *
 * It places itself in the shell's `contents` area, so where it sits among the shell's children does not decide where
 * it renders.
 *
 * **It marks no reading position.** The legal artboard tints the first entry, which is what an observer of the
 * scroll would maintain; that is behaviour the prototype draws one frame of, and it would make this list a client
 * component on the archetype that must not need one.
 */
export interface ContentContentsSection {
  /** The `ContentSection`'s id. */
  readonly id: string;
  /** Its heading's words. */
  readonly label: string;
}

export interface ContentContentsProps {
  /** *On this page* — the list's name, and the disclosure's summary. */
  readonly label: string;
  readonly sections: readonly ContentContentsSection[];
}

export function ContentContents({ label, sections }: ContentContentsProps) {
  const list = () => (
    <ol className={styles.list}>
      {sections.map((section, index) => (
        <li key={section.id}>
          <a href={`#${section.id}`} className={styles.link}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <span>{section.label}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className={styles.contents}>
      <nav aria-label={label} className={styles.docked}>
        {/* The name is the `nav`'s; the label is what the eye reads, so it is not read twice. */}
        <p className={styles.label} aria-hidden="true">
          {label}
        </p>
        {list()}
      </nav>
      <details className={styles.disclosure}>
        <summary className={`t-label ${styles.summary}`}>{label}</summary>
        <nav aria-label={label}>{list()}</nav>
      </details>
    </div>
  );
}
