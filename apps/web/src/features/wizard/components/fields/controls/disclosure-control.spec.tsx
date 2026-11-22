import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { DISCLOSURE_KIND, DISCLOSURE_ORIGIN, DISCLOSURE_STATE, type DisclosureField } from '@easyesg/contracts';
import { ANSWER_MAX_LENGTH } from '@easyesg/validation';
import ro from '@/messages/ro.json';
import { DisclosureControl } from './disclosure-control';

/**
 * The text bound at the field (task 259; UX-19 as amended) — the half of `architecture.md` §12.5.6's task-259 row that
 * S-07 owns: the count reads against the template's cell, and a text past it is refused here and never sent, as the
 * api would refuse it for its own value.
 *
 * **Mounted under a provider carrying `organization`**, because the control reads its own words from the field
 * namespace (task 158). The texts are set with one change event rather than typed: 32,768 keystrokes prove nothing a
 * paste does not.
 */
const NARRATIVE_LABEL = 'Descrierea certificărilor';

const field = (over: Partial<DisclosureField> = {}): DisclosureField => ({
  elementKey: 'DescriptionOfSustainabilityRelatedCertificationsOrLabels',
  changeCount: 0,
  places: null,
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
  derived: false,
  derivedFrom: [],
  explanation: null,
  overriddenBy: null,
  ordinal: 0,
  currency: null,
  kind: DISCLOSURE_KIND.TEXT_BLOCK,
  periodType: 'duration',
  axes: [],
  repeating: false,
  order: 0,
  label: NARRATIVE_LABEL,
  labelStanding: null,
  help: null,
  helpStanding: null,
  options: null,
  defaultValue: null,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  unitCodes: [],
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  fromRecord: false,
  followsScope: false,
  answeredIn: null,
  applicable: true,
  applicabilityCause: null,
  drivesApplicability: false,
  ...over,
});

const setUp = (over: Partial<DisclosureField> = {}) => {
  const onCommit = vi.fn();
  render(
    <NextIntlClientProvider locale="ro" messages={{ organization: ro.organization }}>
      <span id="field-label">{NARRATIVE_LABEL}</span>
      <DisclosureControl
        field={field(over)}
        readOnly={false}
        labelledBy="field-label"
        describedBy=""
        onCommit={onCommit}
      />
    </NextIntlClientProvider>,
  );
  return { onCommit, input: screen.getByRole('textbox', { name: NARRATIVE_LABEL }) };
};

/** The words the field shows past the bound, from the catalogue's own sentence's opening. */
const TOO_LONG = /^Textul depășește 32\.767 de caractere/u;

describe('DisclosureControl — the text bound (task 259)', () => {
  it('counts a narrative answer against what one template cell holds', () => {
    const { input } = setUp();
    fireEvent.change(input, { target: { value: 'ISO 14001' } });
    expect(screen.getByText('9 caractere din 32.767')).toBeInTheDocument();
  });

  it('sends an answer of exactly the bound', () => {
    const { input, onCommit } = setUp();
    fireEvent.change(input, { target: { value: 'ș'.repeat(ANSWER_MAX_LENGTH) } });
    expect(screen.queryByText(TOO_LONG)).not.toBeInTheDocument();
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect((onCommit.mock.calls[0]?.[0] as { valueText: string }).valueText).toHaveLength(ANSWER_MAX_LENGTH);
  });

  it('says one character past it at the field, keeps the text, and sends nothing', () => {
    const { input, onCommit } = setUp();
    const past = 'a'.repeat(ANSWER_MAX_LENGTH + 1);
    fireEvent.change(input, { target: { value: past } });

    expect(screen.getByText(TOO_LONG)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    // Nothing typed is lost, and no `maxlength` would have cut the paste short.
    expect(input).toHaveValue(past);
    expect(input).not.toHaveAttribute('maxlength');
  });

  it('holds a single-line text field to the same bound', () => {
    const { input, onCommit } = setUp({ kind: DISCLOSURE_KIND.TEXT });
    fireEvent.change(input, { target: { value: 'a'.repeat(ANSWER_MAX_LENGTH + 1) } });
    expect(screen.getByText(TOO_LONG)).toBeInTheDocument();
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
