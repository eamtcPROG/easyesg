'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './document-shell.module.css';

/**
 * The frame a rendered document is shown in (§4.6; task 43.2), and its one piece of client code: it says the document
 * is being assembled — S-10's *pending — async* — until the frame has loaded it.
 *
 * **A sandbox admitting same-origin access and nothing else**: no script runs in the document, it submits nothing and
 * navigates nothing outside itself, while `DocumentPages`' anchors can still move it. The document is the api's static
 * markup, which carries no script either (`architecture.md` §12.5.6's task-43 row (1)); the sandbox is what holds if
 * that ever stopped being true.
 *
 * **A document that loaded before this hydrated is noticed on mount**, from the frame's own state — the server's
 * markup starts the load, and a `load` event fired before React attached its handler would otherwise leave the
 * pending state up for good.
 */
/** What a frame's own document says of itself, as the mount reads it. Internal to this file. */
const FRAMED = { LOADED: 'complete', NOTHING_YET: 'about:blank' } as const;

export function DocumentFrame(props: {
  readonly src: string;
  /** The frame's name — what `DocumentPages` opens a page in. */
  readonly name: string;
  /** What the frame holds, as assistive technology announces it. */
  readonly title: string;
  /** What is said while the document is assembled. */
  readonly pending: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const document = frame.current?.contentDocument;
    if (document?.readyState === FRAMED.LOADED && document.URL !== FRAMED.NOTHING_YET) setLoaded(true);
  }, []);

  return (
    <>
      {loaded ? null : (
        <p role="status" className={styles.pending}>
          {props.pending}
        </p>
      )}
      <iframe
        ref={frame}
        className={styles.frame}
        src={props.src}
        name={props.name}
        title={props.title}
        sandbox="allow-same-origin"
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}
