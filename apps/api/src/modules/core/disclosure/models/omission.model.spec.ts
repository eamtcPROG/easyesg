import { moduleOfOmissionMember, omittedModules } from './omission.model';

/**
 * VSME's only omission ground, and which modules a set of declared sections makes omitted
 * (task 36.13; FR-31, UC-30, UX-29).
 *
 * The member keys and the roll-up are EFRAG's, read out of the `2026-05-01` taxonomy and the
 * Digital Template's `Table of Contents & Validation` sheet — so a rule quietly changed here fails
 * against the standard's own shapes rather than against a restatement of them.
 */
describe('the module a declared omission reaches', () => {
  describe('reading the structure out of a member key', () => {
    it('takes a hyphen after the module code as the module-level entry', () => {
      expect(moduleOfOmissionMember('B7-ResourceUseCircularEconomyAndWasteManagementMember')).toEqual({
        module: 'B7',
        section: false,
      });
    });

    it('takes its absence as a section within that module', () => {
      expect(moduleOfOmissionMember('B7WasteGeneratedMember')).toEqual({ module: 'B7', section: true });
    });

    it('answers null for the four members that belong to no module', () => {
      // The *any other / entity-specific* disclosures, which sit under no module and are nobody's.
      expect(moduleOfOmissionMember('DisclosureOfAnyOtherSocialAndOrEntitySpecificSocialDisclosures')).toBeNull();
    });

    it('reads the taxonomy-qualified form, which is what the store actually holds', () => {
      // An enumeration answer is written as the member's qualified name (task 91.1), so this is the
      // only form that occurs in a real report. It was missed until a browser journey caught it —
      // the api case had fabricated the unqualified form rather than writing one as the wizard does.
      expect(moduleOfOmissionMember('vsme:B7-ResourceUseCircularEconomyAndWasteManagementMember')).toEqual({
        module: 'B7',
        section: false,
      });
      expect(moduleOfOmissionMember('vsme:B7WasteGeneratedMember')).toEqual({ module: 'B7', section: true });
    });

    it('reads a two-digit module code, which a single-character rule would truncate', () => {
      expect(moduleOfOmissionMember('B10RemunerationCollectiveBargainingMember')?.module).toBe('B10');
      expect(moduleOfOmissionMember('B11-ConvictionsAndFinesForCorruptionAndBriberyMember')?.module).toBe('B11');
    });
  });

  describe('deriving the omitted modules', () => {
    // B7 as the standard states it: one module-level entry and three sections.
    const B7 = [
      'B7-ResourceUseCircularEconomyAndWasteManagementMember',
      'B7DescriptionOfCircularEconomyPrinciplesMember',
      'B7WasteGeneratedMember',
      'B7AnnualMassFlowOfRelevantMaterialsUsedMember',
    ];
    // B9 as the standard states it: a module with no sections at all, which EFRAG draws as one box.
    const B9 = ['B9-WorkforceHealthAndSafetyMember'];
    const domain = [...B7, ...B9];

    it('omits a module whose own member is declared', () => {
      expect([...omittedModules({ selected: [B7[0]], domain })]).toEqual(['B7']);
    });

    it('matches a qualified selection against the registry’s raw domain keys', () => {
      // The two sides arrive in different forms — the domain from the registry, the selection from
      // the store — and comparing them as given is the defect a browser journey found.
      expect([...omittedModules({ selected: [`vsme:${B7[0]}`], domain })]).toEqual(['B7']);
      expect([...omittedModules({ selected: B7.slice(1).map((m) => `vsme:${m}`), domain })]).toEqual(['B7']);
    });

    it('omits a module every one of whose sections is declared', () => {
      expect([...omittedModules({ selected: B7.slice(1), domain })]).toEqual(['B7']);
    });

    it('does NOT omit a module on EFRAG’s own B7 roll-up, which reads two of three sections', () => {
      // The template computes `D32 = COUNTIF(D34:D35, TRUE) = ROWS(D34:D35)` while B7 has three
      // section checkboxes at rows 33, 34 and 35 — so under EFRAG's rule these two would mark the
      // module omitted while the circular-economy description is still being answered, putting a
      // false statement in a filing. Recorded in §12.5.6 and deliberately not replicated.
      const efragsTwo = ['B7WasteGeneratedMember', 'B7AnnualMassFlowOfRelevantMaterialsUsedMember'];
      expect([...omittedModules({ selected: efragsTwo, domain })]).toEqual([]);
    });

    it('omits a section-less module only by its own member', () => {
      expect([...omittedModules({ selected: B9, domain })]).toEqual(['B9']);
    });

    it('does not vacuously omit a section-less module', () => {
      // The trap in "every section is declared": a module with no sections satisfies `every` on an
      // empty list. B9 has none, so it must never appear unless its own member was chosen.
      expect([...omittedModules({ selected: [], domain })]).toEqual([]);
      expect([...omittedModules({ selected: ['B7WasteGeneratedMember'], domain })]).toEqual([]);
    });

    it('ignores a member belonging to no module', () => {
      expect([
        ...omittedModules({
          selected: ['DisclosureOfAnyOtherSocialAndOrEntitySpecificSocialDisclosures'],
          domain: [...domain, 'DisclosureOfAnyOtherSocialAndOrEntitySpecificSocialDisclosures'],
        }),
      ]).toEqual([]);
    });
  });
});
