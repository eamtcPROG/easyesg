import type { ReactNode } from 'react';
import { organizationMonogram } from '../email-monogram';
import { EMAIL_COLOUR } from '../email-palette';
import type { EmailCardParts } from '../email-parts';
import { EMAIL_CARD, EMAIL_TONE } from '../email-vocabulary';
import { EmailStatusChip } from './email-status-chip';
import { LAYOUT_TABLE, TEXT_STACK, TONE_COLOURS } from './email-styles';

/**
 * The block after the heading where a message is about one thing (§12.5.6's task-225 row (6)): the organization an
 * invitation is to, behind its monogram; a report, with its standing; an exported file, behind its format. The words
 * are the catalogue's; which of the three this is, and its state, the layout's.
 */
export function EmailCard(props: { readonly card: EmailCardParts; readonly locale: string }) {
  const { card } = props;
  const lead = leadOf(card, props.locale);
  return (
    <table
      {...LAYOUT_TABLE}
      style={{ backgroundColor: EMAIL_COLOUR.well, borderRadius: 6, margin: '0 0 24px', borderCollapse: 'separate' }}
    >
      <tbody>
        <tr>
          {lead === null ? null : <td style={{ width: 48, padding: '16px 0 16px 16px', verticalAlign: 'middle' }}>{lead}</td>}
          <td style={{ padding: 16, verticalAlign: 'middle', fontFamily: TEXT_STACK }}>
            <div style={{ fontSize: 16, lineHeight: '22px', fontWeight: 600, color: EMAIL_COLOUR.heading }}>{card.title}</div>
            {card.caption === undefined ? null : (
              <div style={{ fontSize: 14, lineHeight: '20px', color: EMAIL_COLOUR.muted }}>{card.caption}</div>
            )}
          </td>
          {card.status === undefined ? null : (
            <td align="right" style={{ padding: '16px 16px 16px 0', verticalAlign: 'middle' }}>
              <EmailStatusChip text={card.status} tone={card.tone ?? EMAIL_TONE.ATTENTION} />
            </td>
          )}
        </tr>
      </tbody>
    </table>
  );
}

/** The square before the words: an organization's monogram, a file's format; a report has none. */
function leadOf(card: EmailCardParts, locale: string): ReactNode {
  if (card.kind === EMAIL_CARD.ORGANIZATION) {
    const monogram = organizationMonogram({ name: card.title, locale });
    return monogram === '' ? null : (
      <Square text={monogram} colour={EMAIL_COLOUR.monogramText} ground={EMAIL_COLOUR.monogramGround} size={17} />
    );
  }
  if (card.kind === EMAIL_CARD.FILE && card.badge !== undefined) {
    const colours = TONE_COLOURS[card.tone ?? EMAIL_TONE.SUCCESS];
    return <Square text={card.badge} colour={colours.text} ground={colours.ground} size={12} />;
  }
  return null;
}

function Square(props: { readonly text: string; readonly colour: string; readonly ground: string; readonly size: number }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        lineHeight: '48px',
        textAlign: 'center',
        borderRadius: 6,
        backgroundColor: props.ground,
        color: props.colour,
        fontFamily: TEXT_STACK,
        fontSize: props.size,
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {props.text}
    </div>
  );
}
