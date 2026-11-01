import { readFigure } from './figure-input';

type Formatter = Parameters<typeof readFigure>[0]['format'];

/**
 * A bill's figure as a react-hook-form rule (task 220) — S-09's add-a-source and override forms, whose figures are form
 * fields rather than `NumberField`s: *must read as a figure*, and **a figure that reads two ways is refused with the
 * question**, quoting what was typed, so the form's summary lists it and `FigureChoice` beneath the field offers the two
 * readings. An empty field passes, since each form's own `required` carries what an empty one means there.
 */
export function figureRule(input: {
  readonly format: Formatter;
  readonly invalidWords: string;
  readonly ambiguousWords: (typed: string) => string;
}): (value: string) => true | string {
  return (value) => {
    const figure = readFigure({ raw: value, format: input.format });
    if ('ambiguous' in figure) return input.ambiguousWords(value.trim());
    return 'value' in figure || input.invalidWords;
  };
}
