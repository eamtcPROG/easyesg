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
const CATALOGUES: Readonly<Record<Locale, MessageCatalogue>> = {
  ro,
  en,
  ru,
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
