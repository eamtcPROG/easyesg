# Fixture: spec-review

Three hunks. Each is a specification failure rather than a coding one.

## Hunk 1 — `apps/api/src/modules/core/disclosure/use-cases/create-report.use-case.ts`

```ts
+  /**
+   * FR-22: a locked period is read-only for Reporting Contributors, so an Organization
+   * Administrator may still correct a report inside one.
+   */
+  private mayEditWhileLocked(role: MembershipRole): boolean {
+    return role === MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR;
+  }
```

## Hunk 2 — `apps/api/src/modules/core/disclosure/constants/retention.constants.ts`

```ts
+/** How long a draft report is kept before it is purged. */
+export const DRAFT_REPORT_RETENTION_DAYS = 90;
```

## Hunk 3 — `docs/task.md`

```diff
-| 34.1 | The generic value store | api | ... | Values written and read under RLS | TODO |
+| 34.1 | The generic value store | api | ... | Values written and read under RLS | DONE — 2 Sep 2026, **`jsonb` rather than a column per type** (project owner): the typed facade in 34.2 buys the checking back, and a column per XBRL type would be a migration per taxonomy release |
```
