import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { FormPasswordField } from './form-password-field';
import { FormSummary } from './form-summary';
import { FormTextField } from './form-text-field';

/**
 * The `@easyesg/ui/forms` contract: `control` and `name` are enough.
 *
 * Three app specs already exercise the happy path through real screens. What is pinned here is
 * what those cannot see — the id agreement that replaced three hand-kept copies, and the two
 * guards inside the layer that exist because their failure is silent.
 */
interface Credential {
  email: string;
  password: string;
}

const SUMMARY_TITLE = 'Some fields need attention';

function CredentialForm({
  onValid = vi.fn(),
  summaryFirst = true,
}: {
  onValid?: (values: Credential) => void;
  summaryFirst?: boolean;
}) {
  const { control, handleSubmit } = useForm<Credential>({ mode: 'onTouched' });
  const summary = <FormSummary control={control} title={SUMMARY_TITLE} />;

  return (
    <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate>
      {summaryFirst ? summary : null}
      <FormTextField
        control={control}
        name="email"
        label="Email"
        rules={{ required: 'Email is missing' }}
      />
      <FormPasswordField
        control={control}
        name="password"
        label="Password"
        revealLabel="Show"
        concealLabel="Hide"
        rules={{ required: 'Password is missing' }}
      />
      {summaryFirst ? null : summary}
      <button type="submit">Continue</button>
    </form>
  );
}

const submitEmpty = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  return screen.findByRole('alert');
};

describe('@easyesg/ui/forms · bound controls', () => {
  it('binds value, label and submission from control + name alone', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<CredentialForm onValid={onValid} />);

    await user.type(screen.getByLabelText('Email'), 'operator@easyesg.md');
    await user.type(screen.getByLabelText('Password'), 'Parola123!');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onValid.mock.calls[0][0]).toEqual({
      email: 'operator@easyesg.md',
      password: 'Parola123!',
    });
  });

  it('renders the field error inline, from the rule the caller supplied', async () => {
    const user = userEvent.setup();
    render(<CredentialForm />);

    await submitEmpty(user);

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/Email is missing/);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([true, false])(
    'links every summary entry to the field it names (summary rendered first: %s)',
    async (summaryFirst) => {
      const user = userEvent.setup();
      render(<CredentialForm summaryFirst={summaryFirst} />);

      const summary = await submitEmpty(user);

      // The whole point of the layer: the link and its target agree without anyone maintaining a
      // shared constant. Order-independent, because whichever consumer renders first seeds the
      // scope — a summary above the fields is the normal case, below them the regression test.
      for (const label of ['Email', 'Password']) {
        const fieldId = screen.getByLabelText(label).id;
        expect(fieldId).not.toBe('');
        expect(summary.querySelector(`a[href="#${fieldId}"]`)).not.toBeNull();
      }
    },
  );

  it('gives two forms on one page distinct field ids', async () => {
    const user = userEvent.setup();
    render(
      <>
        <CredentialForm />
        <CredentialForm />
      </>,
    );

    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);

    // Duplicate ids would break both the summary links and the label association — and the
    // scope is per `control`, which is what makes two independent forms safe by construction.
    const ids = screen.getAllByLabelText('Email').map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('says nothing before the first submit attempt', async () => {
    const user = userEvent.setup();
    render(<CredentialForm />);

    // Touch and leave the field empty: `mode: 'onTouched'` marks it invalid, but a summary that
    // appears while someone is still filling the form is noise.
    await user.click(screen.getByLabelText('Email'));
    await user.tab();

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('omits a message-less rule rather than linking an empty entry', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();

    function Bare() {
      const { control, handleSubmit } = useForm<{ email: string }>();
      return (
        <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate>
          <FormSummary control={control} title={SUMMARY_TITLE} />
          {/* A `validate` returning `false` — valid react-hook-form, and it produces a FieldError
              carrying a `type` and an empty `message`. The walk must stop at that leaf: without
              the `type` check it would descend into the error's `ref`, which is a DOM node, and
              emit junk links from its properties. (`required: true` is the same trap and is
              closed at the type level instead — see `BoundRules`.) */}
          <FormTextField
            control={control}
            name="email"
            label="Email"
            rules={{ validate: () => false }}
          />
          <button type="submit">Continue</button>
        </form>
      );
    }

    render(<Bare />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // The rule fired — the form did not submit…
    expect(onValid).not.toHaveBeenCalled();
    // …and nothing was announced, which is right: a summary titled "some fields need attention"
    // with no links tells the reader neither what is wrong nor where, and `FormErrorSummary`
    // already renders null on empty items. The walk stopped at the leaf.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('starts controlled, so typing never trips React’s uncontrolled-to-controlled warning', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<CredentialForm />);

    await user.type(screen.getByLabelText('Email'), 'a');

    // With no `defaultValues`, useController hands back `undefined` on the first render — the
    // reason the binding coerces to ''. React only warns on the transition, i.e. on first type.
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
