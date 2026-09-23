/**
 * An address as S-38 names it — its first character, a mask, and the domain: `ana@lina.md` reads `a•••@lina.md`
 * (task 52.2.2, amended at task 52's close; §12.5.6's task-52.2 row).
 *
 * **Enough to tell a reader whose emails a link stops**, which the page must say because a forwarded link is followed
 * by someone else — and **not enough to disclose the address**: the token is the only proof S-38 asks for, so whatever
 * the page names is shown to anyone holding the link. The mask is a fixed length, so it does not say how long the
 * local part is either. A value with no `@` is masked whole.
 */
export const maskedAddress = (address: string): string => {
  const at = address.lastIndexOf('@');
  if (at <= 0) return MASK;
  return `${Array.from(address)[0]}${MASK}${address.slice(at)}`;
};

const MASK = '•••';
