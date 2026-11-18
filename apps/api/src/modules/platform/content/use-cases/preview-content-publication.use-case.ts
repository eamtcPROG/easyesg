import { isPublishable, payloadLocales, setLocales } from '../domain/content-console';
import type { ContentConsoleStore } from '../interfaces/content-console-store.interface';
import {
  CONTENT_DRAFT_STATE,
  type ContentItemRef,
  type ContentPublicationPreview,
} from '../models/content-console.model';

export interface PreviewContentPublicationCommand {
  readonly items: readonly ContentItemRef[];
  /** The operator asking, for the organization count's acquisition log. */
  readonly requesterId: string;
}

/**
 * UX-123's preview and scope disclosure for a content set (task 67.5; UC-72; FR-62 behaviour 4): for each item, whether
 * a draft in review is there and its reader would read it, the locales it carries and whether it replaces a version in
 * force; the locales the sign-off must name; and the reach — **every organization**, since every member reads the help
 * centre and the plans, and **no report**, since FR-61 content is no report's (§12.5.6's task-67.5 row (3)). Writes
 * nothing.
 */
export class PreviewContentPublication {
  constructor(private readonly store: ContentConsoleStore) {}

  async execute(command: PreviewContentPublicationCommand): Promise<ContentPublicationPreview> {
    const [items, organizations] = await Promise.all([
      this.store.items(),
      this.store.organizationCount({ requesterId: command.requesterId }),
    ]);

    const named = command.items.map((ref) => {
      const item = items.find((candidate) => candidate.kind === ref.kind && candidate.key === ref.key);
      const draft = item?.draft?.state === CONTENT_DRAFT_STATE.IN_REVIEW ? item.draft : null;
      return {
        kind: ref.kind,
        key: ref.key,
        publishable: draft !== null && isPublishable({ kind: ref.kind, payload: draft.payload }),
        locales: draft === null ? [] : payloadLocales(draft.payload),
        replaces: item?.inForce != null,
        payload: draft?.payload,
      };
    });

    return {
      items: named.map(({ payload: _payload, ...item }) => item),
      locales: setLocales(named.flatMap((item) => (item.payload === undefined ? [] : [item.payload]))),
      reach: { organizations, reports: 0 },
    };
  }
}
