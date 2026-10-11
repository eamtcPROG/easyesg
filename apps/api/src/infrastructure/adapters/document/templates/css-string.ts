/**
 * Text as a CSS string literal, for the `content` of the page furniture (UX-118) — the one place the document puts
 * words, some of them the reporter's own (the undertaking's name), inside its stylesheet rather than its markup, where
 * React's escaping does not reach (NFR-70). Everything that could end the string, the declaration or the `<style>`
 * element is escaped by code point, as CSS escapes are written: a quotation mark, a backslash, an angle bracket, an
 * ampersand and any control character.
 */
export function cssString(text: string): string {
  const escaped = [...text]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point < 0x20 || point === 0x7f || '"\\<>&'.includes(character) ? `\\${point.toString(16)} ` : character;
    })
    .join('');
  return `"${escaped}"`;
}
