import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { readPart } from '@easyesg/xlsx-patch';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { REPORTING_TAXONOMY_CONFIG_KIND, VSME_DIGITAL_TEMPLATE_CONFIG_KIND } from './constants/taxonomy.constants';
import { readDigitalTemplateEntry } from './domain/digital-template-entry';
import { DigitalTemplateRegistryService } from './services/digital-template-registry.service';

/**
 * The shipped registrations, read by the shipped registry over the committed binaries (task 45.3).
 *
 * **"A report's export resolves the template version its pin names" is a claim about the seed**, because a pin is
 * copied from the adoption window in force when its period opened (§12.5.6's task-31.3 row): so every window of
 * `reporting-taxonomy.vsme.json` must name a template the registry resolves, against the very taxonomy that window
 * pins. An adoption scheduled for a template nobody committed, or registered against the wrong taxonomy, fails here
 * rather than at a reporter's first Excel export.
 *
 * **And each registration agrees with its own binary** — not only by digest, which proves the file is the one
 * registered, but by what the workbook says about itself: EFRAG writes its taxonomy entry point into the template, and
 * a registration pairing `1.2.0` with `2026-05-01` would pass every other check here while exporting a February
 * workbook as a May filing.
 */
describe('the shipped Digital Template registrations', () => {
  const entries = readSeedEntries();
  const registry = new DigitalTemplateRegistryService({
    store: seedConfigurationStore(entries),
    directory: resolve(process.cwd(), '../../config/efrag'),
  });
  const registrations = entries.filter((entry) => entry.kind === VSME_DIGITAL_TEMPLATE_CONFIG_KIND);

  let errors: jest.SpyInstance;
  beforeEach(() => {
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errors.mockRestore();
  });

  it('resolves the template every adoption window pins, against the taxonomy that window pins, with nothing logged', async () => {
    const windows = entries.filter((entry) => entry.kind === REPORTING_TAXONOMY_CONFIG_KIND);
    expect(windows.length).toBeGreaterThan(1);
    for (const window of windows) {
      const pin = { templateVersion: String(window.payload.templateVersion), taxonomyVersion: String(window.payload.version) };
      const template = await registry.templateFor(pin);
      expect({ pin, resolved: template?.version ?? null }).toEqual({ pin, resolved: pin.templateVersion });
    }
    expect(errors).not.toHaveBeenCalled();
  });

  it.each(registrations.map((entry) => [entry.scope, entry] as const))(
    'registers %s as a workbook that names its own taxonomy, and no other',
    async (version, entry) => {
      const registered = readDigitalTemplateEntry(entry.payload);
      expect(registered).not.toBeNull();
      const template = await registry.templateFor({ templateVersion: version, taxonomyVersion: registered?.taxonomyVersion ?? '' });
      const strings = template === null ? '' : (readPart(template.content, 'xl/sharedStrings.xml') ?? '');
      const named = [...strings.matchAll(/https:\/\/xbrl\.efrag\.org\/taxonomy\/vsme\/(\d{4}-\d{2}-\d{2})\//g)].map((match) => match[1]);
      expect(new Set(named)).toEqual(new Set([registered?.taxonomyVersion]));
    },
  );
});
