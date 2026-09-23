import { getTranslations } from 'next-intl/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Unreachable } from '../../../shared/components/unreachable';
import styles from '../../../shared/styles/identity-screens.module.css';
import { previewUnsubscribeAction } from '../../actions/actions';
import { UNSUBSCRIBE_VIEW, unsubscribeView } from '../../tools/unsubscribe';
import { ConfirmUnsubscribe } from '../parts/confirm-unsubscribe';
import { UNSUBSCRIBE_MESSAGES } from '../shared/unsubscribe-messages';
import { SwitchedOff } from '../states/switched-off';
import { Unusable } from '../states/unusable';

/**
 * S-38's one region: the read, the branch, and one surface per arm (task 52.2.2; FR-169; `design_spec.md` S-38).
 *
 * **The section reads; the parts render.** The read is a preview that changes nothing — the reason S-38 is a page at
 * all, since a mail scanner prefetching the link must reach this and no further. A problem document from it is drawn
 * as unreachable: the api answers every link with a standing, so a refusal here is not a fact about the link.
 */
export async function UnsubscribeSection({ token }: { readonly token: string }) {
  const [preview, t] = await Promise.all([previewUnsubscribeAction({ token }), getTranslations(UNSUBSCRIBE_MESSAGES)]);
  const view = unsubscribeView(preview.status === API_OUTCOME.Ok ? preview.value : null);

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      {view.kind === UNSUBSCRIBE_VIEW.CONFIRM ? (
        <ConfirmUnsubscribe token={token} categoryName={view.categoryName} />
      ) : view.kind === UNSUBSCRIBE_VIEW.SWITCHED_OFF ? (
        <SwitchedOff categoryName={view.categoryName} />
      ) : view.kind === UNSUBSCRIBE_VIEW.UNUSABLE ? (
        <Unusable />
      ) : (
        <Unreachable />
      )}
    </>
  );
}
