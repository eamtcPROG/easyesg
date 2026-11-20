import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOCALES } from '@easyesg/i18n';
import { initialiseCatalogue } from '@api/app/messages/catalogue';
import { DerivationInputNamesService } from './derivation-input-names.service';

/** Every input the seeded derivation artefact publishes, by key — what a finding on one can name. */
const publishedInputs = (): readonly string[] => {
  const artefact = JSON.parse(
    readFileSync(resolve(process.cwd(), '../../config/seed/disclosure-derivation.vsme.json'), 'utf8'),
  ) as { derivations: { operands: Record<string, { from: string; key: string }> }[] };
  return [
    ...new Set(
      artefact.derivations.flatMap((derivation) =>
        Object.values(derivation.operands).flatMap((operand) => (operand.from === 'input' ? [operand.key] : [])),
      ),
    ),
  ].sort();
};

/**
 * Task 254 (§12.5.6's task-254 row (3)): a finding on a derivation input is named, beside its message, as S-07 labels
 * the box — in every locale, since a name some locale lacks would leave S-08's row, S-11's warning and a notice's field
 * list with no field to name.
 */
describe('DerivationInputNamesService', () => {
  beforeAll(() => initialiseCatalogue());

  it.each(LOCALES)('names every input the derivation artefact publishes in %s', (locale) => {
    const names = new DerivationInputNamesService().namesIn({ locale });
    for (const key of publishedInputs()) expect(names[`input:${key}`]?.trim()).toBeTruthy();
  });

  it('names an input as the box on S-07 is labelled', () => {
    expect(new DerivationInputNamesService().namesIn({ locale: 'en' })['input:HoursWorkedByOneFullTimeEmployee']).toMatch(
      /hours/iu,
    );
  });
});
