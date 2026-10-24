import { EMAIL_COLOUR } from '../email-palette';
import { MONO_STACK, SMALL } from './email-styles';

/**
 * The button's link written out, for a client that will not follow the button — and for a reader who wants to see where
 * it goes before opening it. It breaks anywhere, so a long token never widens the message.
 */
export function EmailLinkFallback(props: { readonly label: string; readonly link: string }) {
  return (
    <>
      <p style={{ ...SMALL, margin: '0 0 8px' }}>{props.label}</p>
      <a
        href={props.link}
        style={{
          display: 'block',
          padding: '10px 12px',
          border: `1px solid ${EMAIL_COLOUR.border}`,
          borderRadius: 3,
          backgroundColor: EMAIL_COLOUR.well,
          color: EMAIL_COLOUR.link,
          fontFamily: MONO_STACK,
          fontSize: 13,
          lineHeight: '20px',
          textDecoration: 'none',
          wordBreak: 'break-all',
        }}
      >
        {props.link}
      </a>
    </>
  );
}
