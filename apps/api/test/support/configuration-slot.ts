import type { INestApplicationContext } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ConfigurationPublisher } from '@api/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { CORE_DATA_SOURCE } from '@api/infrastructure/persistence/data-source';

/**
 * What a configuration slot held before a suite touched it, and how to put it back (task 172).
 *
 * **These suites run against the developer's own store** — the Compose stack is the dev environment — so a suite that
 * publishes a stub provider or a test category and then "restores the seed" wipes whatever an operator had configured
 * there. That is how an owner's Google configuration was disabled twice in one afternoon by suites nobody pointed at
 * it. A suite snapshots the slot before its first publication and restores exactly that afterwards — the payload **and
 * who published it**, so a slot an operator owned stays theirs and the next `config:seed` keeps it.
 */
export interface SlotSnapshot {
  readonly kind: string;
  readonly scope: string;
  /** Null where nothing was in force — a store that was never seeded. */
  readonly payload: Record<string, unknown> | null;
  readonly publishedBy: string | null;
}

export async function snapshotSlot(
  app: INestApplicationContext,
  slot: { readonly kind: string; readonly scope: string },
): Promise<SlotSnapshot> {
  const dataSource = app.get<DataSource>(getDataSourceToken(CORE_DATA_SOURCE));
  const rows = await dataSource.query<{ payload: Record<string, unknown>; created_by: string | null }[]>(
    `SELECT v.payload, v.created_by
       FROM config.entry_schedule s
       JOIN config.entry_version  v ON v.id = s.version_id
      WHERE s.kind = $1 AND s.scope = $2 AND s.validity @> current_date`,
    [slot.kind, slot.scope],
  );
  return { ...slot, payload: rows[0]?.payload ?? null, publishedBy: rows[0]?.created_by ?? null };
}

/**
 * Puts the snapshot back as a new publication under its original publisher. Where nothing was in force, `fallback` —
 * the committed seed — is what the suite leaves, since the store has no way to un-publish a slot.
 */
export async function restoreSlot(
  app: INestApplicationContext,
  snapshot: SlotSnapshot,
  fallback: Record<string, unknown>,
): Promise<void> {
  await app.get(ConfigurationPublisher).publish({
    kind: snapshot.kind,
    scope: snapshot.scope,
    payload: snapshot.payload ?? fallback,
    actorId: snapshot.payload === null ? null : snapshot.publishedBy,
  });
  await app.get(ConfigurationStore).poll();
}
