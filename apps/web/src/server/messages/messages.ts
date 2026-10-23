import 'server-only';
import {
  EXPANSION_FLAG,
  expandCatalogue,
  expansionEnabled,
  type Locale,
  type MessageCatalogue,
  type MessageLoader,
} from '@easyesg/i18n';
import ro from '@/messages/ro.json';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import sharedRo from '@easyesg/i18n/catalogues/ro.json';
import sharedEn from '@easyesg/i18n/catalogues/en.json';
import sharedRu from '@easyesg/i18n/catalogues/ru.json';

/**
 * The `MessageLoader` adapter — the seam between next-intl and wherever text comes from.
 *
 * Catalogue text ships in the release as committed message files (architecture.md OQ-43, closed
 * 19 Aug 2026). The line is who is blocked waiting on one: a developer editing a catalogue is
 * not, and it is the faster path for them; support fixing a help-centre article and marketing
 * renaming a plan are, so that content stays versioned configuration (FR-61, FR-62) and reaches
 * production without a release (NFR-85).
 *
 * Three things follow from bundling, and they are the reason it is worth doing:
 *
 * - **A gap cannot ship.** Every locale is present at build time, so a key in `ro.json` and
 *   missing from `en.json` fails `messages.parity.spec.ts` (FR-64 as amended). The runtime
 *   fallback queue stays for FR-61 content, where a translation genuinely is absent until
 *   someone authors it.
 * - **Text survives an outage.** An unreachable API degrades help articles and plan copy; every
 *   screen still renders, including the error page that has to explain the outage (NFR-79).
 * - **Keys are typed.** `global.d.ts` derives `IntlMessages` from the Romanian catalogue, so a
 *   key that does not exist is a typecheck failure rather than a blank on a screen.
 *
 * This stays a port rather than a bare import because `MessageLoader` is what lets FR-61 content
 * join the catalogue later without touching a call site — the cheap direction of OQ-43.
 */
/**
 * **One namespace this app reads from the shared committed catalogue rather than its own: `validation`** (task 42.1;
 * `architecture.md` §12.5.6's task-42 row (2)). A finding's wording is the api's publication rule's as much as this
 * screen's — a rule set is refused unless every locale words its messages in NFR-79's three parts there — and the
 * browser evaluates findings live, so it words them itself. Read from `packages/i18n` beside this app's own, never
 * copied into `src/messages`: a copy would be a second wording free to drift from the one publication checks.
 *
 * **And a second, `vocabulary`** (task 84; §12.5.6's task-84 row (e)): the words of the closed vocabularies a record
 * stores — legal forms, countries, consolidation bases, an entity's standing — which S-12's change history words on the
 * api as well. They moved out of this app's `organization` namespace rather than being copied into the api's, for the
 * same reason.
 *
 * **And a third, `reportModules`** (task 74.3): the names of the modules a report holds, as the exported report prints
 * them — the shared catalogue's `core.export.document.modules`, under a name of its own because `core` is the api's
 * namespace and most of it is nothing this app reads. S-29 names the eleven Basic sections to a visitor; a second
 * wording here would let the home promise a section the report then calls something else.
 */
const CATALOGUES: Readonly<Record<Locale, MessageCatalogue>> = {
  ro: {
    ...ro,
    validation: sharedRo.validation,
    vocabulary: sharedRo.vocabulary,
    reportModules: sharedRo.core.export.document.modules,
  },
  en: {
    ...en,
    validation: sharedEn.validation,
    vocabulary: sharedEn.vocabulary,
    reportModules: sharedEn.core.export.document.modules,
  },
  ru: {
    ...ru,
    validation: sharedRu.validation,
    vocabulary: sharedRu.vocabulary,
    reportModules: sharedRu.core.export.document.modules,
  },
};

/**
 * The +40% expansion harness (UX-94), wired at Phase 0 and run at the end of every phase —
 * retrofitting it after twenty screens finds the same class of bug twenty times. Off unless
 * `EASYESG_PSEUDOLOCALE=1`, and `expansionEnabled` refuses anything but `'1'` so a stray
 * `=false` cannot pad every label in production.
 */
const PSEUDOLOCALE = expansionEnabled(process.env[EXPANSION_FLAG]);

export const messageLoader: MessageLoader = {
  load(locale: Locale): Promise<MessageCatalogue> {
    const catalogue = CATALOGUES[locale];
    return Promise.resolve(PSEUDOLOCALE ? expandCatalogue(catalogue) : catalogue);
  },
};
