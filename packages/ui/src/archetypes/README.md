# Page archetypes

Nine templates (design_spec.md §4.6). Every screen is an instance of one; a screen that fits
none is an escalation to design review, not a licence to invent.

| Archetype | Purpose | Used by |
| --- | --- | --- |
| `Focus` | One task, no navigation | S-01, S-02, S-03, S-04, S-20, S-25 |
| `Index` | Find one among many | S-06, S-11, S-13, S-16, S-21, S-22, S-26 |
| `Record` | View and edit one object's attributes | S-13, S-14, S-15, S-23, S-27, S-28 — `RecordShell`, and since 29 Sep 2026 its card form `RecordCard` for S-13 |
| `Wizard` | Ordered progression with completion state | S-07, S-09, S-19 |
| `Panel` | Auxiliary context beside a primary task | S-08, S-11, S-12 |
| `Document` | Faithful preview of a rendered artefact | S-10 |
| `Status` | Current state of a long-lived thing | S-17, S-20, S-24 |
| `Exception queue` | Work a human must resolve | `apps/admin` only, keyboard-first |
| `Dashboard` | Aggregate view | `apps/admin` only — never the tenant home |

Two labels in the §4.4 inventory are **compositions, not archetypes** (OQ-7, closed): S-09 is a
Wizard sub-flow and S-18 is a Comparison. A composition inherits the complete state set of its
base archetype and defines none of its own.

**`PageHeading` is not an archetype** — it is the heading with its way back (the trail above the title, the arrow
before it) that `RecordCard` built for S-13 and gave up on 30 Sep 2026, when S-14's Index and Record took S-13's
conventions. `RecordCard` and `RecordShell` render it; an Index renders it itself, since its header is the caller's.
