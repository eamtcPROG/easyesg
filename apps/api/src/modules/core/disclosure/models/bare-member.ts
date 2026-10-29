/**
 * A member without its taxonomy prefix — `vsme:ChildLabourMember` → `ChildLabourMember` (task 36.13, its own module
 * since task 79.7 gave it a second reader). **The one place the two forms are reconciled**: a stored answer is qualified
 * and the configuration names members as the domain does, so a reader comparing them as given matches nothing and says
 * nothing.
 */
export const bareMember = (member: string): string => member.slice(member.indexOf(':') + 1);
