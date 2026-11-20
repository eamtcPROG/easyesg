import type { ContentConsoleStore } from '../interfaces/content-console-store.interface';
import type { ContentConsole } from '../models/content-console.model';

/**
 * A-03's read (task 67.5; UC-71, UC-73, UC-74): every FR-61 item with its version in force and its open draft, FR-64's
 * queue, and the locale registration — one read, since the screen draws all three and each changes rarely.
 */
export class ListContentConsole {
  constructor(private readonly store: ContentConsoleStore) {}

  async execute(): Promise<ContentConsole> {
    const [items, fallbacks, registration] = await Promise.all([
      this.store.items(),
      this.store.fallbacks(),
      this.store.registration(),
    ]);
    return { items, fallbacks, registration };
  }
}
