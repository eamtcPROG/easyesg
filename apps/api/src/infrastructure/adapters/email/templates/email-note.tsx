import { EMAIL_COLOUR } from '../email-palette';
import type { EmailParts } from '../email-parts';
import { TEXT_STACK } from './email-styles';

/**
 * The closing note under a rule — what to do if the message was not expected, or when it will come again. Its lead is
 * the question a reader who did not ask for the message is already asking.
 */
export function EmailNote(props: { readonly note: NonNullable<EmailParts['note']> }) {
  const { lead, body } = props.note;
  return (
    <p
      style={{
        margin: '24px 0 0',
        paddingTop: 20,
        borderTop: `1px solid ${EMAIL_COLOUR.border}`,
        fontFamily: TEXT_STACK,
        fontSize: 14,
        lineHeight: '22px',
        color: EMAIL_COLOUR.body,
      }}
    >
      {lead === undefined ? null : <strong style={{ fontWeight: 600, color: EMAIL_COLOUR.heading }}>{lead} </strong>}
      {body}
    </p>
  );
}
