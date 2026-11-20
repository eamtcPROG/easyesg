import { Injectable, Logger } from '@nestjs/common';
import { SOURCE_LOCALE, offeredLocales, readLocaleRegistration, type Locale } from '@easyesg/i18n';
import {
  LOCALE_REGISTRATION_CONFIG_KIND,
  LOCALE_REGISTRATION_SCOPE,
  type LocaleOffer,
} from '@api/contracts/locale-offer.port';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';

/**
 * `LOCALE_OFFER` over the published registration (task 67.16; §12.5.6's task-67.16 row (2)). **Fails to the source
 * locale alone**: a registration that is missing or unreadable — which publication refuses, so only a store emptied by
 * hand reaches this — offers nothing but Romanian, the one language every other is translated from, rather than every
 * built locale nobody registered. Logged at `error`, since it is never the ordinary answer.
 */
@Injectable()
export class LocaleOfferService implements LocaleOffer {
  private readonly logger = new Logger(LocaleOfferService.name);

  constructor(private readonly store: ConfigurationStore) {}

  offered(): readonly Locale[] {
    const entry = this.store.get({ kind: LOCALE_REGISTRATION_CONFIG_KIND, scope: LOCALE_REGISTRATION_SCOPE });
    const registration = readLocaleRegistration(entry?.payload);
    if (registration === null) {
      this.logger.error('No readable locale registration is in force; offering the source locale alone');
      return [SOURCE_LOCALE];
    }
    return offeredLocales({ registered: registration.map((locale) => locale.code) });
  }
}
