import { Module } from '@nestjs/common';
import { DISCLOSURE_LABELS } from '@api/contracts/disclosure-label.port';
import { DisclosureLabelService } from './services/disclosure-label.service';

/**
 * `platform/localization` — FR-63, FR-64
 *
 * Locale registration, label resolution, per-key fallback logging into a review queue.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * **Task 33.2 builds label resolution, and it is the whole of what exists here.** VSME element keys
 * resolve to wording from catalogues committed in `packages/i18n/catalogues/disclosure/<version>/`,
 * per taxonomy version (DR-4) and with each label's EFRAG standing attached (NFR-24, T-14, UX-47).
 * FR-64's fallback review queue is not built: OQ-43 replaced it for committed text with a build-time
 * parity suite, which is strictly stronger — a queue reports that a reader already saw the wrong
 * language, and parity says nobody will. What is left of FR-64 belongs to the configuration-store
 * half of OQ-43 (help-centre articles, plan copy) and arrives with its owner.
 *
 * **Registered in both modes**, like the taxonomy registry it labels. The worker renders exports
 * against a report's pinned version (DR-4), and a resolver available only to the HTTP tier would
 * make the export — the one artefact a bank reads — the one place an element key could not be named.
 */
@Module({
  providers: [{ provide: DISCLOSURE_LABELS, useClass: DisclosureLabelService }],
  exports: [DISCLOSURE_LABELS],
})
export class LocalizationModule {}
