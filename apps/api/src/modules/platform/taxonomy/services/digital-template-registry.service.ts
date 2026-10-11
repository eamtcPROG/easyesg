import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import type { DigitalTemplate, DigitalTemplateRegistry } from '@api/contracts/digital-template-registry.port';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { VSME_DIGITAL_TEMPLATE_CONFIG_KIND } from '../constants/taxonomy.constants';
import { readDigitalTemplateEntry } from '../domain/digital-template-entry';

/** EFRAG's template releases are `major.minor.patch`; a version spelled otherwise names no directory here. */
const TEMPLATE_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Resolves a report's template pin to the committed EFRAG binary (task 45.3; FR-50, DR-4).
 *
 * **The registration is configuration and the binary is the release** (§11.5 step 1, 182/48): the store says which
 * file a version is and its digest, `config/efrag/<version>/` holds the file, and the two must agree. A registration
 * answers through the store like every artefact, so registering a version is a publish; the bytes ship with the image.
 *
 * **What answers `null` and what throws is the line between data and a defect.** A version nobody registered, a
 * registration an operator wrote wrong, or one paired with another taxonomy than the report's: the report has no
 * template, and the export says so (task 46.1). A registered file that is missing or is not the file its digest names:
 * the release is broken, and pretending the template is merely unregistered would hide that from the one person who
 * can fix it.
 *
 * **No cache.** A template is read and its digest checked on each resolution — one file read and one hash, beside an
 * export that renders for seconds — so a stale binary cannot outlive a corrected registration.
 */
export class DigitalTemplateRegistryService implements DigitalTemplateRegistry {
  private readonly logger = new Logger(DigitalTemplateRegistryService.name);

  constructor(
    private readonly sources: {
      readonly store: ConfigurationStore;
      /** `config/efrag`, holding one directory per registered version. */
      readonly directory: string;
    },
  ) {}

  async templateFor(pin: { readonly templateVersion: string; readonly taxonomyVersion: string }): Promise<DigitalTemplate | null> {
    if (!TEMPLATE_VERSION.test(pin.templateVersion)) return null;
    const registered = this.sources.store.get({ kind: VSME_DIGITAL_TEMPLATE_CONFIG_KIND, scope: pin.templateVersion });
    if (registered === undefined) return null;

    const entry = readDigitalTemplateEntry(registered.payload);
    if (entry === null) {
      this.logger.error(
        `Configuration entry ${VSME_DIGITAL_TEMPLATE_CONFIG_KIND}/${pin.templateVersion} (revision ${registered.revision}) ` +
          'is malformed; no export can resolve that template',
      );
      return null;
    }
    if (entry.taxonomyVersion !== pin.taxonomyVersion) {
      this.logger.error(
        `Template ${pin.templateVersion} is registered against taxonomy ${entry.taxonomyVersion}, and a report pins it ` +
          `beside ${pin.taxonomyVersion}; the pair names no template`,
      );
      return null;
    }

    const path = join(this.sources.directory, pin.templateVersion, entry.file);
    const content = await readFile(path).then(
      (bytes) => new Uint8Array(bytes),
      (error: unknown) => {
        throw new Error(`Template ${pin.templateVersion} is registered as ${path}, which cannot be read`, { cause: error });
      },
    );
    const digest = createHash('sha256').update(content).digest('hex');
    if (digest !== entry.sha256) {
      throw new Error(`${path} is not the template ${pin.templateVersion} is registered as: SHA-256 ${digest}, registered ${entry.sha256}`);
    }
    return { version: pin.templateVersion, taxonomyVersion: entry.taxonomyVersion, content };
  }
}
