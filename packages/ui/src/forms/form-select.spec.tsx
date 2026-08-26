import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FormSelect } from './form-select';
import { FormSummary } from './form-summary';

/**
 * `FormSelect`'s contract, and specifically the failure that has no other detector.
 *
 * A Radix control reports `onValueChange`, not `onChange`. A JSX spread does not check excess
 * properties, so a `FormSelect` wired `onChange={input.onChange}` compiles, renders correctly,
 * opens correctly, highlights correctly — and never tells the form anything. Nothing else in the
 * gate set can see that: typecheck passes, lint passes, and the specimen looks right. So the
 * first test here chooses an option and asserts the value reached `handleSubmit`.
 */
interface Invitation {
  role: string;
}

/**
 * jsdom implements neither of these, and Radix Select calls both while opening. Stubbed rather
 * than the menu left untested, because the untested half is the half this file exists for.
 */
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const ROLES = [
  { value: 'editor', label: 'Editor', description: 'Enters and changes report data.' },
  { value: 'viewer', label: 'Viewer', description: 'Reads everything, changes nothing.' },
];

function InviteForm({ onValid = vi.fn() }: { onValid?: (values: Invitation) => void }) {
  const { control, handleSubmit } = useForm<Invitation>({ defaultValues: { role: '' } });

  return (
    <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate>
      <FormSummary control={control} title="Some fields need attention" />
      <FormSelect
        control={control}
        name="role"
        label="Role in this organisation"
        placeholder="Choose a role"
        options={ROLES}
        rules={{ required: 'Choose a role before sending the invitation.' }}
      />
      <button type="submit">Send</button>
    </form>
  );
}

describe('FormSelect', () => {
  it('reports the chosen value to the form', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<InviteForm onValid={onValid} />);

    await user.click(screen.getByRole('combobox', { name: 'Role in this organisation' }));
    await user.click(await screen.findByRole('option', { name: /Editor/ }));
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(onValid).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'editor' }),
      expect.anything(),
    );
  });

  /** `''` is "nothing chosen" on both sides of the binding — see `useBoundField`. */
  it('shows the placeholder until something is chosen', () => {
    render(<InviteForm />);
    expect(screen.getByRole('combobox', { name: 'Role in this organisation' })).toHaveTextContent(
      'Choose a role',
    );
  });

  /**
   * The id agreement the whole layer exists for: the summary derives the same id from the same
   * `control`, so its link reaches the trigger without either side declaring a constant.
   */
  it('links the summary entry to the control that failed', async () => {
    const user = userEvent.setup();
    render(<InviteForm />);

    await user.click(screen.getByRole('button', { name: 'Send' }));

    const entry = await screen.findByRole('link', {
      name: 'Choose a role before sending the invitation.',
    });
    const trigger = screen.getByRole('combobox', { name: 'Role in this organisation' });
    expect(entry).toHaveAttribute('href', `#${trigger.id}`);
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
  });
});
