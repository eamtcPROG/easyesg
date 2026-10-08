import { LOCALES, leafKeys, type Locale, type MessageCatalogue } from '@easyesg/i18n';
import { wordsFindingMessage } from '@easyesg/validation';
import en from '@easyesg/i18n/catalogues/en.json';
import ro from '@easyesg/i18n/catalogues/ro.json';
import ru from '@easyesg/i18n/catalogues/ru.json';

/**
 * The committed message catalogues, one per registered locale (OQ-43) — the release's own wording, as data.
 *
 * **Read here without the ICU engine**, which is what `catalogue.ts` builds over the same map: a question about which
 * keys a release words is asked where no engine was started — the seed loader publishes a validation rule set
 * through the configuration store's kind rule, and starts no catalogue (task 41.1).
 */
export const COMMITTED_CATALOGUES: Readonly<Record<Locale, MessageCatalogue>> = { ro, en, ru };

const leaves: ReadonlyMap<Locale, ReadonlySet<string>> = new Map(
  LOCALES.map((locale) => [locale, new Set(leafKeys(COMMITTED_CATALOGUES[locale]))]),
);

/**
 * Is `message` worded as a finding in every registered locale — **the three parts NFR-79 asks of it, each a leaf beneath
 * the key, and nothing else** (task 42; §12.5.6's task-42 row (2))? A rule names the node, never a part, and the
 * browser renders the three in order, so a key holding one sentence, or missing a part, is the gap this refuses: a
 * missing leaf renders nothing at runtime (UX-97), which publication is the last place to see (FR-73 item 8, 182/51).
 * A leaf holding a blank is not asked about here, because `packages/i18n`'s parity suite refuses one in every committed
 * catalogue (`blankKeys`).
 */
export const isWordedAsFindingInEveryLocale = (message: string): boolean =>
  LOCALES.every((locale) => wordsFindingMessage({ leaves: leaves.get(locale) ?? new Set(), message }));
