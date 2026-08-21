import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { Response } from 'express';
import { ResultObjectDto } from '../dto/result-object.dto';
import { ResultListDto } from '../dto/result-list.dto';

/** Returned by a handler that must produce a real 204, not an envelope around null. */
export const NO_CONTENT_RESPONSE = Symbol('NO_CONTENT_RESPONSE');

/** Shape a handler returns when it has already paginated. */
export interface PagedResult<T> {
  objects: T[];
  total: number;
  totalpages: number;
}

function isPaged<T>(v: unknown): v is PagedResult<T> {
  return (
    typeof v === 'object' && v !== null &&
    Array.isArray((v as PagedResult<T>).objects) &&
    typeof (v as PagedResult<T>).total === 'number'
  );
}

/**
 * Wraps successful responses in the envelope. Controllers return plain data and
 * never construct the wrapper themselves.
 *
 * Errors do NOT pass through here — they are thrown, and ProblemDetailsFilter emits
 * RFC 9457 problem+json (architecture.md §6.8). So there is no `error` branch below,
 * and that is not an omission.
 *
 * Four bypasses, each earned rather than defensive:
 *  - NO_CONTENT_RESPONSE / an explicit 204, so DELETE can mean DELETE
 *  - StreamableFile and Buffer, because FR-53 requires an export to be re-downloaded
 *    byte-for-byte as distributed; an envelope would corrupt it
 *  - anything already wrapped, so the interceptor is idempotent
 */
@Injectable()
export class GlobalResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        const status = res.statusCode;

        if (data === NO_CONTENT_RESPONSE) {
          res.status(204);
          return undefined;
        }
        if (status === 204 || data === undefined) return undefined;
        if (data instanceof StreamableFile || Buffer.isBuffer(data)) return data;
        if (data instanceof ResultObjectDto || data instanceof ResultListDto) return data;

        if (isPaged(data)) {
          return new ResultListDto({
            objects: data.objects,
            total: data.total,
            totalpages: data.totalpages,
            htmlcode: status,
          });
        }
        if (Array.isArray(data)) {
          // An unpaginated array is a complete set: one page containing all of it.
          return new ResultListDto({ objects: data, total: data.length, totalpages: 1, htmlcode: status });
        }
        return new ResultObjectDto(data ?? null, status);
      }),
    );
  }
}
