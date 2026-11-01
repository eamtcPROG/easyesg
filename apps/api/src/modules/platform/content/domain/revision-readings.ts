import type { StoredItem } from './served-items';

/**
 * A kind's reader that reads each revision of an item once (task 76). **A published revision cannot change** (AD-4,
 * `config.reject_published_edit`), so its reading needs no invalidation — `FactorSetCatalog`'s reasoning — and a read
 * that checks every line against the taxonomy's element keys is paid once per publication, not once per reader.
 * Keyed by the item's key and replaced when its revision moves, so it holds one reading per item in force.
 */
export class RevisionReadings<Item> {
  private readonly readings = new Map<string, { readonly revision: number; readonly item: Item | null }>();

  constructor(private readonly read: (payload: unknown) => Item | null) {}

  item(stored: StoredItem): Item | null {
    const kept = this.readings.get(stored.key);
    if (kept?.revision === stored.revision) return kept.item;
    const item = this.read(stored.payload);
    this.readings.set(stored.key, { revision: stored.revision, item });
    return item;
  }
}
