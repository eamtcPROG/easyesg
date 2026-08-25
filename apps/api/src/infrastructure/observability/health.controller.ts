import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@api/app/decorators/public.decorator';

/**
 * Liveness and readiness. Excluded from the OpenAPI tenant surface deliberately: it is
 * an operations endpoint, not a product capability, and NFR-16's route-coverage diff
 * compares the runtime route table against the spec — so anything outside `/api/v1`
 * needs an explicit, reviewed allowlist rather than a silent exemption.
 *
 * `@Public()`: NFR-50's liveness probe must not depend on a session or on the database being
 * reachable — a probe that fails when PostgreSQL is slow reports the wrong thing and gets a
 * container killed.
 */
@ApiExcludeController()
@Controller('health')
@Public()
export class HealthController {
  @Get()
  live(): { status: string } {
    return { status: 'ok' };
  }
}
