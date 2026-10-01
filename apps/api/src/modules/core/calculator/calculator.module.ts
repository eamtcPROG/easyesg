import { Module } from '@nestjs/common';
import { FACTOR_SETS } from './interfaces/factor-sets.interface';
import { FactorSetCatalog } from './services/factor-set-catalog.service';

/**
 * `core/calculator` — FR-33 … FR-36
 *
 * Scope 1 + location-based Scope 2. Raw inputs retained permanently; results pinned to a factor-set version.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * **Task 37 builds the factor half: the sets as configuration and the read a run pins to.** A factor set is rows in the
 * generic configuration store (AD-4) — `config/seed/emission-factor-set.<country>.json` — so registering one needs no
 * table, no migration and no code. The run, its retained inputs and the arithmetic are task 38's, over `FACTOR_SETS`.
 *
 * **`useClass`, not `useFactory`, because there is no framework-free use case here yet** — `TaxonomyModule`'s reason:
 * the catalog is an adapter over infrastructure, and task 38's run is where a use case appears and takes this port.
 *
 * **Registered in both modes**, like the store it reads: the worker renders exports, every export names the factor-set
 * version its figures used (NFR-22), and a catalog only the HTTP tier held would leave the worker unable to read a pin.
 */
@Module({
  providers: [{ provide: FACTOR_SETS, useClass: FactorSetCatalog }],
  exports: [FACTOR_SETS],
})
export class CalculatorModule {}
