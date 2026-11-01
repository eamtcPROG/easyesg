import { EMAIL_COLOUR } from '../email-palette';
import type { EmailParts } from '../email-parts';
import { SMALL } from './email-styles';

/**
 * Below the card: why the reader received the message, the way to stop it where the category may be switched off
 * (FR-169), and who sends it — the product and, where A-21's is readable, the operator (§12.5.6's task-225 row (7)).
 */
export function EmailFooter(props: { readonly parts: EmailParts }) {
  const { reason, unsubscribe, product, operator } = props.parts;
  return (
    <tr>
      <td style={{ padding: '24px 8px 0' }}>
        <p style={{ ...SMALL, margin: '0 0 10px' }}>{reason}</p>
        {unsubscribe === undefined ? null : (
          <p style={{ ...SMALL, margin: '0 0 10px' }}>
            <a href={unsubscribe.link} style={{ color: EMAIL_COLOUR.link, fontWeight: 600 }}>
              {unsubscribe.label}
            </a>
          </p>
        )}
        <p style={SMALL}>{operator === undefined ? product : `${product} · ${operator}`}</p>
      </td>
    </tr>
  );
}
