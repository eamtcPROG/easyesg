import { holdsOnlyOffered, offeredOptions } from './offered-members';

/** C7's rights, five of the six its domain carries (task 79.7; §12.5.6's task-79.7 row). */
describe('offered members', () => {
  const domain = [
    { value: 'vsme:ChildLabourMember' },
    { value: 'vsme:AccidentPreventionMember' },
    { value: 'vsme:OtherContentMember' },
  ];
  const offered = new Set(['ChildLabourMember', 'OtherContentMember']);

  describe('offeredOptions', () => {
    it('narrows the domain to the members offered, in the domain’s order, matched bare', () => {
      expect(offeredOptions({ options: domain, offered }).map((option) => option.value)).toEqual([
        'vsme:ChildLabourMember',
        'vsme:OtherContentMember',
      ]);
    });

    it('offers the domain whole where nothing narrows the element', () => {
      expect(offeredOptions({ options: domain, offered: undefined })).toBe(domain);
    });

    it('offers the domain whole where the list names a member the domain does not declare', () => {
      expect(offeredOptions({ options: domain, offered: new Set(['ChildLabourMember', 'NoSuchMember']) })).toBe(domain);
    });
  });

  describe('holdsOnlyOffered', () => {
    it('admits an answer of offered members, stored qualified and space-separated', () => {
      expect(holdsOnlyOffered({ valueText: 'vsme:ChildLabourMember vsme:OtherContentMember', offered })).toBe(true);
    });

    it('refuses an answer holding one member the element does not offer', () => {
      expect(holdsOnlyOffered({ valueText: 'vsme:ChildLabourMember vsme:AccidentPreventionMember', offered })).toBe(false);
    });

    it('judges nothing where nothing narrows the element, or the answer holds nothing', () => {
      expect(holdsOnlyOffered({ valueText: 'vsme:AccidentPreventionMember', offered: undefined })).toBe(true);
      expect(holdsOnlyOffered({ valueText: null, offered })).toBe(true);
      expect(holdsOnlyOffered({ valueText: '', offered })).toBe(true);
    });
  });
});
