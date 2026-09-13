/**
 * The collation every **user-visible text ordering** states for itself (`architecture.md` OQ-61,
 * closed 13 Sep 2026 by the project owner).
 *
 * **The question this answers.** A bare `ORDER BY name` sorts by whatever collation the cluster was
 * initialised with, and nothing in this repository pins one: `infra/postgres/init/init.sh` sets no
 * locale and the compose file passes no `POSTGRES_INITDB_ARGS`, so it is the `postgres:18.4` image
 * default. Task 140 made that bite — S-16's person column began sorting on a derived display name,
 * and names are capitalised where addresses are not — but the exposure was always there for every
 * list of entity and organization names this product shows.
 *
 * **Measured, not reasoned**, over the eight-value fixture in OQ-61's row:
 *
 * ```
 * en_US.utf8  Ana Ionescu · ana.popescu@ · Bianca Avram · bogdan@ · corina@ · Ștefan Țurcanu · zoe@
 * C           Ana Ionescu · Bianca Avram · ana.popescu@ · bogdan@ · corina@ · zoe@ · Ștefan Țurcanu
 * und-x-icu   Ana Ionescu · ana.popescu@ · Bianca Avram · bogdan@ · corina@ · Ștefan Țurcanu · zoe@
 * ```
 *
 * Under `C` a Romanian name sorts **after every ASCII value** — `Ștefan` past `zoe@` — which for a
 * product whose source locale is Romanian is the failure that matters, not the capitalisation.
 * **And `lower()` does not fix it**: it corrects the case and leaves `ș` sorting past `z`, because
 * the character is multi-byte and `C` compares bytes. OQ-61's own first draft proposed `lower()` as
 * the collation-independent answer and was wrong; the measurement is what said so.
 *
 * **Why an explicit collation rather than pinning the cluster** (the option declined, with its
 * reason): a pin makes dev, CI and production agree *by construction* and costs a re-init of any
 * cluster created differently — and it cannot be asserted until after that cluster exists, so a
 * wrong one is found late. ICU collations are compiled into PostgreSQL rather than taken from the
 * host's locales, so `und-x-icu` resolves on a `C` cluster, on a restored backup, and on a managed
 * Postgres nobody ran `initdb` on. This makes correct ordering a property of the **query** instead
 * of an operational precondition.
 *
 * **`und` — the root locale — rather than `ro-x-icu`, and that is a decision.** The reader's
 * language is a per-request fact and the sort happens in the database before any locale is known;
 * asking for one would mean a collation per request and a different page 2 depending on who asked.
 * The root locale orders Latin, then Cyrillic, case-insensitively at the primary level and with
 * diacritics folded to their base letter, which is what all three of RO, EN and RU want of a list
 * of people. If a locale ever needs its own order — FR-63's registration of a new one — this is the
 * one place it changes.
 *
 * **What it does not cover, stated rather than left to be found.** A `uuid`, a `timestamptz` and an
 * integer rank are not collatable and must not be wrapped — `COLLATE` on them is a type error. So a
 * tie-break on `id` stays bare while the text key beside it is collated, which is correct and looks
 * asymmetric.
 */
export const HUMAN_TEXT_COLLATION = 'und-x-icu';

/**
 * One text expression, ordered the way a person reads.
 *
 * A function rather than a suffix pasted at each site, so the collation is named once: five
 * orderings across three adapters carried this dependency when OQ-61 closed, and a sixth added
 * later is one call rather than one remembered string.
 */
export const collated = (expression: string): string =>
  `${expression} COLLATE "${HUMAN_TEXT_COLLATION}"`;
