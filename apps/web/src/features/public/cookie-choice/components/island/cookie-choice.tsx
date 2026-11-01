'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { recordCookieChoiceAction } from '../../actions/actions';
import { answersPolicyInForce } from '../../tools/cookie-choice-cookie';
import { COOKIE_CHOICE_EVENT, INITIAL_COOKIE_CHOICE, cookieChoiceReducer } from '../../tools/cookie-choice-state';
import { CookieBanner } from '../banner/cookie-banner';
import { CookieSettings } from '../settings/cookie-settings';
import { onCookieSettingsRequested } from '../shared/cookie-settings-request';
import { cookieChoiceChanged, useCookieRecord } from '../shared/use-cookie-record';

/**
 * S-31, the cookie choice (task 223; FR-206; `design_spec.md` S-31, OQ-27): the banner on a first visit to the tenant
 * site and the settings behind it. **Mounted once, by the locale layout, beside every page** — the banner shows on any
 * screen until it is answered, and *Cookie settings* in every footer asks this island to open the same panel
 * (`cookie-settings-request.ts`).
 *
 * **Beside the page, never around it**: it changes as hydration ends — the browser's cookie is read only then, so the
 * home stays prerendered (`architecture.md` §12.5.6's task-223 row (8)) — and anything it provided to the page would
 * reach a Suspense boundary still streaming, which React then renders a second time (`cookie-settings-request.ts`).
 *
 * **One answer, from either place**: *I understand* and the settings' *Save* both record that the reader was told —
 * there is nothing optional to turn on or off, so there is nothing else to say (OQ-27).
 */
export function CookieChoice({
  necessaryCookies,
}: {
  /** The site's cookies, by name — the settings name what *Necessary* holds. */
  readonly necessaryCookies: readonly string[];
}) {
  const [state, dispatch] = useReducer(cookieChoiceReducer, INITIAL_COOKIE_CHOICE);
  const { known, record } = useCookieRecord();

  const answer = useCallback(async () => {
    dispatch({ type: COOKIE_CHOICE_EVENT.ANSWER_SENT });
    const failure = await recordCookieChoiceAction();
    if (failure) {
      dispatch({ type: COOKIE_CHOICE_EVENT.ANSWER_FAILED });
      return;
    }
    cookieChoiceChanged();
    dispatch({ type: COOKIE_CHOICE_EVENT.ANSWER_RECORDED });
  }, []);
  const openSettings = useCallback(() => dispatch({ type: COOKIE_CHOICE_EVENT.SETTINGS_OPENED }), []);
  const closeSettings = useCallback(() => dispatch({ type: COOKIE_CHOICE_EVENT.SETTINGS_CLOSED }), []);

  useEffect(() => onCookieSettingsRequested(openSettings), [openSettings]);

  return (
    <>
      {known && !answersPolicyInForce(record) ? (
        <CookieBanner
          saving={state.saving && !state.settingsOpen}
          failed={state.failed && !state.settingsOpen}
          onUnderstood={answer}
          onSettings={openSettings}
        />
      ) : null}
      <CookieSettings
        open={state.settingsOpen}
        saving={state.saving}
        failed={state.failed}
        necessaryCookies={necessaryCookies}
        onSave={answer}
        onClose={closeSettings}
      />
    </>
  );
}
