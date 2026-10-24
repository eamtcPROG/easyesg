/**
 * The two letters an invitation's organization card draws (task 225): the first letter of each of the name's first two
 * words that begin with one, upper-cased in the recipient's language — *Brutăria Lina SRL* is `BL`. UX-137's monogram
 * is a person's, from two stored name parts; an organization's name is one string, so its words stand in for the parts.
 * A name with no letter at all draws no monogram, and the card shows the name alone.
 */
export function organizationMonogram(input: { readonly name: string; readonly locale: string }): string {
  return input.name
    .split(/\s+/u)
    .flatMap((word) => /^\p{L}/u.exec(word)?.[0] ?? [])
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase(input.locale);
}
