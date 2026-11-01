/**
 * The module an access row names, if it names one (task 67.9). The api records a module read's subject as
 * `<report id>/<module>`; the report id is an internal identifier and stays off the screen, while the module — `B3`
 * — is the standard's own name for what was read, and is what FR-79's *what was accessed* reads as to a person.
 */
const MODULE = /^[A-Z]\d{1,2}$/u;

export const accessModuleOf = (subject: string | null): string | null => {
  const module = subject?.split('/')[1];
  return module !== undefined && MODULE.test(module) ? module : null;
};
