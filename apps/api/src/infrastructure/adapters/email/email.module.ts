import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import { EMAIL_PORT, type EmailPort } from '@api/contracts/email.port';
import { LOG_EMAIL_PROVIDER, LoggingEmailAdapter } from './logging-email.adapter';
import { SMTP_EMAIL_PROVIDER, SmtpEmailAdapter } from './smtp-email.adapter';
import { HOST_STANDING, assertPermittedHost } from './permitted-hosts';

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
 * **Task 51.1 added `smtp`, and it is the only production case there will be.** The adapter speaks
 * SMTP and takes its provider from the environment, so Mailjet, Gmail and any permitted EU host are
 * the same `case` — which is §12.5.2's *"a configuration change, not a code change"* holding
 * literally. Nothing in `modules/*` moved, which is what P-7 and NFR-14 claim.
 */
@Module({
  providers: [
    {
      provide: EMAIL_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        createEmailAdapter(
          config.get('email.provider', { infer: true }),
          config.get('email.smtp', { infer: true }),
        ),
    },
  ],
  exports: [EMAIL_PORT],
})
export class EmailModule {}

/**
 * The selection itself, lifted out of the `useFactory` so it can be exercised without standing up
 * an injector. That is not a testing convenience — the boot-time refusal below is NFR-27's guard,
 * and a guard reachable only through `Test.createTestingModule` is one whose spec proves the
 * harness rather than the rule.
 */
export const createEmailAdapter = (
  provider: string | undefined,
  smtp: AppConfig['email']['smtp'],
): EmailPort => {
  switch (provider) {
    case LOG_EMAIL_PROVIDER:
      return new LoggingEmailAdapter();
    case SMTP_EMAIL_PROVIDER: {
      // Before the transport exists: an unpermitted host fails the boot rather than the
      // first send, and a non-compliant one states itself on every start so the exception
      // is never silent (NFR-27, OQ-17).
      const permitted = assertPermittedHost(smtp.host);
      if (permitted.standing === HOST_STANDING.NON_COMPLIANT) {
        new Logger('EmailPort:smtp').warn(`NFR-27 exception in force — ${permitted.because}`);
      }
      const missing = (['user', 'password', 'from'] as const).filter((k) => !smtp[k]);
      if (missing.length > 0) {
        throw new Error(
          `EMAIL_PROVIDER=smtp requires ${missing.map((k) => `EMAIL_${k.toUpperCase()}`).join(', ')}.`,
        );
      }
      return new SmtpEmailAdapter({
        host: smtp.host as string,
        port: smtp.port,
        user: smtp.user as string,
        password: smtp.password as string,
        from: smtp.from as string,
      });
    }
    default:
      throw new Error(
        `EMAIL_PROVIDER is ${provider ? `"${provider}", which is not a registered adapter` : 'not set'}. ` +
          'Set EMAIL_PROVIDER=log for development, or smtp with EMAIL_HOST naming a ' +
          'permitted provider (NFR-27).',
      );
  }
};
