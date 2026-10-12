import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@easyesg/i18n';
import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { ENTITY_FIELD_NAMES, type EntityFieldNames } from '@api/contracts/entity-field-names.port';
import { paramsForLocale } from '../domain/notice-params';

/**
 * A notice's params in one reader's language (task 51.2) — `paramsForLocale` over the disclosure labels, so a field list
 * is named by the labels the wizard shows for the report's own taxonomy version (NFR-24's standing included).
 *
 * **One service for every rendering** — the centre at read, the email at send, A-17's specimen at preview — so a notice
 * cannot read one way in the centre and another in the inbox.
 *
 * **A field the entity's record answers is named by the api's own word** (task 210) — the IDNO, which no version labels —
 * so an outstanding report's notice names it as S-08 does rather than leaving it out.
 */
@Injectable()
export class NoticeParamsService {
  constructor(
    @Inject(DISCLOSURE_LABELS) private readonly labels: DisclosureLabelResolver,
    @Inject(ENTITY_FIELD_NAMES) private readonly entityFields: EntityFieldNames,
  ) {}

  forLocale(input: { readonly params: Readonly<Record<string, unknown>>; readonly locale: Locale }): Record<string, unknown> {
    const entityFieldNames = this.entityFields.namesIn({ locale: input.locale });
    return paramsForLocale({
      params: input.params,
      locale: input.locale,
      labelOf: ({ version, key }) =>
        this.labels.label({ version, locale: input.locale, key })?.text ?? entityFieldNames[key] ?? null,
    });
  }
}
