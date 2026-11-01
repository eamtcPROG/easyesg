import { EMAIL_MARK } from '../email-mark';
import { EMAIL_COLOUR } from '../email-palette';
import { LAYOUT_TABLE, TEXT_STACK } from './email-styles';

/**
 * The brand band across the card's top (direction B, §12.5.6's task-225 row): the ring mark and the wordmark on pine.
 * **The wordmark is text**, so a client that hides the mark still shows whose message this is; the mark is decorative,
 * its alternative text empty, for a reader would otherwise hear the product's name twice.
 */
export function EmailBand() {
  return (
    <tr>
      <td style={{ backgroundColor: EMAIL_COLOUR.band, padding: '18px 32px', borderRadius: '6px 6px 0 0' }}>
        <table {...LAYOUT_TABLE} width="auto">
          <tbody>
            <tr>
              <td style={{ paddingRight: 10, verticalAlign: 'middle' }}>
                {/* `fetchPriority="low"` is what stops React 19 hoisting a `<link rel="preload">` for the image into the
                    head — a link element in a message is what UX-66 forbids, and the renderer spec fails on one. */}
                <img
                  src={`cid:${EMAIL_MARK.contentId}`}
                  width={EMAIL_MARK.size}
                  height={EMAIL_MARK.size}
                  alt=""
                  fetchPriority="low"
                  style={{ display: 'block', border: 0 }}
                />
              </td>
              <td
                style={{
                  verticalAlign: 'middle',
                  fontFamily: TEXT_STACK,
                  fontSize: 19,
                  fontWeight: 600,
                  letterSpacing: '-0.03em',
                  color: EMAIL_COLOUR.bandText,
                }}
              >
                {/* The product's proper name, identical in every locale — identity, not copy (`BrandMark`'s reason). */}
                {WORDMARK.lead}
                <span style={{ color: EMAIL_COLOUR.bandSuffix }}>{WORDMARK.suffix}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}

const WORDMARK = { lead: 'easy', suffix: 'ESG' } as const;
