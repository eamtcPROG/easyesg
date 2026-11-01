import { EMAIL_COLOUR } from '../email-palette';
import { LAYOUT_TABLE, TEXT_STACK } from './email-styles';

/**
 * The message's one action, the card's full width (the owner's comment on the mockup). **The colour is on the cell, the
 * padding on the cell too**: a client that ignores a link's padding — Outlook's engine — still draws a full-width pine
 * button with the label in it, where padding on the link alone would leave a bare word.
 */
export function EmailButton(props: { readonly label: string; readonly link: string }) {
  return (
    <table {...LAYOUT_TABLE} style={{ margin: '8px 0 24px' }}>
      <tbody>
        <tr>
          <td align="center" style={{ backgroundColor: EMAIL_COLOUR.accent, borderRadius: 6 }}>
            <a
              href={props.link}
              style={{
                display: 'block',
                padding: '14px 24px',
                fontFamily: TEXT_STACK,
                fontSize: 16,
                fontWeight: 600,
                lineHeight: '20px',
                color: EMAIL_COLOUR.onAccent,
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              {props.label}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
