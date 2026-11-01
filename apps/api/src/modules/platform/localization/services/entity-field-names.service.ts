import { Injectable } from '@nestjs/common';
import type { Locale } from '@easyesg/i18n';
import { ENTITY_FIELD, type EntityField } from '@easyesg/validation';
import { translate } from '@api/app/messages/catalogue';
import type { EntityFieldNames } from '@api/contracts/entity-field-names.port';

/** Where the names sit in the committed catalogues (row (e)). */
const NAMESPACE = 'core.validation.entity_fields';

/** Each field's leaf — a field added to the vocabulary with no name here fails `pnpm typecheck`. */
const LEAF = { [ENTITY_FIELD.IDNO]: 'idno' } as const satisfies Record<EntityField, string>;

/**
 * `EntityFieldNames` over the committed catalogues (task 210) — the name S-13 gives each field, which S-08, S-11 and a
 * notice's field list show for a finding on it. A name some locale does not word is left out rather than shown as a
 * key (UX-97), and `entity-field-names.service.spec.ts` holds every one worded in every locale.
 */
@Injectable()
export class EntityFieldNamesService implements EntityFieldNames {
  namesIn(query: { readonly locale: Locale }): Readonly<Record<string, string>> {
    return Object.fromEntries(
      Object.values(ENTITY_FIELD).flatMap((field) => {
        const name = translate(query.locale, `${NAMESPACE}.${LEAF[field]}`);
        return name === undefined ? [] : [[field, name] as const];
      }),
    );
  }
}
