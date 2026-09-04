import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { FormCheckbox } from './form-checkbox';
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

/**
 * `FormCheckbox` and the `toggle` shape it spreads (task 97).
 *
 * **Guarded only from `apps/web` until now**, which is the wrong package: the binding lives here,
 * its failure mode is the one `useBoundField`'s own header calls silent — *"renders an unchecked
 * box that never changes and nothing fails"* — and a control bound to `value` instead of `checked`
 * leaves this package's 107 tests green while every consumer is broken.
 */
interface Preference {
  remember: boolean;
}

function PreferenceForm({ onValid = vi.fn() }: { onValid?: (values: Preference) => void }) {
  const { control, handleSubmit, setValue } = useForm<Preference>({
    mode: 'onTouched',
    defaultValues: { remember: false },
  });

  return (
    <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate>
      <FormCheckbox control={control} name="remember" label="Keep me signed in" />
      {/* A programmatic write, which is the only thing that tells a CONTROLLED checkbox from an
          uncontrolled one — see the case below. */}
      <button type="button" onClick={() => setValue('remember', true)}>
        Tick it for me
      </button>
      <button type="submit">Continue</button>
    </form>
  );
}

describe('FormCheckbox', () => {
  it('reports the boolean, not the event and not a string', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<PreferenceForm onValid={onValid} />);

    await user.click(screen.getByRole('checkbox', { name: 'Keep me signed in' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // `toEqual` on the whole value, not a truthiness check: binding through `value` submits the
    // string `'on'`, which is truthy and would pass a looser assertion while the stored answer is
    // the wrong type all the way to the wire.
    expect(onValid).toHaveBeenCalledWith(
      expect.objectContaining({ remember: true }),
      expect.anything(),
    );
  });

  it('renders the declared default as unchecked and toggles from it', async () => {
    const user = userEvent.setup();
    render(<PreferenceForm />);
    const box = screen.getByRole('checkbox', { name: 'Keep me signed in' });

    expect(box).not.toBeChecked();
    await user.click(box);
    expect(box).toBeChecked();
    await user.click(box);
    expect(box).not.toBeChecked();
  });

  /**
   * **The one case that distinguishes `toggle` from binding `value`**, and it took a mutation to
   * find: react-hook-form's own `onChange` already unwraps a checkbox event, and a checkbox given
   * `value` instead of `checked` is *uncontrolled* — so it still ticks under a click, records the
   * right boolean, and passes every assertion above. What it cannot do is follow the form. A
   * `setValue` from anywhere else — a reset, a "select all", a value restored from a draft — moves
   * the state and leaves the box showing the opposite of what will be submitted.
   */
  it('follows a value written by the form, not only by a click', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<PreferenceForm onValid={onValid} />);
    const box = screen.getByRole('checkbox', { name: 'Keep me signed in' });

    await user.click(screen.getByRole('button', { name: 'Tick it for me' }));

    expect(box).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onValid).toHaveBeenCalledWith(
      expect.objectContaining({ remember: true }),
      expect.anything(),
    );
  });
});
