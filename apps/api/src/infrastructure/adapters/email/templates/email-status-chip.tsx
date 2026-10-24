import type { EmailTone } from '../email-vocabulary';
import { TEXT_STACK, TONE_COLOURS } from './email-styles';

/** A card's standing — *not ready to file*, *ready* — in its state's colours; the words say it, the colour repeats it. */
export function EmailStatusChip(props: { readonly text: string; readonly tone: EmailTone }) {
  const colours = TONE_COLOURS[props.tone];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 999,
        backgroundColor: colours.ground,
        color: colours.text,
        fontFamily: TEXT_STACK,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
      }}
    >
      {props.text}
    </span>
  );
}
