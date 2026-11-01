'use client';

import type { AcceptedLegalDocument } from '@easyesg/i18n';
import { TextLink } from '@easyesg/ui';
import { FormCheckbox } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { legalAcceptanceLabel } from '../tools/legal-acceptance-label';

/**
 * **In `identity/shared/components/` because more than one journey's form reads it: `register/components/register-form.tsx`
 * and `acceptance/components/form/accept-terms-form.tsx`.** The acceptance of the terms and the privacy notice (task 195;
 * `architecture.md` §12.5.6's task-195 row (4); `design_spec.md` S-01, S-43): one checkbox, required, naming each
 * document it accepts as a link to that document — the Register artboard's checkbox, which replaced the sentence that
 * said continuing was acceptance.
 *
 * **Its links open in a new tab, and the sentence says so** (project owner, 23 Oct 2026; §12.5.6's task-195 row (4)):
 * a reader who stops to read the terms halfway through S-01 keeps what they typed, and on S-43 keeps the box. The
 * warning is the sentence's own clause rather than each link's, which would say it twice in one line —
 * `recovered-stage.tsx`'s `target`/`rel` pair, its wording said once.
 *
 * **It names the documents the caller passes**: both on S-01, where an account accepts both; on S-43 only those owed,
 * so a release that moved the terms alone asks about the terms alone. **Required, with its message**, inline and in the
 * summary — `FormCheckbox` carries the rule as every bound control does, so an unticked box refuses the submission out
 * loud rather than in silence.
 */
export function LegalAcceptanceCheckbox<
  TValues extends FieldValues,
  TName extends FieldPathByValue<TValues, boolean>,
>({
  control,
  name,
  documents,
}: {
  readonly control: Control<TValues>;
  readonly name: TName;
  readonly documents: readonly AcceptedLegalDocument[];
}) {
  const t = useTranslations('identity.legalAcceptance');

  return (
    <FormCheckbox
      control={control}
      name={name}
      rules={{ required: t('missing') }}
      label={t.rich(legalAcceptanceLabel(documents), {
        terms: (chunks) => (
          <TextLink asChild>
            <Link href={ROUTES.LEGAL_TERMS} target="_blank" rel="noopener">
              {chunks}
            </Link>
          </TextLink>
        ),
        privacy: (chunks) => (
          <TextLink asChild>
            <Link href={ROUTES.LEGAL_PRIVACY} target="_blank" rel="noopener">
              {chunks}
            </Link>
          </TextLink>
        ),
      })}
    />
  );
}
