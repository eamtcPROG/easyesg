/**
 * The little XML this package reads, read without a parser — deliberately.
 *
 * **A parser would be the regeneration AD-10 rejected, one level down.** Parsing a sheet into a tree and serialising
 * it back reorders attributes, normalises quotes and whitespace, and rewrites namespace prefixes, so a sheet with one
 * cell changed would leave differing in thousands of places — and the spec that proves only the written cell changed
 * could not exist. So the package finds the few elements it needs by their tags, inside a part whose shape it knows,
 * and splices text. Every reader here is pure and has a spec, and each says what it assumes about the shape.
 */

/** One attribute as written: its qualified name, its decoded value, and its raw text for verbatim re-emission. */
export interface XmlAttribute {
  readonly name: string;
  readonly value: string;
  readonly raw: string;
}

const ATTRIBUTE = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** The attributes of one start tag — `<c r="E282" s="57"/>` gives `r` and `s`. */
export function readAttributes(tag: string): readonly XmlAttribute[] {
  return [...tag.matchAll(ATTRIBUTE)].map((match) => ({
    name: match[1],
    value: unescapeXml(match[2] ?? match[3] ?? ''),
    raw: match[0],
  }));
}

/** The value of one attribute of a start tag, or `null` where the tag does not carry it. */
export function attributeOf(tag: string, name: string): string | null {
  return readAttributes(tag).find((attribute) => attribute.name === name)?.value ?? null;
}

const ENTITY: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** XML's five predefined entities and its numeric character references, decoded. */
export function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9A-Fa-f]+|#\d+|amp|lt|gt|quot|apos);/g, (whole, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return ENTITY[body] ?? whole;
  });
}

const ESCAPED: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Text escaped for element content or a double-quoted attribute. */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => ESCAPED[character] ?? character);
}

/** Every start tag of an element — `<sheet …/>` or `<sheet …>` — with where it begins, in document order. */
export function startTags(xml: string, element: string): readonly { readonly tag: string; readonly index: number }[] {
  const pattern = new RegExp(`<${element}(?=[\\s/>])[^>]*>`, 'g');
  return [...xml.matchAll(pattern)].map((match) => ({ tag: match[0], index: match.index }));
}
