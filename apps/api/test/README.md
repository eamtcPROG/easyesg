# The e2e suite's timing ceiling

`jest-e2e.json` sets `testTimeout: 30000`, six times jest's 5 000 ms default. **The reason is
recorded here because task 85's deliverable requires it**: *"if the ceiling moves, the reason is
recorded"*.

Task 85's row also forbade the lazy version of this change — *"whether the 5 s default is the right
ceiling … is part of the question and not to be answered by turning it up"* — so the number below is
measured against a recorded distribution rather than chosen for comfort.

## The distribution the ceiling is calibrated against

The same 752 tests, the same tree, the same machine, measured 1 Sep 2026 from jest's own `--json`
per-test durations. The right-hand column is the condition task 85 is named after: `pnpm gates` runs
`pnpm build` immediately before `pnpm e2e`, so e2e starts with a build having just been through the
machine.

| | standalone | straight after a clean build (the `gates` shape) |
| --- | --- | --- |
| p50 | 14 ms | 24 ms |
| p90 | 96 ms | 129 ms |
| p99 | 294 ms | 680 ms |
| **slowest test** | **639 ms** | **4 229 ms** |
| suite wall time | 91.6 s | 133.9 s |
| result | 752 passed | 752 passed |

**Read the `p50` row against the `slowest test` row, because that is the whole diagnosis.** The median
moves 1.7× and the tail moves 6.6×. A shortage of CPU would slow everything by roughly one factor;
only a stall that lands on some operations and misses their neighbours degrades a distribution
unevenly — and 4 229 ms against a 5 000 ms ceiling is a run that passed with 15 % to spare. Task 85's
failing runs are this same distribution with the tail slightly further out.

## What the stall is

**Memory pressure on the development host** — not the code, not Postgres, and not CPU contention.

The host is an Intel i5-8279U (4 cores) with **8 GB of RAM**, running Docker Desktop's Linux VM, an
editor and a browser. At rest it was already carrying **4 399 MB of swap out of 5 120 MB**, with
2 909 964 pages held in the memory compressor and 245 million lifetime swapins.

Measured across the run in the right-hand column above:

- `pnpm build` made macOS **grow the swap file, 5 120 MB → 6 144 MB**, and took load average from
  **10.3 to 39.5 on four cores**. Its log line during that phase reads *"Collecting page data using 7
  workers"* — seven node processes on four cores and 8 GB, which is where the swap file grew.
- the e2e run that followed performed **2 959 415 swapins and 3 075 451 swapouts** of its own.

A page fault that has to decompress or swap in costs milliseconds to seconds and lands on whatever
happens to be running, leaving its neighbours alone. That is the uneven degradation, and it is also
why load average ranges from 6 to **160** across a gate run while Postgres reports almost no work: on
macOS that number counts threads blocked in uninterruptible I/O, and a page fault is one. Sampled
during one such run, `vm_stat` reported **`Pages free: 3596`** — about 14 MB free on an 8 GB machine.

## Two CPU hypotheses this refutes — do not re-run them

Both were measured on 1 Sep 2026 against eight busy-loop burners on eight threads:

| Probe | ambient | under 8 burners |
| --- | --- | --- |
| node event-loop delay (p99) | 2.9 ms | 2.5 ms |
| Argon2id at m = 19 MiB (p50) | 19.6 ms | 19.4 ms |

Neither budged. A `Math.sqrt` burner allocates nothing and argon2 re-uses one resident buffer, so
neither competes for the resource that is actually short. **An earlier draft of this file attributed
the ceiling to CPU contention** on the strength of a single suite run under those burners; that run's
failure was the flake, not the load, and the attribution was wrong.

## Why 30 000

Not a round number picked for headroom. **The default's margin, restored against the distribution
that actually obtains.**

- 5 000 ms was **7.8×** the slowest test of a standalone run (639 ms).
- 30 000 ms is **7.1×** the slowest test of a post-build run (4 229 ms).

The ceiling now stands in the same relation to the loaded distribution that jest's default stood in
to the idle one. It is still a bounded failure: a genuinely hung request fails in 30 s, not never.

## What this does not do

**It is not the instrument for noticing a real slowdown, and it never was.** A ceiling only ever
reports its own crossing. The table above is the instrument — regenerate it with

```
pnpm --filter @easyesg/api exec node --experimental-vm-modules ./node_modules/jest/bin/jest.js \
  --config ./test/jest-e2e.json --runInBand --json --outputFile=/tmp/e2e.json
```

and compare p50 and p90, which contention barely moves and a genuine regression does.

**It does not address the other half of task 85's symptoms.** That row also collects 400, 401, 404
and `socket hang up` failures, and those are not timeouts. Two of that family were diagnosed on
1 Sep 2026 and were ordinary per-suite isolation bugs — an address a `beforeAll` never cleaned, and a
shared actor enrolled into a second organization. They had no systemic cause at all. Treat a
non-timeout failure as a bug in the suite that produced it before treating it as this flake.

**It is not free in CI, and the cost is named rather than waved past.** A genuinely hung test is now
reported after 30 s instead of 5 s. That is 25 s once, inside a suite that runs in band and takes
minutes — and it is the whole cost, because the flake this ceiling exists for has never appeared
there: a runner starts fresh, runs one job, keeps no editor or browser resident, and holds Postgres as
a native Linux container rather than behind Docker Desktop's VM. A ceiling calibrated for the machine
the tests are written on is dead weight on the machine they are proved on, and 25 s is what that
costs.

## It is not confined to this suite

The gate run that closed task 85 failed `units`, not `e2e-api`: `packages/ui` › `forms.spec.tsx` took
**16 415 ms against its own 15 000 ms ceiling**, and passed standalone minutes later at 79/79 in
13.96 s. `packages/ui`, `apps/web` and `apps/admin` had all raised Vitest 5 000 → 15 000 ms on
24 Aug 2026 for a cause — parallel workspace runs — that the measurements above refute, a week before
task 85 was even opened. **So read this file as being about the host, not about `apps/api`.**

**Task 86 followed it up the same day and is worth knowing about before reaching for this ceiling
again.** Measured across four conditions, those three suites degraded because `pnpm -r test` started
seven Node processes at once on this machine — a *memory* multiplier, not CPU contention. Capping the
gate to one workspace at a time returned their slowest test from 4 998 ms to 1 425 ms **and finished
11 s faster**, because where the shortage is memory, running fewer things at once finishes sooner.
Their ceilings moved to 30 000 ms to match this one, so the host now carries a single ceiling. If this
suite ever needs more than 30 s, look for a multiplier to remove before raising the number again.

## The related fix beside it

`support/close-connections.ts` releases what a stalled test file left holding node's event loop, so a
single flake fails in seconds instead of stalling the run for as long as nobody is watching. **Two
handles do that, and the file shipped closing only one of them.**

| handle | released by | shipped in |
| --- | --- | --- |
| a request the test abandoned | `server.closeAllConnections()` | task 85 |
| the server itself, still listening | `server.close()` | task 87 |

Neither alone is enough, and that is measured rather than argued: with only the connections closed a
listening server keeps the loop alive on its own, and with only the listener closed the live
connection does. Task 85 could not see the second half because the hang it diagnosed had
`app.close()` already run, leaving a process with no listener and exactly one orphaned client. The
hang that found it, on 1 Sep 2026, had the opposite shape — server up, six connections, a live
database session, 21 minutes at 0 % CPU.

`close-connections.e2e-spec.ts` asserts both, in two tests rather than one, and each has been seeded:
remove `server.close()` and *"closes the listener"* fails `Expected: false, Received: true` **and**
jest stops exiting. The header docblock carries the full measurement.
