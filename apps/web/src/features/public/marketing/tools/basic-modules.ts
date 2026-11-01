/**
 * The VSME Basic Module's eleven sections, in the order a report holds them — S-29's *"the eleven Basic sections
 * named"*.
 *
 * **Codes, not names.** Each code is a key twice over: into `reportModules`, the exported report's own name for the
 * section, and into the home's `marketing.sections.about`, the sentence saying what it asks. The spec beside this file
 * holds both catalogues to the list in every locale, so a section the home names is one the report prints.
 *
 * In `tools/` because two bands read it — the eleven sections and the hero's wizard fragment.
 */
export const BASIC_MODULES = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11'] as const;

export type BasicModule = (typeof BASIC_MODULES)[number];
