/**
 * What an address has to look like before a console form sends it (tasks 23, 67.4) — A-01's credential
 * step and A-08's invitation form. **A field's own shape check, not the rule**: the api validates the
 * address and answers with a sentence, and this exists so a person who typed a name where an address
 * belongs hears it before the round trip. Moved here when A-08 would have been its second copy.
 */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
