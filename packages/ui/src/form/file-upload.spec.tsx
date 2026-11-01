import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUpload } from './file-upload';

/**
 * `FileUpload`'s contract — §11.5's File upload, built at task 204.2 for S-09's spreadsheet import.
 *
 * What a presentational control can be held to is structural: that it is a real file chooser the zone names, that a
 * file picked and a file dropped reach the caller the same way, that the same file chosen twice is two choices, and
 * that an error and a disabled zone are wired as every other field's are. The dashed boundary is the artboard's.
 */
const sheet = () => new File(['Sursa;Cifra\nGaz;500\n'], 'facturi.csv', { type: 'text/csv' });

const zone = () => screen.getByText('Drop your spreadsheet here').closest('label') as HTMLLabelElement;

const dropOn = (target: HTMLElement, files: File[]) =>
  fireEvent.drop(target, { dataTransfer: { files, types: ['Files'] } });

describe('FileUpload (§11.5)', () => {
  it('is a real file chooser, named by the zone it sits under', () => {
    render(<FileUpload label="Drop your spreadsheet here" hint="An .xlsx or .csv file" browse="browse" onFile={() => {}} />);

    const input = screen.getByLabelText(/Drop your spreadsheet here/u);
    expect(input).toHaveAttribute('type', 'file');
    expect(zone()).toHaveAttribute('for', input.id);
  });

  it('hands over a picked file, and the same file picked again is a second choice', async () => {
    const onFile = vi.fn();
    render(<FileUpload label="Drop your spreadsheet here" hint="hint" browse="browse" onFile={onFile} />);
    const input = screen.getByLabelText(/Drop your spreadsheet here/u);
    const file = sheet();

    await userEvent.upload(input, file);
    await userEvent.upload(input, file);

    expect(onFile).toHaveBeenCalledTimes(2);
    expect(onFile).toHaveBeenLastCalledWith(file);
  });

  it('hands over a dropped file — one, whatever else the drop carried — and is active only while one is held', () => {
    const onFile = vi.fn();
    render(<FileUpload label="Drop your spreadsheet here" hint="hint" browse="browse" onFile={onFile} />);
    const first = sheet();

    fireEvent.dragEnter(zone(), { dataTransfer: { types: ['Files'] } });
    expect(zone()).toHaveAttribute('data-active');
    dropOn(zone(), [first, sheet()]);

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(first);
    expect(zone()).not.toHaveAttribute('data-active');
  });

  it('ends the hold when the file leaves the zone, not when it crosses the zone’s own lines', () => {
    render(<FileUpload label="Drop your spreadsheet here" hint="hint" browse="browse" onFile={() => {}} />);
    const line = screen.getByText('Drop your spreadsheet here');

    // jsdom has no `DragEvent`, and `fireEvent.dragLeave` drops `relatedTarget` from its init; a native `dragleave`
    // carries it, and React's handler reads it the same way.
    const leaveTowards = (relatedTarget: Element) =>
      fireEvent(zone(), new MouseEvent('dragleave', { bubbles: true, relatedTarget }));

    fireEvent.dragEnter(zone(), { dataTransfer: { types: ['Files'] } });
    leaveTowards(line);
    expect(zone()).toHaveAttribute('data-active');
    leaveTowards(document.body);
    expect(zone()).not.toHaveAttribute('data-active');
  });

  it('wires an error as every field does: announced, invalid, described', () => {
    render(
      <FileUpload
        label="Drop your spreadsheet here"
        hint="hint"
        browse="browse"
        onFile={() => {}}
        error="This file is larger than 1 MB, so it cannot be read. Save a smaller one and choose it again."
      />,
    );
    const input = screen.getByLabelText(/Drop your spreadsheet here/u);

    expect(screen.getByRole('alert')).toHaveTextContent('larger than 1 MB');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', screen.getByRole('alert').id);
  });

  it('takes no file while disabled, picked or dropped', async () => {
    const onFile = vi.fn();
    render(<FileUpload label="Drop your spreadsheet here" hint="hint" browse="browse" onFile={onFile} disabled />);

    await userEvent.upload(screen.getByLabelText(/Drop your spreadsheet here/u), sheet());
    fireEvent.dragEnter(zone(), { dataTransfer: { types: ['Files'] } });
    dropOn(zone(), [sheet()]);

    expect(onFile).not.toHaveBeenCalled();
    expect(zone()).not.toHaveAttribute('data-active');
  });
});
