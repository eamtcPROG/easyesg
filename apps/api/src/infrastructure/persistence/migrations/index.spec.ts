import { readdirSync } from 'node:fs';
import { migrations } from './index';

/**
 * The cost of registering migrations explicitly instead of by glob (see index.ts) is that
 * someone can add the file and forget the line. This is that cost, paid once.
 *
 * The failure it prevents is the expensive kind: a migration present in the repository, absent
 * from the run, and therefore invisible — the schema is simply missing something, in whichever
 * environment deployed first, and the diff shows the file is right there.
 */
describe('migration registry', () => {
  const fileTimestamps = readdirSync(__dirname)
    .filter((file) => /^\d+-.+\.ts$/.test(file))
    .map((file) => file.split('-')[0]);

  const registeredTimestamps = migrations.map((migration) => {
    const match = /\d+$/.exec(migration.name);
    if (!match) throw new Error(`${migration.name} does not end in its timestamp`);
    return match[0];
  });

  it('registers every migration file on disk, and no others', () => {
    expect([...registeredTimestamps].sort()).toEqual([...fileTimestamps].sort());
  });

  it('is ordered oldest first, so the array reads as the schema’s history', () => {
    expect(registeredTimestamps).toEqual([...registeredTimestamps].sort());
  });

  it('has no duplicate timestamps — two migrations claiming one slot apply in an undefined order', () => {
    expect(new Set(registeredTimestamps).size).toBe(registeredTimestamps.length);
  });
});
