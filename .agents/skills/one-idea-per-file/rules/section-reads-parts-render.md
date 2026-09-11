---
title: The Section Reads; the Parts Render
impact: HIGH
impactDescription: adding a region is a line, changing one is a file
tags: section, region, read, states, arms
---

## The Section Reads; the Parts Render

**Impact: HIGH (adding a region is a line, changing one is a file)**

One file per region does the two things no part can: make the read, and decide which state arm the
region is in. Everything below it takes what was read. A part never reads, never decides the arm, and
never resolves a string that belongs to a sibling.

**Incorrect (one component holding the read, six states and three questions):**

```tsx
export async function OverviewSection() {
  const [read, membership, t] = await Promise.all([readOrganizationPeriods(), readActiveMembership(), getTranslations('organization.home')]);
  if (read.status !== TENANT_READ.READY) {
    return <Callout intent={CALLOUT_INTENT.ERROR} title={t(read.status === 'forbidden' ? 'permission.title' : 'unavailable.title')} action={null}>…</Callout>;
  }
  const rows = toOverviewRows({ periods: read.periods, now: new Date() });
  if (rows.length === 0) return <Panel>…{t('empty.body')}…</Panel>;
  const attention = rows.filter((r) => r.dueAt < new Date() || r.status === 'open');
  const resumable = rows.find((r) => r.resumeStep !== null);
  return (
    <>
      <Panel><h2>{t('attention.heading')}</h2>{/* 40 lines */}</Panel>
      <Panel><h2>{t('resume.heading')}</h2>{/* 30 lines */}</Panel>
      <Panel><h2>{t('everything.heading')}</h2>{/* 50 lines */}</Panel>
    </>
  );
}
```

**Correct (the section reads and branches; each region and each arm is a file):**

```tsx
export async function OverviewSection() {
  const [read, membership] = await Promise.all([readOrganizationPeriods(), readActiveMembership()]);

  if (read.status !== TENANT_READ.READY) {
    return <OverviewUnavailable reason={read.status} />;
  }

  const rows = toOverviewRows({ periods: read.periods, now: new Date() });

  if (rows.length === 0) {
    return <OverviewEmpty membership={membership} />;
  }

  return (
    <>
      <AttentionRegion rows={rows} membership={membership} />
      <ResumeRegion rows={rows} />
      <EverythingRegion rows={rows} membership={membership} />
    </>
  );
}
```

The section resolves no string — the clearest sign the split landed. Each region derives what it
needs (`attentionRows(rows)`, `resumableRow(rows)`) beside the question it answers, so changing what
a region means is one file, and the resume region answers with nothing when there is nothing to
resume rather than the section deciding for it.

On the api the use case is the same seam: it orchestrates the ports, and its helpers are pure
functions over what the ports returned.
