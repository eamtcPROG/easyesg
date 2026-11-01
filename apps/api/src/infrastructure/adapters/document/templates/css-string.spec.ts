import { cssString } from './css-string';

describe('cssString (task 44; NFR-70)', () => {
  it('quotes plain words as they are, Cyrillic and diacritics included', () => {
    expect(cssString('Fornaio Bellini SRL · Отчёт · Bănulescu')).toBe('"Fornaio Bellini SRL · Отчёт · Bănulescu"');
  });

  it('escapes whatever could end the string, the rule or the style element', () => {
    expect(cssString('A "quoted" \\ name')).toBe('"A \\22 quoted\\22  \\5c  name"');
    expect(cssString('</style><script>alert(1)</script>')).toBe(
      '"\\3c /style\\3e \\3c script\\3e alert(1)\\3c /script\\3e "',
    );
    expect(cssString('two\nlines & more')).toBe('"two\\a lines \\26  more"');
  });
});
