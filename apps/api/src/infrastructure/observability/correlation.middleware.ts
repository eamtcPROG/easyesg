import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runInRequestContext } from '../persistence/request-context';
import { negotiateLocale } from '@api/app/messages/negotiate-locale';

declare module 'express' {
  interface Request {
    correlationId?: string;
  }
}

const TRACEPARENT = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/;

/**
 * Opens the request context, establishes the correlation id (NFR-90) and negotiates the
 * response locale (OQ-46).
 *
 * The id is DERIVED from an inbound W3C `traceparent` trace-id where one is present,
 * rather than minted alongside it. One value, not two — otherwise OpenTelemetry spans
 * and the business rows that carry `correlation_id` (order, payment, invoice, e-Factura
 * transmission, ledger entry) can only be joined through a mapping table nobody builds.
 *
 * Registered with `app.use(...)`, not `MiddlewareConsumer.forRoutes('*')`: it must wrap
 * the guards, and Express 5 changed wildcard path matching.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceparent = req.header('traceparent');
  const match = traceparent ? TRACEPARENT.exec(traceparent) : null;
  const correlationId = match ? match[1] : randomUUID();

  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  // Negotiated here, with the correlation id, because both must exist before the first guard
  // can throw — and a guard that throws produces a problem document that needs a locale.
  const locale = negotiateLocale(req.header('accept-language'));

  // RFC 9110: state the language actually served, which is not always the one asked for.
  res.setHeader('content-language', locale);

  runInRequestContext({ correlationId, locale, clientIp: req.ip }, () => next());
}
