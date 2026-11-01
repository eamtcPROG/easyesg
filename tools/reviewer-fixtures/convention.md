# Fixture: convention-review

Three hunks. Each violates one written convention that **no gate enforces**.

## Hunk 1 — `apps/api/src/modules/core/period/services/period.service.ts`

```ts
+  async transfer(
+    periodId: string,
+    reportingEntityId: string,
+    actorId: string,
+  ): Promise<ReportingPeriod> {
+    return this.store.transfer(periodId, reportingEntityId, actorId);
+  }
```

## Hunk 2 — `apps/web/src/features/reports/report-form.tsx`

```tsx
   const onSubmit = async (values: FormValues) => {
+    setPending(true);
+    setNotice(null);
     const outcome = await createReport(values);
+    setPending(false);
+    setNotice(outcome.status === API_OUTCOME.Ok ? success : refusal);
   };
```

## Hunk 3 — `apps/web/src/app/[locale]/(app)/(workspace)/reports/page.tsx`

```tsx
+function PinnedVersionBadge({ label, version }: { label: string; version: string }) {
+  return (
+    <span className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
+      <span className="text-muted">{label}</span>
+      <span className="font-mono">{version}</span>
+    </span>
+  );
+}
```
