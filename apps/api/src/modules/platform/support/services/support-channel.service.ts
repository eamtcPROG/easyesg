import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { SUPPORT_CHANNEL_CONFIG_KIND, SUPPORT_CHANNEL_CONFIG_SCOPE } from '../constants/support.constants';
import { readSupportChannel, type SupportChannel } from '../domain/support-channel';
import { SupportChannelUnavailableError } from '../errors/support.errors';
import type { SupportChannelReader } from '../interfaces/support-channel-reader.interface';

/**
 * The support address in force (task 77; §12.5.6's task-77 row (5)), from the store's cache — an edit reaches every
 * replica within the store's poll (AD-4). **Validated, never cast**, and `null` where none is readable, which refuses a
 * request rather than recording one nobody is told of; logged at `error` on every read, `LegalControllerService`'s
 * shape, so whoever corrects it sees the line stop. Registered in both modes: the request tier refuses on it, and the
 * worker mails to it. **Since task 227 the help centre reads it with no session** (`published`; §12.5.6's task-227 row
 * (4)), which refuses as the request does where none is readable.
 */
@Injectable()
export class SupportChannelService implements SupportChannelReader {
  private readonly logger = new Logger(SupportChannelService.name);

  constructor(private readonly configurationStore: ConfigurationStore) {}

  inForce(): SupportChannel | null {
    const artefact = `${SUPPORT_CHANNEL_CONFIG_KIND}/${SUPPORT_CHANNEL_CONFIG_SCOPE}`;
    const entry = this.configurationStore.get({ kind: SUPPORT_CHANNEL_CONFIG_KIND, scope: SUPPORT_CHANNEL_CONFIG_SCOPE });
    if (!entry) {
      this.logger.error(`No ${artefact} is in force; requests to support are refused`);
      return null;
    }
    const channel = readSupportChannel(entry.payload);
    if (channel === null) {
      this.logger.error(
        `Configuration entry ${artefact} (revision ${entry.revision}) is malformed; requests to support are refused until it is replaced`,
      );
    }
    return channel;
  }

  /** The channel the help centre names to a reader — the one in force, or 503 `support-channel-unavailable`. */
  published(): SupportChannel {
    const channel = this.inForce();
    if (channel === null) throw new SupportChannelUnavailableError();
    return channel;
  }
}
