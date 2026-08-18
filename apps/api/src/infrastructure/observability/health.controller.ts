import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

/**
 * Liveness and readiness. Excluded from the OpenAPI tenant surface deliberately: it is
 * an operations endpoint, not a product capability, and NFR-16's route-coverage diff
 * compares the runtime route table against the spec — so anything outside `/api/v1`
 * needs an explicit, reviewed allowlist rather than a silent exemption.
 */
@ApiExcludeController()
@Controller('health')
export class HealthController {
  @Get()
  live(): { status: string } {
    return { status: 'ok' };
  }
}
