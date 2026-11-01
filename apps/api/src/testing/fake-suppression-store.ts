import type {
  SuppressAddressCommand,
  SuppressionStore,
} from '@api/modules/platform/notification/interfaces/suppression-store.interface';

/**
 * `SUPPRESSION_STORE` in memory, for the specs that exercise the channel without a database (task 51.4).
 *
 * **It models the adapter's first-write-wins**, not merely its return values: `notification.suppressed_address`
 * takes `ON CONFLICT DO NOTHING`, so a second hard bounce keeps the first row's word for when the platform
 * stopped trying. A fake that let the second write overwrite would make a spec pass that the real store fails.
 */
export class FakeSuppressionStore implements SuppressionStore {
  readonly suppressed = new Map<string, SuppressAddressCommand>();

  isSuppressed(addressKey: string): Promise<boolean> {
    return Promise.resolve(this.suppressed.has(addressKey));
  }

  suppress(command: SuppressAddressCommand): Promise<void> {
    if (!this.suppressed.has(command.addressKey)) this.suppressed.set(command.addressKey, command);
    return Promise.resolve();
  }
}
