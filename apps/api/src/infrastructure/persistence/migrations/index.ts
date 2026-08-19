import { Baseline1787097600000 } from './1787097600000-baseline';
import { CoreOrganization1787140800000 } from './1787140800000-core-organization';

/**
 * The migration set, registered explicitly rather than discovered by glob.
 *
 * The usual `migrations: [__dirname + '/migrations/*{.ts,.js}']` is wrong here for two
 * reasons. The small one: tsconfig sets `declaration: true`, so `*.ts` also matches the
 * emitted `.d.ts` files in dist and TypeORM tries to load a type declaration as a migration.
 * The real one: this list is the schema's history, and a history assembled by filesystem
 * order is not reviewable — an explicit array puts every addition in a diff, orders them
 * deterministically, and fails to compile if a file is renamed or deleted out from under it.
 *
 * Adding a migration is two edits: the file, and one line here. `index.spec.ts` fails if the
 * second is forgotten, because "it worked locally and the deploy skipped a migration" is not
 * a class of bug worth discovering in production.
 */
export const migrations = [Baseline1787097600000, CoreOrganization1787140800000];
