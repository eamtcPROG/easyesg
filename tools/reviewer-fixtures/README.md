# Reviewer fixtures — proving a review agent still bites

`tools/prove-boundaries.sh` exists because *a rule that matches nothing looks exactly like a rule
that passes*. A review agent is worse: it has **no failing state at all**. It returns prose whether
it is working or not, so an agent that has quietly stopped checking is indistinguishable from one
reporting a clean diff — and the report will be believed, because it looks the same.

These fixtures are that agent's `prove-boundaries.sh`.

## How to run one

Ask the agent to review the fixture file **as if it were a diff**, then compare its report with
`EXPECTED.md`.

```
Review tools/reviewer-fixtures/convention.md as a diff. Do not read EXPECTED.md.
```

Every hunk violates **exactly one** rule, and every rule it violates is one **no gate enforces** —
lint, boundaries and the invariants are deliberately not represented, because an agent that only
finds what the gates already find has earned nothing.

An agent that misses a hunk is not "having an off day": either the rule moved, or the agent's
instructions stopped pointing at it. Both are worth knowing before you trust its next clean report.

## What this does and does not verify

It verifies **judgement** — that the agent still recognises the rule and applies it to a hunk. It
does **not** verify that the agent reads the real files it is told to read, which is the other way
these rot. That is why each agent is told to state which files it read and their line counts: a
report with no such line was produced without reading, whatever else it says.

`EXPECTED.md` is the answer key. Do not put it in the agent's context.
