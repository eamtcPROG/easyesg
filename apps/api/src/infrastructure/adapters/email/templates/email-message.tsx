import { EMAIL_COLOUR } from '../email-palette';
import type { EmailParts } from '../email-parts';
import { EmailBand } from './email-band';
import { EmailButton } from './email-button';
import { EmailCard } from './email-card';
import { EmailFacts } from './email-facts';
import { EmailFooter } from './email-footer';
import { EmailLinkFallback } from './email-link-fallback';
import { EmailList } from './email-list';
import { EmailNote } from './email-note';
import { LAYOUT_TABLE, PARAGRAPH, TEXT_STACK } from './email-styles';

/**
 * The whole HTML part, in the order the plain part says it (direction B; §12.5.6's task-225 row): the inbox's preview
 * line, hidden; the band; then on the card the category's name, the heading, the card, the words, the button with its
 * terms and its link written out, the note; below it the footer. Tables for layout and styles on each element, no
 * stylesheet and no script — a mail client keeps nothing else.
 */
export function EmailMessage({ parts }: { readonly parts: EmailParts }) {
  return (
    <html lang={parts.locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <title>{parts.subject}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: EMAIL_COLOUR.ground }}>
        <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden', opacity: 0 }}>{parts.preheader}</div>
        <table {...LAYOUT_TABLE} style={{ backgroundColor: EMAIL_COLOUR.ground }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: '32px 16px 40px' }}>
                <table {...LAYOUT_TABLE} style={{ maxWidth: 600 }}>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          backgroundColor: EMAIL_COLOUR.surface,
                          border: `1px solid ${EMAIL_COLOUR.border}`,
                          borderRadius: 6,
                        }}
                      >
                        <table {...LAYOUT_TABLE}>
                          <tbody>
                            <EmailBand />
                            <tr>
                              <td style={{ padding: 32 }}>
                                <EmailBody parts={parts} />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <EmailFooter parts={parts} />
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

function EmailBody({ parts }: { readonly parts: EmailParts }) {
  return (
    <>
      {parts.eyebrow === undefined ? null : (
        <p
          style={{
            margin: '0 0 12px',
            fontFamily: TEXT_STACK,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: '18px',
            color: EMAIL_COLOUR.link,
          }}
        >
          {parts.eyebrow}
        </p>
      )}
      <h1
        style={{
          margin: '0 0 20px',
          fontFamily: TEXT_STACK,
          fontSize: 26,
          fontWeight: 600,
          lineHeight: '32px',
          letterSpacing: '-0.015em',
          color: EMAIL_COLOUR.heading,
        }}
      >
        {parts.heading}
      </h1>
      {parts.card === undefined ? null : <EmailCard card={parts.card} locale={parts.locale} />}
      <p style={PARAGRAPH}>{parts.greeting}</p>
      {parts.intro.map((paragraph) => (
        <p key={paragraph} style={PARAGRAPH}>
          {paragraph}
        </p>
      ))}
      <EmailList lines={parts.list} />
      {parts.outro === undefined ? null : <p style={PARAGRAPH}>{parts.outro}</p>}
      <EmailButton label={parts.action} link={parts.link} />
      <EmailFacts facts={parts.facts} />
      <EmailLinkFallback label={parts.fallback} link={parts.link} />
      {parts.note === undefined ? null : <EmailNote note={parts.note} />}
    </>
  );
}
