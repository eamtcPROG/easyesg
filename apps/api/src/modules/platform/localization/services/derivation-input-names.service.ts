import { Injectable } from '@nestjs/common';
import { leafKeys, type Locale } from '@easyesg/i18n';
import { derivationInputField } from '@easyesg/validation';
import { COMMITTED_CATALOGUES } from '@api/app/messages/committed-catalogues';
import { translate } from '@api/app/messages/catalogue';
import type { DerivationInputNames } from '@api/contracts/derivation-input-names.port';

/** Where the names sit in the committed catalogues — the PDF's and S-07's own (task 80.3), so all three say one name. */
const NAMESPACE = 'core.export.document.inputs';

/**
 * `DerivationInputNames` over the committed catalogues (task 254) — the name S-07 gives each input's box, which S-08,
 * S-11 and a notice's field list show for a finding on it. **The keys are the catalogue's own leaves**, since which
 * inputs exist is the derivation artefact's (AD-4) and a list here would be a third copy; the artefact spec holds every
 * input it publishes worded in every locale. A name some locale does not word is left out rather than shown as a key
 * (UX-97).
 */
@Injectable()
export class DerivationInputNamesService implements DerivationInputNames {
  namesIn(query: { readonly locale: Locale }): Readonly<Record<string, string>> {
    const prefix = `${NAMESPACE}.`;
    return Object.fromEntries(
      leafKeys(COMMITTED_CATALOGUES[query.locale])
        .filter((key) => key.startsWith(prefix))
        .flatMap((key) => {
          const name = translate(query.locale, key);
          return name === undefined ? [] : [[derivationInputField(key.slice(prefix.length)), name] as const];
        }),
    );
  }
}
