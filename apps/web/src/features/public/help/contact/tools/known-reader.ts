/**
 * What S-34 shows a signed-in reader instead of asking (task 77; UX-109's Redundant Entry; `architecture.md` §12.5.6's
 * task-77 row (3), (10)) — the account's name and address, and the active organization's name, which travel with the
 * request. **Read by the route, never here**: nothing under `features/public` reads a session (§5.1b as amended), so the
 * form is handed this, or `null` for a visitor.
 */
export interface KnownReader {
  readonly name: string;
  readonly email: string;
  readonly organizationName: string | null;
}
