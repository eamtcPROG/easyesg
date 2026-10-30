import { readKey, readOrder, readText, readTexts } from './content-payload';

describe('readText', () => {
  it('reads a line a person reads, trimmed', () => {
    expect(readText('  Ce cere standardul VSME  ')).toEqual({ value: 'Ce cere standardul VSME' });
  });

  it.each([[''], ['   '], [undefined], [12]])('refuses %j as blank', (value) => {
    expect(readText(value)).toEqual({ fault: 'is blank' });
  });

  it.each([
    ['See FR-61 for the rule.', 'a specification identifier'],
    ['The status is VALUE_INCONSISTENCY.', 'an enum member'],
    ['It is kept in config.entry_version.', 'a database object'],
    ['Choose allow_with_warning.', 'a snake_case token'],
  ])('refuses %j, which carries %s (UC-181)', (value, rule) => {
    expect(readText(value)).toHaveProperty('fault', expect.stringContaining(rule));
  });

  it('refuses a taxonomy element key shaped as an identifier, which no shape alone would catch', () => {
    expect(readText('Fill in CityOfSite for each site.')).toHaveProperty('fault', expect.stringContaining('CityOfSite'));
  });

  it('reads a one-word element key as the word it is, so English prose may say turnover', () => {
    expect(readText('Enter your turnover for the year.')).toEqual({ value: 'Enter your turnover for the year.' });
  });

  it('refuses an HTML tag, which the web renders as literal text', () => {
    expect(readText('Read <strong>this</strong> first.')).toEqual({ fault: 'carries an HTML tag' });
    expect(readText('Ends here </p>')).toEqual({ fault: 'carries an HTML tag' });
  });

  it('reads a comparison that is not a tag', () => {
    expect(readText('Companies with < 50 employees')).toEqual({ value: 'Companies with < 50 employees' });
  });

  it('reads the Markdown subset an article body is written in', () => {
    const body = 'Two steps:\n\n- **open** the report\n- follow [the guide](/ro/ajutor/primul-raport)\n\n*Done.*';
    expect(readText(body)).toEqual({ value: body });
  });
});

describe('readTexts', () => {
  it('reads a list, empty included', () => {
    expect(readTexts(['One', ' Two '])).toEqual({ value: ['One', 'Two'] });
    expect(readTexts([])).toEqual({ value: [] });
  });

  it('names the entry it refuses', () => {
    expect(readTexts(['One', ''])).toEqual({ fault: 'entry 2 is blank' });
    expect(readTexts('One')).toEqual({ fault: 'is not a list' });
  });
});

describe('readKey', () => {
  it('reads a key as given, trimmed, and refuses anything else', () => {
    expect(readKey(' first-report ')).toEqual({ value: 'first-report' });
    expect(readKey('')).toEqual({ fault: 'is not a key' });
    expect(readKey(3)).toEqual({ fault: 'is not a key' });
  });
});

describe('readOrder', () => {
  it('reads a whole number of at least zero', () => {
    expect(readOrder(0)).toEqual({ value: 0 });
    expect(readOrder(7)).toEqual({ value: 7 });
  });

  it.each([[-1], [1.5], ['1'], [undefined]])('refuses %j', (value) => {
    expect(readOrder(value)).toEqual({ fault: 'is not a whole number of at least zero' });
  });
});
