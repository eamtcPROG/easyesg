import 'server-only';
import type { Locale, MessageCatalogue, MessageLoader } from '@easyesg/i18n';
import { env } from '@/lib/env';

/**
 * The `MessageLoader` adapter — the seam between next-intl and the configuration store.
 *
 * Wording is versioned configuration published from the administrative console (FR-61, FR-62),
 * reaching production within a working day of approval and revertible in one step (NFR-85). A
 * `messages/*.json` in this repo would need a release to change, which is that requirement
 * inverted. next-intl is agnostic about message storage, which is why it can sit here at all.
 *
 * **Fallback is resolved server-side, not here.** `platform/localization` holds the source
 * catalogue and already logs per-key fallback into the review queue (FR-64), so the response is
 * a complete catalogue for the requested locale. That is what lets UX-97 hold — the user sees
 * the fallback *undecorated*, because by the time it reaches the browser it is simply the string.
 */
export const messageLoader: MessageLoader = {
  async load(locale: Locale): Promise<MessageCatalogue> {
    let response: Response;
    try {
      response = await fetch(`${env.apiBaseUrl}/platform/localization/catalogue/${locale}`, {
        headers: { accept: 'application/json' },
      });
    } catch (cause) {
      return emptyCatalogueWhileUnbuilt(locale, 'the API is unreachable', cause);
    }

    if (response.status === 404) {
      return emptyCatalogueWhileUnbuilt(locale, 'the endpoint does not exist yet');
    }

    if (!response.ok) {
      throw new Error(`Failed to load the "${locale}" message catalogue: ${response.status}`);
    }

    return (await response.json()) as MessageCatalogue;
  },
};

/**
 * SCAFFOLD ONLY — delete this function, and both of its call sites, in the first localization
 * sprint.
 *
 * `platform/localization` is one of the 35 registered-but-empty modules in `apps/api`, so the
 * catalogue route does not exist and there is no copy for it to serve. Returning an empty
 * catalogue is what lets `pnpm build` prerender the public shell without a running API.
 *
 * It is **not** a fallback strategy and must not become one. Once the endpoint ships, an
 * unreachable API at build time should fail the build and at request time should surface an
 * error — a page silently rendered with no words is worse than a page that says it broke
 * (NFR-79). The loud log is here so this cannot quietly outlive its purpose.
 */
function emptyCatalogueWhileUnbuilt(
  locale: Locale,
  reason: string,
  cause?: unknown,
): MessageCatalogue {
  console.warn(
    `[i18n] SCAFFOLD: rendering "${locale}" with an empty catalogue because ${reason}. ` +
      'Remove src/server/messages.ts#emptyCatalogueWhileUnbuilt once platform/localization ships.',
    cause ?? '',
  );
  return {};
}
