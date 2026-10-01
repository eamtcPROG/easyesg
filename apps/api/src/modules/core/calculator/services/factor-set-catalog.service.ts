import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationHistory } from '@api/infrastructure/configuration/configuration-history.service';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { EMISSION_FACTOR_SET_CONFIG_KIND } from '../constants/calculator.constants';
import { readFactorSetPayload } from '../domain/factor-set-payload';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { FactorSet, FactorSetPin } from '../models/factor-set.model';

/**
 * `FactorSets` over the configuration store — the adapter half of AD-4 for FR-71 (task 37.2).
 *
 * **Two reads, because the two questions reach different tables.** What serves a period is in force, so it comes from
 * `ConfigurationStore`'s cached schedule like every other artefact, and a published correction reaches it on the next
 * poll with no redeploy (NFR-12, NFR-85). What a run was pinned to may no longer be in force anywhere, so it comes from
 * `ConfigurationHistory`, which reads the immutable version by revision.
 *
 * **Cached per pin, forever, and that is correct rather than optimistic**: a published revision cannot change
 * (`config.reject_published_edit()`), so the validated answer for `(country, revision)` is the same answer for the life
 * of the process — no invalidation, because there is nothing to invalidate. An unreadable payload is cached as `null`
 * for the same reason, which keeps its log line to one per process rather than one per request.
 *
 * **It fails closed**, `DerivationService`'s direction and for its reason: an unreadable set answers no set, and a
 * calculation is refused with that said, rather than run against a half-read payload and filed as computed.
 */
@Injectable()
export class FactorSetCatalog implements FactorSets {
  private readonly logger = new Logger(FactorSetCatalog.name);
  private readonly cache = new Map<string, FactorSet | null>();

  constructor(
    private readonly configurationStore: ConfigurationStore,
    private readonly configurationHistory: ConfigurationHistory,
  ) {}

  inForce(query: { readonly country: string; readonly periodStart: string }): FactorSet | null {
    const entry = this.configurationStore.get({
      kind: EMISSION_FACTOR_SET_CONFIG_KIND,
      scope: query.country,
      on: query.periodStart,
    });
    if (!entry) return null;
    return this.read({ country: query.country, revision: entry.revision }, entry.payload);
  }

  async pinned(pin: FactorSetPin): Promise<FactorSet | null> {
    const cached = this.cache.get(cacheKey(pin));
    if (cached !== undefined) return cached;

    const version = await this.configurationHistory.version({
      kind: EMISSION_FACTOR_SET_CONFIG_KIND,
      scope: pin.country,
      revision: pin.revision,
    });
    if (!version) {
      // Not cached: a pin naming nothing is a defect to surface every time it is met, not a fact about a revision.
      this.logger.error(
        `No published ${EMISSION_FACTOR_SET_CONFIG_KIND}/${pin.country} revision ${pin.revision} — ` +
          `a run pinned to it cannot be reproduced`,
      );
      return null;
    }
    return this.read(pin, version.payload);
  }

  /** Validates one revision's payload once, for both reads above. */
  private read(pin: FactorSetPin, payload: unknown): FactorSet | null {
    const key = cacheKey(pin);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const reading = readFactorSetPayload(payload);
    let set: FactorSet | null = null;
    if (!reading.readable) {
      this.logger.error(
        `Configuration entry ${EMISSION_FACTOR_SET_CONFIG_KIND}/${pin.country} (revision ${pin.revision}) is ` +
          `unreadable — ${reading.reason}; no calculation can use it until a correction is published`,
      );
    } else {
      if (reading.dropped.length > 0) {
        this.logger.error(
          `Configuration entry ${EMISSION_FACTOR_SET_CONFIG_KIND}/${pin.country} (revision ${pin.revision}) carries ` +
            `${reading.dropped.length} malformed source(s), dropped: ${reading.dropped.join(', ')}`,
        );
      }
      set = { pin, label: reading.label, sources: reading.sources };
    }
    this.cache.set(key, set);
    return set;
  }
}

const cacheKey = (pin: FactorSetPin): string => `${pin.country}/${pin.revision}`;
