import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AppConfig } from '@api/config/configuration';

/**
 * §12.5.6's admin-realm CSRF row (task 23): a state-changing request on this realm must present
 * an `Origin` exactly equal to the configured console origin.
 *
 * The Origin header is the primary signal on purpose — `Sec-Fetch-Site` cannot tell
 * `admin.<host>` from any other sibling subdomain (both are `same-site`), and NFR-65 treats
 * each subdomain as its own trust zone. Browsers always attach `Origin` to cross-origin
 * fetches, which every legitimate console request is; a request WITHOUT one is not a browser
 * carrying ambient credentials, and the session checks behind this guard refuse it on their
 * own terms.
 *
 * Controller-scoped, not global: this is the admin realm's posture, and task 28's guard chain
 * is where realm membership becomes a whole-surface concern. `ForbiddenException` rather than a
 * `DomainError` because a guard is an adapter — and deliberately bare: a cross-origin forger
 * gets a status code and nothing to calibrate against.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class AdminOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.header('origin');
    if (origin !== undefined && origin !== this.config.get('admin.origin', { infer: true })) {
      throw new ForbiddenException();
    }
    return true;
  }
}
