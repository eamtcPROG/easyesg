import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusField } from './focus-field';

/** The anatomy `DisclosureField` renders: a group named by its label's id, the control inside. */
const field = (anchor: string, inner: string) =>
  `<section role="group" aria-labelledby="${anchor}"><span id="${anchor}">Q</span>${inner}</section>`;

describe('focusField', () => {
  // jsdom lays nothing out, so it implements no scrolling; the call is what is asserted.
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the field’s control, after scrolling the field into view', () => {
    document.body.innerHTML = field('disclosure-Turnover--0', '<input type="text" />');
    expect(focusField({ document, hash: '#disclosure-Turnover--0' })).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('input'));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('focuses the checked option of a choice rather than the first', () => {
    document.body.innerHTML = field(
      'disclosure-Basis--0',
      '<input type="radio" name="b" value="a" /><input type="radio" name="b" value="b" checked />',
    );
    focusField({ document, hash: '#disclosure-Basis--0' });
    expect(document.activeElement).toBe(document.querySelector('input[value="b"]'));
  });

  it('focuses the field itself where it has no control — a derived figure — without making it a tab stop', () => {
    document.body.innerHTML = field('disclosure-Total--0', '<output>12</output>');
    focusField({ document, hash: '#disclosure-Total--0' });
    const group = document.querySelector('[role="group"]');
    expect(document.activeElement).toBe(group);
    expect(group?.getAttribute('tabindex')).toBe('-1');
  });

  it('leaves a fragment that names no field on this step alone', () => {
    document.body.innerHTML = field('disclosure-Turnover--0', '<input type="text" />');
    expect(focusField({ document, hash: '#disclosure-Elsewhere--0' })).toBe(false);
    expect(focusField({ document, hash: '' })).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });
});
