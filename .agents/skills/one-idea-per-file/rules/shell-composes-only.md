---
title: The Entry File Composes and Holds No Read, No String and No Logic
impact: CRITICAL
impactDescription: the file a framework hands a request to stays a table of contents
tags: shell, route, page, controller, composition
---

## The Entry File Composes and Holds No Read, No String and No Logic

**Impact: CRITICAL (the file a framework hands a request to stays a table of contents)**

The file a framework hands a request to — a Next `page.tsx`, a TanStack route, a Nest controller —
is a shell. It does the one thing only it can do (pin the locale; map transport to a service) and
returns the parts. Every child of its `return` reads for itself.

A route that reads, translates and renders is the largest file in the app within a month, and
nothing in it can be unit-tested. S-05's was 320 lines holding two screen-sized components and every
region's copy, against `app/` — *routes only, thin. No logic, no data access*.

**Incorrect (the route reads, resolves strings and renders every region):**

```tsx
export default async function HomePage({ params }: Props) {
  await activateRequestLocale(params);
  const [memberships, periods, t] = await Promise.all([
    readMemberships(),
    readOrganizationPeriods(),
    getTranslations('organization.home'),
  ]);
  const active = memberships?.find((m) => m.active);

  return (
    <div className={styles.screen}>
      <h1>{active?.organizationName}</h1>
      <Panel>
        <h2>{t('overview.heading')}</h2>
        {/* 120 lines deriving rows and drawing three regions */}
      </Panel>
      <Panel>
        <h2>{t('memberships.heading')}</h2>
        {/* 60 more */}
      </Panel>
    </div>
  );
}
```

**Correct (the route pins the locale and composes; each child reads for itself):**

```tsx
export default async function HomePage({ params, searchParams }: Props) {
  await activateRequestLocale(params);

  return (
    <div className={styles.screen}>
      <ArrivalNotice searchParams={searchParams} />
      <Suspense fallback={<HeadingLoading />}>
        <OrganizationHeading />
      </Suspense>
      <Suspense fallback={<OverviewLoading />}>
        <OverviewSection />
      </Suspense>
      <Suspense fallback={<MembershipsLoading />}>
        <MembershipsSection />
      </Suspense>
    </div>
  );
}
```

`searchParams` is handed on unawaited — the component that reads it awaits it, which is the same
rule the regions follow with their reads. The route resolves no string at all; the one namespace it
still names is for `generateMetadata`.

The same shape elsewhere: a Nest controller passes its validated `@Body()` straight to a service and
returns the DTO (*controllers call services; services call use cases*); a TanStack route renders
`<SignInScreen />` and nothing else.
