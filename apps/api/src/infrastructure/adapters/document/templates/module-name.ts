import type { DocumentWords } from '../document-words';

/** The standard's name for a module, in the document's language — its code where the catalogue names none. */
export const moduleName = (words: DocumentWords, module: string): string => words.t(`modules.${module}`) || module;
