import { isUuid } from './uuid';

/**
 * The shape PostgreSQL will accept as `uuid` (task 162). Literals on purpose: these are the strings that arrive.
 */
describe('isUuid (task 162)', () => {
  it.each([
    ['a v4 id, as randomUUID() mints it', '3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0f'],
    ['a v7 id, as uuidv7() mints it', '01920000-0000-7000-8000-0000000000c1'],
    ['the nil id', '00000000-0000-0000-0000-000000000000'],
    ['an id with a version no generator here uses', '3f2c8a8e-1b7a-9c1e-9f2a-6d4b3e2a1c0f'],
    ['upper case', '3F2C8A8E-1B7A-4C1E-9F2A-6D4B3E2A1C0F'],
    ['mixed case', '3f2C8a8E-1b7A-4c1E-9f2A-6d4B3e2A1c0F'],
  ])('accepts %s', (_label, value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each([
    ['a name', 'not-a-uuid'],
    ['the empty string', ''],
    ['one character short', '3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0'],
    ['one character long', '3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0ff'],
    ['no hyphens', '3f2c8a8e1b7a4c1e9f2a6d4b3e2a1c0f'],
    ['braces', '{3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0f}'],
    ['a URN prefix', 'urn:uuid:3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0f'],
    ['surrounding whitespace', ' 3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0f'],
    ['a trailing newline', '3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0f\n'],
    ['a letter past f', '3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0g'],
    // A full-width `ａ` (U+FF41): the `iu` flags fold no character outside ASCII onto a-f, measured over every code point.
    ['a full-width lookalike', '3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0ａ'],
  ])('refuses %s', (_label, value) => {
    expect(isUuid(value)).toBe(false);
  });

  it.each([[undefined], [null], [42], [{}], [['3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0f']]])(
    'refuses a value that is not a string (%p)',
    (value) => {
      expect(isUuid(value)).toBe(false);
    },
  );
});
