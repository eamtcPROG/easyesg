import type { ReactNode } from 'react';
import { WorkspaceNavigation } from '@/shared/workspace-navigation';
import styles from './layout.module.css';

/**
 * Screens that carry the **workspace** navigation tier (§4.2): Reports, Entities & periods,
 * Organization, Users & access, Plan & billing.
 *
 * This route group exists to express UX-5. The wizard suppresses this tier and replaces it with
 * the module list, so the wizard cannot nest inside this layout - it is a sibling group,
 * `(wizard)`, over the same URL space. Route groups add no path segment, which is what lets
 * `/reports` and `/reports/:id/:module` sit under different layout ancestries without either
 * one knowing about the other.
 *
 * **It mounts no message provider since task 99**, and the paragraphs that used to be here
 * explained one at length. The root layout provides the catalogue once, for every route group;
 * `architecture.md` §12.5.6 records why fifteen scoped providers were fewer than one.
 *
 * `forms` — the reveal-toggle labels every password field needs — remains a top-level namespace
 * rather than a fragment of `identity.register`, which is the part of that history worth keeping:
 * `packages/ui` owns no text (UX-79), so the app supplies those two words, and they belong to no
 * screen.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {

  return (
    <>
      {/* The tier itself is `packages/ui`'s WorkspaceNav, wired in `shared/` — task 26.4 built it
          because S-16 was the first screen in this group and had no way to be reached. Task 30.1
          added the global tier above it; the nav stays OUTSIDE the `<main>` below, which is why
          that element is here rather than in the `(app)` layout — a layout cannot place a wrapper
          around only part of a nested layout's output. */}
      <WorkspaceNavigation />
      {/*
        `<main>` since task 30.1, and it does two things rather than one.

        It gives every workspace screen the landmark 2.4.1's bypass-blocks technique relies on —
        the global tier is a `banner` now, and a page with chrome and no main is where a
        screen-reader user has nothing to skip TO. And it repairs a duplicate this task would
        otherwise have created: `<header>` maps to `banner` unless it descends from `article`,
        `aside`, `main`, `nav` or `section`, and `RecordShell` renders one — so S-28 would have had
        two banners the moment a real one appeared above it. Nesting is the fix the HTML spec
        itself names; changing `RecordShell` would have treated the symptom.
      */}
      <main className={styles.main}>{children}</main>
    </>
  );
}
