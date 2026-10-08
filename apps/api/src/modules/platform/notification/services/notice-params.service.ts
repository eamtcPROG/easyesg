import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@easyesg/i18n';
import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { paramsForLocale } from '../domain/notice-params';

/**
 * A notice's params in one reader's language (task 51.2) — `paramsForLocale` over the disclosure labels, so a field list
 * is named by the labels the wizard shows for the report's own taxonomy version (NFR-24's standing included).
 *
 * **One service for every rendering** — the centre at read, the email at send, A-17's specimen at preview — so a notice
 * cannot read one way in the centre and another in the inbox.
 */
@Injectable()
export class NoticeParamsService {
  constructor(@Inject(DISCLOSURE_LABELS) private readonly labels: DisclosureLabelResolver) {}

  forLocale(input: { readonly params: Readonly<Record<string, unknown>>; readonly locale: Locale }): Record<string, unknown> {
    return paramsForLocale({
      params: input.params,
      locale: input.locale,
      labelOf: ({ version, key }) => this.labels.label({ version, locale: input.locale, key })?.text ?? null,
    });
  }
}
