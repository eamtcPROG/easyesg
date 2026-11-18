import { LOCALES, SOURCE_LOCALE } from '@easyesg/i18n';
import { LocaleRegistrationInvalidError } from '../errors/content.errors';
import type { ContentConsoleStore } from '../interfaces/content-console-store.interface';

export interface PublishLocaleRegistrationCommand {
  readonly codes: readonly string[];
  /** The revision the operator read — a colleague's later save is refused rather than overwritten. */
  readonly expectedRevision: number;
  readonly operatorId: string;
}

/**
 * UC-73's control (task 67.5; FR-63; 182/46): which built locales are offered. **The source locale is always offered**
 * and a locale the build has no catalogue for is refused — registering it would offer nothing (67.16), and a fourth
 * locale is a catalogue and a build first (OQ-43). Answers the version put in force, which the audit row names.
 */
export class PublishLocaleRegistration {
  constructor(private readonly store: ContentConsoleStore) {}

  async execute(command: PublishLocaleRegistrationCommand): Promise<{ readonly id: string; readonly revision: number }> {
    const codes = LOCALES.filter((locale) => command.codes.includes(locale));
    if (codes.length !== new Set(command.codes).size || !codes.includes(SOURCE_LOCALE)) {
      throw new LocaleRegistrationInvalidError();
    }
    return this.store.publishRegistration({ ...command, codes });
  }
}
