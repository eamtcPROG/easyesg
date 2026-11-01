import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { RecordedCookieChoice } from '../models/cookie-choice.model';
import { RecordCookieChoice, type RecordCookieChoiceCommand } from '../use-cases/record-cookie-choice.use-case';

/**
 * The cookie banner's answer from HTTP (task 223). It resolves the one field the request supplies and the body may not:
 * **whose answer it is** — the account `AuthGuard` resolved from a bearer, or nobody's where none came
 * (`@AdmitsVisitor`). Taken from the body, it would let anyone record an answer in another person's name.
 */
@Injectable()
export class CookieChoiceService {
  constructor(private readonly recordChoice: RecordCookieChoice) {}

  record(input: Omit<RecordCookieChoiceCommand, 'accountId'>): Promise<RecordedCookieChoice> {
    return this.recordChoice.execute({ ...input, accountId: requestContext()?.actorId ?? null });
  }
}
