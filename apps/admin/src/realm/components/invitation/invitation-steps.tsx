import { useMutation } from '@tanstack/react-query';
import { API_OUTCOME, type AdminInvitationPreview } from '@easyesg/contracts';
import { Panel } from '@easyesg/ui';
import { useReducer } from 'react';
import { useTranslations } from 'use-intl';
import { acceptAdminInvitation, stageAdminEnrolment } from '../../queries/invitation';
import {
  INITIAL_INVITATION_STATE,
  INVITATION_EVENT,
  INVITATION_STEP,
  invitationReducer,
} from '../../tools/invitation-state';
import { RefusalCallout } from '../shared/refusal-callout';
import { InvitationEnrolmentStep } from './invitation-enrolment-step';
import { InvitationPasswordStep } from './invitation-password-step';
import { InvitationRefused } from './invitation-refused';

/** A link that stopped being acceptable part-way — expired, revoked, replaced — is `410 Gone`. */
const HTTP_GONE = 410;

/**
 * A-20's two steps over a live link (task 67.4): a password, then the factor — and only the second
 * step's code creates the account (§5.2 A-20's *the account exists only once the code confirms*).
 *
 * The card is A-01's anatomy — kicker, title and lede; the step; the realm statement — because the two
 * screens share a layout and nothing else.
 */
export function InvitationSteps({
  token,
  preview,
  onAccepted,
}: {
  readonly token: string;
  readonly preview: AdminInvitationPreview;
  readonly onAccepted: () => void;
}) {
  const t = useTranslations('realm.invitation');
  const tRealm = useTranslations('realm.chrome.realm');
  const [{ step, failure }, dispatch] = useReducer(invitationReducer, INITIAL_INVITATION_STATE);

  const { mutate: stage, isPending: staging } = useMutation({ mutationFn: stageAdminEnrolment });
  const { mutate: accept, isPending: accepting } = useMutation({ mutationFn: acceptAdminInvitation });

  if (failure?.status === API_OUTCOME.Problem && failure.problem.status === HTTP_GONE) {
    return <InvitationRefused failure={failure} />;
  }

  // A const alias of the discriminant check, so `step.offer` below is narrowed rather than asserted.
  const onEnrolment = step.kind === INVITATION_STEP.ENROLMENT;

  return (
    <Panel className="overflow-hidden !p-0">
      <div className="border-b border-[var(--border-default)] px-[var(--space-7)] pb-[var(--space-5)] pt-[var(--space-6)]">
        <p className="t-code mb-[var(--space-2)] text-[10.5px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {t('kicker')}
        </p>
        <h1 className="t-heading-2 mb-[var(--space-2)] text-[var(--text-default)]">
          {onEnrolment ? t('enrolment.title') : t('password.title')}
        </h1>
        <p className="t-caption text-[var(--text-body)]">
          {onEnrolment
            ? t('enrolment.lede')
            : t.rich('password.lede', {
                email: () => <strong className="font-semibold">{preview.email}</strong>,
                realm: tRealm(preview.role),
              })}
        </p>
      </div>

      <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-7)] py-[var(--space-5)]">
        {failure === null ? null : (
          <RefusalCallout failure={failure} title={t('problemTitle')} fallback={t('refused.body')} />
        )}

        {onEnrolment ? (
          <InvitationEnrolmentStep
            offer={step.offer}
            busy={accepting}
            onSubmit={(totpCode) => {
              dispatch({ type: INVITATION_EVENT.SUBMITTED });
              accept(
                { token, password: step.password, totpCode },
                {
                  onSuccess: (outcome) => {
                    if (outcome.status === API_OUTCOME.Ok) onAccepted();
                    else dispatch({ type: INVITATION_EVENT.REFUSED, failure: outcome });
                  },
                },
              );
            }}
            onBack={() => dispatch({ type: INVITATION_EVENT.PASSWORD_REOPENED })}
          />
        ) : (
          <InvitationPasswordStep
            busy={staging}
            onSubmit={(password) => {
              dispatch({ type: INVITATION_EVENT.SUBMITTED });
              stage(token, {
                onSuccess: (outcome) => {
                  dispatch(
                    outcome.status === API_OUTCOME.Ok
                      ? { type: INVITATION_EVENT.ENROLMENT_OFFERED, password, offer: outcome.value }
                      : { type: INVITATION_EVENT.REFUSED, failure: outcome },
                  );
                },
              });
            }}
          />
        )}
      </div>

      <div className="border-t border-[var(--border-default)] bg-[var(--surface-sunken)] px-[var(--space-7)] py-[var(--space-4)]">
        <p className="t-caption text-[var(--text-body)]">{t('realmNote')}</p>
      </div>
    </Panel>
  );
}
