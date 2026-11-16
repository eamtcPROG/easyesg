import { Injectable, Logger } from '@nestjs/common';
import type { ElementPrecision, PresentationPrecision } from '@api/contracts/presentation-precision.port';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import {
  PRESENTATION_PRECISION_CONFIG_KIND,
  PRESENTATION_PRECISION_CONFIG_SCOPE,
} from '../constants/presentation-precision.constants';
import { readElementPrecision, readPresentationPrecision } from '../domain/presentation-precision';

/**
 * `PresentationPrecision` over the configuration store (task 39.2). Validated, never cast — configuration is data
 * someone edits — and **failing open, toward the exact figure**: no artefact in force, or one that will not read, answers
 * no places, so every figure is shown unrounded rather than not at all. Said at `error` per read, naming the revision to
 * replace, as `SeatAllowanceService` does, because an operator fixing it needs to see it stop.
 */
@Injectable()
export class PresentationPrecisionService implements PresentationPrecision, ElementPrecision {
  private readonly logger = new Logger(PresentationPrecisionService.name);

  /**
   * Each reader's answer for the revision it was read from (task 244): a published revision never changes, so a payload
   * is parsed once per revision rather than on every step read, for the units and for the elements.
   */
  private readonly parsed = new Map<
    (payload: unknown) => Readonly<Record<string, number>> | null,
    { readonly revision: number; readonly places: Readonly<Record<string, number>> }
  >();

  constructor(private readonly configurationStore: ConfigurationStore) {}

  places(): Readonly<Record<string, number>> {
    return this.read(readPresentationPrecision);
  }

  elementPlaces(): Readonly<Record<string, number>> {
    return this.read(readElementPrecision);
  }

  private read(reader: (payload: unknown) => Readonly<Record<string, number>> | null): Readonly<Record<string, number>> {
    const entry = this.configurationStore.get({
      kind: PRESENTATION_PRECISION_CONFIG_KIND,
      scope: PRESENTATION_PRECISION_CONFIG_SCOPE,
    });
    const artefact = `${PRESENTATION_PRECISION_CONFIG_KIND}/${PRESENTATION_PRECISION_CONFIG_SCOPE}`;
    if (!entry) {
      this.logger.error(`No ${artefact} is in force; computed figures are shown unrounded until one is published`);
      return {};
    }
    const held = this.parsed.get(reader);
    if (held !== undefined && held.revision === entry.revision) return held.places;
    const places = reader(entry.payload);
    if (places !== null) this.parsed.set(reader, { revision: entry.revision, places });
    if (places === null) {
      this.logger.error(
        `Configuration entry ${artefact} (revision ${entry.revision}) is malformed; computed figures are shown unrounded until it is replaced`,
      );
      return {};
    }
    return places;
  }
}
