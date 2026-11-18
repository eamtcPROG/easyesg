import { useQuery } from '@tanstack/react-query';
import { ADMIN_PERMISSION, CONTENT_KIND, type ContentConsole, type ContentKind } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { adminSessionQuery } from '~/realm/queries/session';
import { CONTENT_KIND_LABEL } from '../../../tools/content-kind-labels';
import {
  CONTENT_PANEL,
  itemAddress,
  itemRefOf,
  type ContentConsoleSearch,
} from '../../../tools/content-console-search';
import { ContentEditor } from '../editor/content-editor';
import { ContentList } from '../list/content-list';
import { LocaleRegistration } from '../locales/locale-registration';
import { PublishDialog } from '../publish/publish-dialog';
import { FallbackQueue } from '../queue/fallback-queue';

/**
 * A-03's board, ready (task 67.5; `design_spec.md` §5.2 A-03): the header with a new item of each kind and the
 * publication of what waits in review, the items, FR-64's queue and the locale registration — and, over them, the
 * open item's editor or the publication dialogue, each at its address (UX-4). **Publishing and the registration are
 * drawn only for an operator whose roles may publish** (task 67.13) — presentation; the api judges every write.
 */
export function ConsoleBoard({
  view,
  search,
  onSearchChange,
}: {
  readonly view: ContentConsole;
  readonly search: ContentConsoleSearch;
  readonly onSearchChange: (next: ContentConsoleSearch) => void;
}) {
  const t = useTranslations('platform.content');
  const tKinds = useTranslations('platform.content.kinds');
  const { data: operator } = useQuery(adminSessionQuery);
  const canPublish = operator?.permissions.includes(ADMIN_PERMISSION.CONTENT_PUBLISH) ?? false;
  // The publication's result, announced on the board once the dialogue closes — this screen's one notice.
  const [published, setPublished] = useState(false);

  const open = itemRefOf(search.item);
  const item = open === null ? null : (view.items.find((candidate) => candidate.kind === open.kind && candidate.key === open.key) ?? null);
  const create = (kind: ContentKind) => onSearchChange({ create: kind });
  const close = () => onSearchChange({});

  return (
    <section aria-labelledby="content-title" className="flex flex-col gap-[var(--space-6)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--space-4)]">
        <div className="flex flex-col gap-[var(--space-1)]">
          <h1 id="content-title" className="t-heading-1">
            {t('title')}
          </h1>
          <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
        </div>
        <div className="flex flex-wrap gap-[var(--space-3)]">
          {Object.values(CONTENT_KIND).map((kind) => (
            <Button key={kind} type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => create(kind)}>
              {t('newItem', { kind: tKinds(CONTENT_KIND_LABEL[kind]) })}
            </Button>
          ))}
          {canPublish ? (
            <Button
              type="button"
              onClick={() => {
                setPublished(false);
                onSearchChange({ panel: CONTENT_PANEL.PUBLISH });
              }}
            >
              {t('publishSet')}
            </Button>
          ) : null}
        </div>
      </header>

      {published ? (
        <p role="status" className="t-body">
          {t('published')}
        </p>
      ) : null}

      <ContentList items={view.items} onOpen={(entry) => onSearchChange({ item: itemAddress(entry) })} />
      <FallbackQueue entries={view.fallbacks} />
      {canPublish ? (
        <LocaleRegistration
          key={view.registration.revision}
          revision={view.registration.revision}
          codes={view.registration.codes}
        />
      ) : null}

      {open !== null || search.create !== undefined ? (
        <ContentEditor
          // Keyed by the item, so another item starts from its own draft — and a new item keeps its editor, and the
          // first save's announcement, as its address arrives.
          key={search.create === undefined ? search.item : 'new'}
          item={item}
          createKind={open === null ? (search.create ?? null) : null}
          canPublish={canPublish}
          onCreated={(created) => onSearchChange({ create: search.create, item: itemAddress(created) })}
          onClose={close}
        />
      ) : null}
      {search.panel === CONTENT_PANEL.PUBLISH && canPublish ? (
        <PublishDialog
          items={view.items}
          onPublished={() => {
            setPublished(true);
            close();
          }}
          onClose={close}
        />
      ) : null}
    </section>
  );
}
