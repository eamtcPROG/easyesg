# Fixture: gate-integrity-review

Three hunks. Each is a check that would not fail on the thing it exists to catch.

## Hunk 1 — `apps/api/test/schema-invariants.e2e-spec.ts`

```ts
+const APP_INSERTABLE_COLUMNS: Record<string, string[]> = {
+  'core.report_disclosure_value': ['report_id', 'element_key', 'value_numeric', 'state'],
+};
+
+it('holds — the application may insert exactly the declared columns', async () => {
+  const actual = await appInsertableColumns(db);
+  expect(byTable(actual)).toEqual(APP_INSERTABLE_COLUMNS);
+});
```

## Hunk 2 — `apps/web/e2e/web/reports.spec.ts`

```ts
+  await page.getByRole('button', { name: t('reports.create') }).first().click();
+  const alerts = page.getByRole('alert');
+  expect(await alerts.count()).toBeGreaterThan(0);
```

## Hunk 3 — `apps/api/test/reports.e2e-spec.ts`

```ts
+  it('refuses a scope change once the report is filed', async () => {
+    const { reportId } = await aFiling(2026);
+    await http()
+      .patch(`/api/v1/reports/${reportId}`)
+      .set(editor.authorization)
+      .send({ scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE })
+      .expect(200);
+  });
```
