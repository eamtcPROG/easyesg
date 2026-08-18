import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from './domain.error';
import { ProblemDetails, ProblemType, ProblemTypeSlug, problemTypeUri } from './problem-types';

/**
 * The single error exit. Emits RFC 9457 `application/problem+json` (§6.8).
 *
 * MUST be registered FIRST. Nest scans filters from the last-registered backwards for
 * the first matching @Catch, so a catch-all registered last swallows every specific
 * filter added afterwards. This is a real trap and both sibling projects comment it.
 *
 * It also has a second job that is easy to miss: TenantTransactionGuard opens a
 * transaction, and a guard that throws never reaches an interceptor — so the rollback
 * cannot live only in TransactionInterceptor. See onRollback.
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

  private toProblem(exception: unknown, req: Request): ProblemDetails {
    const correlationId = (req as Request & { correlationId?: string }).correlationId;
    const instance = req.originalUrl;

    if (exception instanceof DomainError) {
      return {
        type: problemTypeUri(exception.problemType),
        title: exception.problemType,
        status: exception.status,
        detail: exception.message,
        instance,
        correlationId,
        ...exception.extensions,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      return {
        type: problemTypeUri(this.slugForStatus(status)),
        title: this.slugForStatus(status),
        status,
        detail: Array.isArray(detail) ? undefined : (detail as string | undefined),
        errors: Array.isArray(detail) ? detail : undefined,
        instance,
        correlationId,
      };
    }

    // Anything else is unexpected. Log it server-side; never reflect its message.
    // A raw driver or provider error leaks SQL, connection strings and internal
    // topology to the caller — NFR-30 forbids it, and it is how the shape of a
    // system gets handed to whoever is probing it.
    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    );
    return {
      type: problemTypeUri(ProblemType.Internal),
      title: ProblemType.Internal,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
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
