import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { RequiresAccountGuard } from '../guards/requires-account.guard';
import { REQUIRES_ACCOUNT } from '../constants/membership.constants';

/**
 * Declares that a route needs an authenticated account and **no membership** (FR-12, UC-16).
 *
 * Composed like `@RequiresRole`, and for the same reason: metadata in one place and `UseGuards` in
 * another has a failure mode with no symptom, since a route carrying the metadata and not the guard
 * is open and reads as gated.
 */
export const RequiresAccount = () =>
  applyDecorators(SetMetadata(REQUIRES_ACCOUNT, true), UseGuards(RequiresAccountGuard));
