import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { type SeedEntry, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { VSME_DIGITAL_TEMPLATE_CONFIG_KIND } from '../constants/taxonomy.constants';
import { DigitalTemplateRegistryService } from './digital-template-registry.service';

/**
 * The registry's two kinds of answer (task 45.3): data that names no template answers `null`, and a release whose
 * committed binary is not the registered one throws. Over a directory made here, so each arm is reached on purpose; the
 * shipped artefacts and binaries are `digital-template-artefact.spec.ts`'s.
 */
describe('DigitalTemplateRegistryService', () => {
  const content = Buffer.from('a workbook, as far as this spec is concerned');
  const sha256 = createHash('sha256').update(content).digest('hex');
  const registration = (payload: Record<string, unknown>, scope = '1.3.0'): SeedEntry => ({
    kind: VSME_DIGITAL_TEMPLATE_CONFIG_KIND,
    scope,
    revision: 4,
    payload,
  });
  const valid = {
    taxonomyVersion: '2026-05-01',
    file: 'VSME-Digital-Template-1.3.0.xlsx',
    sha256,
    source: 'https://xbrl.efrag.org/downloads/vsme/VSME-Digital-Template-1.3.0.xlsx',
  };
  const pin = { templateVersion: '1.3.0', taxonomyVersion: '2026-05-01' };

  let directory: string;
  let errors: jest.SpyInstance;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'efrag-'));
    mkdirSync(join(directory, '1.3.0'));
    writeFileSync(join(directory, '1.3.0', valid.file), content);
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errors.mockRestore();
    rmSync(directory, { recursive: true, force: true });
  });

  const registry = (entries: SeedEntry[]) => new DigitalTemplateRegistryService({ store: seedConfigurationStore(entries), directory });

  it('answers the binary a pin names, with the version and the taxonomy it is written against', async () => {
    const template = await registry([registration(valid)]).templateFor(pin);
    expect(template).toEqual({ version: '1.3.0', taxonomyVersion: '2026-05-01', content: new Uint8Array(content) });
    expect(errors).not.toHaveBeenCalled();
  });

  it('answers null for a version nobody registered, saying nothing — the export refuses with a reason (46.1)', async () => {
    expect(await registry([registration(valid)]).templateFor({ ...pin, templateVersion: '1.2.0' })).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  it('answers null for a version spelled as no EFRAG release is, without reading the store or the disk', async () => {
    for (const templateVersion of ['2026-05-01', '../1.3.0', '1.3', '']) {
      expect(await registry([registration(valid, templateVersion)]).templateFor({ ...pin, templateVersion })).toBeNull();
    }
  });

  it('answers null for a registration it cannot read, and says so to an operator', async () => {
    expect(await registry([registration({ ...valid, sha256: 'not a digest' })]).templateFor(pin)).toBeNull();
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('vsme_digital_template/1.3.0 (revision 4) is malformed'));
  });

  it('answers null for a pin whose taxonomy is not the one the template is written against — never a nearby template (FR-51)', async () => {
    expect(await registry([registration(valid)]).templateFor({ ...pin, taxonomyVersion: '2026-02-01' })).toBeNull();
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('registered against taxonomy 2026-05-01'));
  });

  it('throws when the committed binary is not the file its registration names', async () => {
    writeFileSync(join(directory, '1.3.0', valid.file), 'a different workbook');
    await expect(registry([registration(valid)]).templateFor(pin)).rejects.toThrow(/is not the template 1\.3\.0 is registered as/);
  });

  it('throws when the registered binary is missing from the release', async () => {
    rmSync(join(directory, '1.3.0', valid.file));
    await expect(registry([registration(valid)]).templateFor(pin)).rejects.toThrow(/which cannot be read/);
  });
});
