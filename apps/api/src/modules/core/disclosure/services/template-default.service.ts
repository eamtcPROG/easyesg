import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_TEMPLATE_DEFAULT_CONFIG_KIND } from '../constants/disclosure.constants';
import type { DisclosureDefault } from '../models/wizard-step.model';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The answers EFRAG's template ships a field already holding — the adapter half of AD-4 for
 * task 36.11.
 *
 * `AxisShapeService` and `DerivationService`'s shape, and their reasoning about direction:
 * **validated, never cast**, and **failing closed**. An unreadable entry yields no defaults, so the
 * fields open empty and a reporter answers them — visible, recoverable, and the conservative
 * direction for a value that becomes a *stored answer* rather than a hint. The opposite failure is a
 * half-read payload writing a compliance affirmation nobody made.
 *
 * **A default is read whole or dropped whole.** A row naming an element with no value in any column
 * is not "a default of nothing" — it is a malformed row, and committing it would store an empty
 * answer over a field the reporter has not seen.
 *
 * **Cached per configuration revision**, keyed on it, so a publication invalidates the cache with no
 * invalidation logic — a new revision is a new key.
 */
@Injectable()
export class TemplateDefaultService {
  private readonly logger = new Logger(TemplateDefaultService.name);
  private readonly cache = new Map<
    string,
    { revision: number; defaults: ReadonlyMap<string, DisclosureDefault> }
  >();

  /** The template's own answers, by element. Empty where nothing is registered, which is not a defect. */
  all(query: { readonly standard: string }): ReadonlyMap<string, DisclosureDefault> {
    const entry = this.configurationStore.get({
      kind: DISCLOSURE_TEMPLATE_DEFAULT_CONFIG_KIND,
      scope: query.standard,
    });
    if (!entry) return new Map();

    const key = `${DISCLOSURE_TEMPLATE_DEFAULT_CONFIG_KIND}/${query.standard}`;
    const cached = this.cache.get(key);
    if (cached?.revision === entry.revision) return cached.defaults;

    const defaults = this.read(entry.payload, key, entry.revision);
    this.cache.set(key, { revision: entry.revision, defaults });
    return defaults;
  }

  constructor(private readonly configurationStore: ConfigurationStore) {}

  private read(payload: unknown, key: string, revision: number): ReadonlyMap<string, DisclosureDefault> {
    const listed: unknown = isRecord(payload) ? payload.defaults : undefined;
    if (!Array.isArray(listed)) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) carries no \`defaults\` array — every ` +
          `field the template pre-answers opens empty instead.`,
      );
      return new Map();
    }

    const read = new Map<string, DisclosureDefault>();
    const dropped: string[] = [];
    for (const candidate of listed) {
      if (!isRecord(candidate) || typeof candidate.element !== 'string' || candidate.element === '') {
        dropped.push('?');
        continue;
      }
      const value: DisclosureDefault = {
        valueNumeric: typeof candidate.valueNumeric === 'string' ? candidate.valueNumeric : null,
        valueText: typeof candidate.valueText === 'string' ? candidate.valueText : null,
        valueBoolean: typeof candidate.valueBoolean === 'boolean' ? candidate.valueBoolean : null,
        valueDate: typeof candidate.valueDate === 'string' ? candidate.valueDate : null,
      };
      // A row naming an element and no value is malformed, not a default of nothing: committing it
      // would store an empty answer over a field nobody has seen.
      if (Object.values(value).every((column) => column === null)) {
        dropped.push(candidate.element);
        continue;
      }
      read.set(candidate.element, value);
    }
    if (dropped.length > 0) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) carries ${dropped.length} malformed ` +
          `default(s), dropped: ${dropped.join(', ')}`,
      );
    }
    return read;
  }
}
