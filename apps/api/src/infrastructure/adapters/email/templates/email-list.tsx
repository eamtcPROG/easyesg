import { EMAIL_COLOUR } from '../email-palette';
import { LAYOUT_TABLE, TEXT_STACK } from './email-styles';

/** The rows the intro introduces — a field list, one module a row, as the plain part writes one a line. */
export function EmailList(props: { readonly lines: readonly string[] }) {
  if (props.lines.length === 0) return null;
  return (
    <table
      {...LAYOUT_TABLE}
      style={{
        margin: '0 0 20px',
        border: `1px solid ${EMAIL_COLOUR.border}`,
        borderRadius: 6,
        borderCollapse: 'separate',
      }}
    >
      <tbody>
        {props.lines.map((line, index) => (
          <tr key={line}>
            <td
              style={{
                padding: '12px 16px',
                borderTop: index === 0 ? 'none' : `1px solid ${EMAIL_COLOUR.border}`,
                fontFamily: TEXT_STACK,
                fontSize: 15,
                lineHeight: '22px',
                color: EMAIL_COLOUR.heading,
              }}
            >
              {line}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
