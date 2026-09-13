import type { DataSource } from 'typeorm';
import { HUMAN_TEXT_COLLATION } from '../src/infrastructure/persistence/collation';
import { connectAs } from './support/database';

/**
 * `architecture.md` OQ-61, closed 13 Sep 2026: **every user-visible text ordering states its own
 * collation**, so the order a reader sees is a property of the query rather than of however the
 * cluster happened to be initialised.
 *
 * **What this suite can prove and what it cannot, stated first because the gap is the interesting
 * part.** It proves the *choice* — that `und-x-icu` orders Romanian, English and Russian the way the
 * product needs, and that a cluster collation can disagree, so the explicit clause is load-bearing
 * rather than decorative. It cannot prove that a given repository *uses* it: this machine's cluster
 * is `en_US.utf8`, which happens to agree with ICU on every value below, so deleting `collated(…)`
 * from an adapter leaves the routes' order unchanged **here** and breaks it only on a `C` cluster —
 * which is exactly the deployment this decision exists for and the one no local run can be.
 *
 * So the guard against that is the `collated()` helper being the only spelling — one import, named
 * once, rather than a string remembered at each `ORDER BY`. This suite guards the value inside it.
 */
describe('human-text collation (OQ-61)', () => {
  let owner: DataSource;

  /**
   * Latin and Cyrillic, capitalised names against lowercase addresses, and a Romanian name carrying
   * the two characters that separate the candidate collations. Every pair below is chosen because
   * something disagrees about it — a fixture of plain ASCII names would order identically under all
   * three and prove nothing.
   */
  const PEOPLE = [
    'Ana Ionescu',
    'bogdan@example.md',
    'Bianca Avram',
    'corina@example.md',
    'Ștefan Țurcanu',
    'ana.popescu@example.md',
    'Анна Петрова',
    'zoe@example.md',
  ];

  const orderedBy = async (collation: string): Promise<string[]> => {
    const rows = await owner.query<{ v: string }[]>(
      `SELECT v FROM unnest($1::text[]) AS t(v) ORDER BY v COLLATE "${collation}"`,
      [PEOPLE],
    );
    return rows.map((row) => row.v);
  };

  beforeAll(async () => {
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-collation');
  }, 60_000);

  afterAll(async () => {
    if (owner?.isInitialized) await owner.destroy();
  });

  it('orders the way a reader of any of the three locales expects', async () => {
    // Case-insensitive at the primary level — *Ana Ionescu* beside *ana.popescu@* rather than every
    // capitalised value first — and diacritics folded to their base letter, so *Ștefan* sorts as
    // *Stefan*, between `corina@` and `zoe@`. Cyrillic follows Latin. That is the product behaviour
    // the owner confirmed when OQ-61 closed, and it is stated here rather than left emergent.
    expect(await orderedBy(HUMAN_TEXT_COLLATION)).toEqual([
      'Ana Ionescu',
      'ana.popescu@example.md',
      'Bianca Avram',
      'bogdan@example.md',
      'corina@example.md',
      'Ștefan Țurcanu',
      'zoe@example.md',
      'Анна Петрова',
    ]);
  });

  it('differs from C, which is what makes the explicit clause load-bearing', async () => {
    const c = await orderedBy('C');

    // **The failure a bare `ORDER BY` would ship on a `C` cluster**, and it is not the
    // capitalisation: a Romanian name sorts after every ASCII value. For a product whose source
    // locale is Romanian, `Ștefan` below `zoe@` is the defect that matters.
    expect(c.indexOf('Ștefan Țurcanu')).toBeGreaterThan(c.indexOf('zoe@example.md'));
    // And the capitalised names group ahead of the lowercase addresses, which is the half that is
    // easy to notice and cheap compared with the half above.
    expect(c.indexOf('Bianca Avram')).toBeLessThan(c.indexOf('ana.popescu@example.md'));
    expect(c).not.toEqual(await orderedBy(HUMAN_TEXT_COLLATION));
  });

  it('is not fixed by lower(), which OQ-61’s first draft proposed', async () => {
    // Recorded as a test rather than as a sentence, because the sentence was written and was wrong.
    // `lower()` corrects the case and leaves `ș` sorting past `z`: the character is multi-byte and
    // `C` compares bytes, so the Romanian half of the defect survives the fix that looks like it
    // addresses the whole thing.
    const rows = await owner.query<{ v: string }[]>(
      `SELECT v FROM unnest($1::text[]) AS t(v) ORDER BY lower(v) COLLATE "C"`,
      [PEOPLE],
    );
    const lowered = rows.map((row) => row.v);

    expect(lowered.indexOf('Bianca Avram')).toBeGreaterThan(lowered.indexOf('ana.popescu@example.md'));
    expect(lowered.indexOf('Ștefan Țurcanu')).toBeGreaterThan(lowered.indexOf('zoe@example.md'));
  });

  it('resolves without the host providing a locale, which is why it was chosen over a pin', async () => {
    // ICU collations are compiled into PostgreSQL rather than read from the operating system's
    // locales, which is the whole argument for stating the collation instead of pinning `initdb`:
    // it holds on a `C` cluster, on a restored backup, and on a managed Postgres nobody ran
    // `initdb` on. If this row ever disappears, the decision's premise has gone with it.
    const [{ provider }] = await owner.query<{ provider: string }[]>(
      `SELECT collprovider::text AS provider FROM pg_collation WHERE collname = $1 LIMIT 1`,
      [HUMAN_TEXT_COLLATION],
    );
    expect(provider).toBe('i');
  });
});
