import { Module } from '@nestjs/common';
import { TAXONOMY_REGISTRY } from '@api/contracts/taxonomy-registry.port';
import { TaxonomyRegistryService } from './services/taxonomy-registry.service';

/**
 * `platform/taxonomy` — FR-65 … FR-70
 *
 * Version registry, inter-version mappings, migration runs that preserve pre-migration state.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * **Task 33.1 builds the registry half only, and it is the whole of what exists here.** A taxonomy
 * version is rows in the generic configuration store (AD-3, AD-4) — `config/seed/vsme-taxonomy.
 * <version>.json`, extracted from EFRAG's published package by `tools/extract-vsme-taxonomy.mjs` —
 * so registering one needs no table, no migration and no code. FR-67's version-pair mappings and
 * FR-68 … FR-70's migration runs arrive with tasks 67.6 and 67.7, over these same artefacts.
 *
 * **`useClass`, not `useFactory`, because there is no framework-free use case here yet.** The
 * registry is an adapter over an infrastructure service: it reads a store, validates payloads and
 * caches. Task 67.7's migration run is where a use case appears, and it will take this port.
 *
 * **Registered in both modes**, like the store it reads. The worker renders exports against a
 * report's *pinned* version (DR-4), so a registry available only to the HTTP tier would make the
 * export the one place that could not resolve an element key.
 */
@Module({
  providers: [{ provide: TAXONOMY_REGISTRY, useClass: TaxonomyRegistryService }],
  exports: [TAXONOMY_REGISTRY],
})
export class TaxonomyModule {}
