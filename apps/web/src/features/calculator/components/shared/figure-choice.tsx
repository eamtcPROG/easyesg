import { useFormatter } from 'next-intl';
import { get, useFormState, useWatch, type Control, type FieldPathByValue, type FieldValues } from 'react-hook-form';
import { decimalForEditing } from '@/lib/decimal-input';
import { NumberChoice } from '@/shared/number-choice';
import { readFigure } from '../../tools/figure-input';

/**
 * The two readings of a form's figure typed so it reads two ways (task 220), beneath the field once `figureRule` has
 * refused it with the question: choosing one writes it back into the field, plainly in the reader's format, so the rule
 * passes and the form submits what was meant. Nothing is drawn while the field holds no such refusal.
 *
 * **In `shared/` because two regions draw it** — the add-a-source form (`adding/`) and the override form beside this
 * file. No directive: its readers are Client Components already.
 */
export function FigureChoice<Fields extends FieldValues>({
  control,
  name,
  onChoose,
}: {
  readonly control: Control<Fields>;
  readonly name: FieldPathByValue<Fields, string>;
  /** Called with the chosen reading as the field's text. */
  readonly onChoose: (text: string) => void;
}) {
  const format = useFormatter();
  const raw: string = useWatch({ control, name });
  const { errors } = useFormState({ control, name });
  const figure = readFigure({ raw, format });
  if (!('ambiguous' in figure) || get(errors, name) === undefined) return null;
  return (
    <NumberChoice
      readings={figure.ambiguous}
      onChoose={(value) => onChoose(decimalForEditing({ value, format }))}
    />
  );
}
