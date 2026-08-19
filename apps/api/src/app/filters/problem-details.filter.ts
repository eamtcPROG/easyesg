import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SOURCE_LOCALE, type Locale } from '@easyesg/i18n';
import { requestContext } from '../../infrastructure/persistence/request-context';
import { translate } from '../messages/catalogue';
import { DomainError } from './domain.error';
import { ProblemDetails, ProblemType, ProblemTypeSlug, problemTypeUri } from './problem-types';

/**
 * The single error exit. Emits RFC 9457 `application/problem+json` (§6.8).
 *
 * MUST be registered FIRST. Nest scans filters from the last-registered backwards for the first
 * matching @Catch, so a catch-all registered last swallows every specific filter added
 * afterwards. This is a real trap and both sibling projects comment it.
 *
 * It also has a second job that is easy to miss: TenantTransactionGuard opens a transaction, and
 * a guard that throws never reaches an interceptor — so the rollback cannot live only in
 * TransactionInterceptor. See onRollback.
 *
 * **`title` and `detail` are resolved from the catalogue, not built from the slug**
 * (architecture.md OQ-43, OQ-46). CLAUDE.md names both members as surfaces bound by the
 * no-internal-identifiers rule, and it names the problem-type slug as one of the identifiers
 * forbidden there — so `title: 'validation-failed'` was a violation twice over. The machine-
 * readable identity lives in `type`, which is a URI and is meant to be read by code.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly onRollback?: (host: ArgumentsHost) => Promise<void> | void) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    try {
      await this.onRollback?.(host);
    } catch (rollbackError) {
      this.logger.error('Rollback failed while handling an exception', rollbackError as Error);
    }

    const problem = this.toProblem(exception, req);
    res.status(problem.status).type('application/problem+json').json(problem);
  }

  /**
   * The locale negotiated by the middleware. Falls back to source because this path must never
   * be the thing that throws: an unresolvable locale would replace a real failure with a
   * different one, and the caller would learn nothing about either.
   */
  private locale(): Locale {
    return requestContext()?.locale ?? SOURCE_LOCALE;
  }

  /**
   * Resolves a problem type's title, or omits it.
   *
   * RFC 9457 makes every member optional, so an absent title is a valid document — while a title
   * holding the slug is an internal identifier on a surface a person reads. Omission is also
   * honest: it says the platform has no wording for this yet, rather than implying the reader
   * should have understood `entitlement-quota-exceeded`.
   */
  private title(slug: ProblemTypeSlug, locale: Locale): string | undefined {
    return translate(locale, `problem.${slug}.title`);
  }

  private toProblem(exception: unknown, req: Request): ProblemDetails {
    const correlationId = (req as Request & { correlationId?: string }).correlationId;
    const instance = req.originalUrl;
    const locale = this.locale();

    if (exception instanceof DomainError) {
      return {
        type: problemTypeUri(exception.problemType),
        title: this.title(exception.problemType, locale),
        status: exception.status,
        detail: translate(locale, exception.messageKey, exception.params),
        instance,
        correlationId,
        ...exception.extensions,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const slug = this.slugForStatus(status);
      const body = exception.getResponse();
      const detail = typeof body === 'string' ? body : (body as { message?: unknown }).message;

      return {
        type: problemTypeUri(slug),
        title: this.title(slug, locale),
        status,
        // NOT the framework's own message. Nest's defaults ("Unauthorized", "Not Found") are
        // English strings nobody here wrote, which the JSXText lint rule cannot see because they
        // live in node_modules — the same trap as a router's built-in Not Found page.
        detail: translate(locale, `problem.${slug}.detail`),
        // Field-level validation output stays as-is: it is addressed to the developer
        // integrating against the API, not to the person filling in the form.
        errors: Array.isArray(detail) ? detail : undefined,
        instance,
        correlationId,
      };
    }

    // Anything else is unexpected. Log it server-side; never reflect its message. A raw driver or
    // provider error leaks SQL, connection strings and internal topology to the caller — NFR-30
    // forbids it, and it is how the shape of a system gets handed to whoever is probing it.
    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    );
    return {
      type: problemTypeUri(ProblemType.Internal),
      title: this.title(ProblemType.Internal, locale),
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: translate(locale, `problem.${ProblemType.Internal}.detail`),
      instance,
      correlationId,
    };
  }

  private static readonly STATUS_SLUGS: Readonly<Record<number, ProblemTypeSlug>> = {
    [HttpStatus.BAD_REQUEST]: ProblemType.ValidationFailed,
    [HttpStatus.UNAUTHORIZED]: ProblemType.AuthenticationRequired,
    [HttpStatus.FORBIDDEN]: ProblemType.InsufficientRole,
    [HttpStatus.NOT_FOUND]: ProblemType.NotFound,
    [HttpStatus.CONFLICT]: ProblemType.Conflict,
    [HttpStatus.UNPROCESSABLE_ENTITY]: ProblemType.ValidationFailed,
    [HttpStatus.TOO_MANY_REQUESTS]: ProblemType.RateLimited,
  };

  private slugForStatus(status: number): ProblemTypeSlug {
    return ProblemDetailsFilter.STATUS_SLUGS[status] ?? ProblemType.Internal;
  }
}
