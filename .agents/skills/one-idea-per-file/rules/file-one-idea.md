---
title: One Idea per File
impact: HIGH
impactDescription: the docblock has one thing to explain
tags: file, granularity, split, component, tells
---

## One Idea per File

**Impact: HIGH (the docblock has one thing to explain)**

A section, a list, a row, a state arm, a fallback, a note, a reducer, a conversion — one file each.
There is no line count; the measure is how many things the file's docblock has to explain. What was
split in the refactor this rule comes from: a route holding two screen-sized components (320
lines); a form holding four sections, a controls row, three callouts, two conversions and its state
(430); an overview holding six states (221); a region holding a read, a heading, an error arm, a
list, a row and a footer (91).

**The tells**, each met once:

- a file defining two components;
- a component holding both a read and a render arm;
- a reducer inside a component;
- a helper whose body mentions only an imported vocabulary — that is the vocabulary's missing
  export, not this file's helper.

**Incorrect (a region, its list and its row in one file):**

```tsx
export async function MembershipsSection() {
  const [memberships, t] = await Promise.all([readMemberships(), getTranslations('organization.home')]);
  return (
    <Panel>
      <h2 className={`t-heading-3 ${styles.regionHeading}`}>{t('memberships.heading')}</h2>
      {memberships === null ? (
        <Callout intent={CALLOUT_INTENT.ERROR} title={t('memberships.unreachable.title')} action={null}>…</Callout>
      ) : (
        <ul className={styles.memberships}>
          {memberships.map((m) => (
            <li key={m.id} className={styles.membership}>
              <span>{m.organizationName}</span>
              {m.active ? <StatusChip tone={STATUS_TONE.POSITIVE}>{t('memberships.active')}</StatusChip> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="t-caption">{t('memberships.switchNote')}</p>
    </Panel>
  );
}
```

**Correct (five files, each one idea):**

```text
memberships/
├─ section/   memberships-section.tsx     the read, the arm, the region shell
│             memberships-loading.tsx     the boundary's fallback
│             memberships-switch-note.tsx the footer, outside the arm on purpose
├─ list/      memberships-list.tsx        the ul and the lede
│             membership-row.tsx          one organization and the role held in it
├─ states/    memberships-unreachable.tsx the error arm
└─ shared/    memberships-messages.ts     the namespace, declared once
```

```tsx
export async function MembershipsSection() {
  const [memberships, t] = await Promise.all([readMemberships(), getTranslations(MEMBERSHIPS_MESSAGES)]);
  return (
    <HomeRegion heading={t('heading')}>
      {memberships === null ? <MembershipsUnreachable /> : <MembershipsList memberships={memberships} />}
      <MembershipsSwitchNote />
    </HomeRegion>
  );
}
```

A part that renames when the copy changes owns its own translator; `getTranslations` against a
catalogue the request has already read is a microtask, not a round trip.
