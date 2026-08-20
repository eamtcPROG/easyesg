import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import { EMAIL_PORT } from '@api/contracts/email.port';
import { LOG_EMAIL_PROVIDER, LoggingEmailAdapter } from './logging-email.adapter';

/**
 * Registers the one `EmailPort` adapter this environment has chosen (§8.1 — one adapter per
 * provider, selected from configuration).
 *
 * **`EMAIL_PROVIDER` has no default, and the factory throws rather than falling back.** A default
 * would have to be one of two wrong things: `log`, which writes recipient addresses and
 * verification links into the application log and would silently do so in production against
 * NFR-30; or a provider nobody has credentials for, which fails at the first send instead of at
 * boot. Making the choice explicit costs one line per environment and removes both.
 *
 * Task 51 adds the Mailjet adapter (OQ-12) as a second `case` here. That is the whole diff on this
 * side, which is what P-7 and NFR-14 claim — activation or replacement of a provider is a
 * configuration change plus an adapter, and nothing in `modules/*` moves.
 */
@Module({
  providers: [
    {
      provide: EMAIL_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const provider = config.get('email.provider', { infer: true });

        switch (provider) {
          case LOG_EMAIL_PROVIDER:
            return new LoggingEmailAdapter();
          default:
            throw new Error(
              `EMAIL_PROVIDER is ${provider ? `"${provider}", which is not a registered adapter` : 'not set'}. ` +
                'Set EMAIL_PROVIDER=log for development; the Mailjet adapter (architecture.md ' +
                'OQ-12) is registered by task 51.',
            );
        }
      },
    },
  ],
  exports: [EMAIL_PORT],
})
export class EmailModule {}
