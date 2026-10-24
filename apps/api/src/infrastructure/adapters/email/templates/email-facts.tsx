import { EMAIL_COLOUR } from '../email-palette';
import { TEXT_STACK } from './email-styles';

/** The link's terms — how long it lasts, how often it works, for whom — as chips under the button. */
export function EmailFacts(props: { readonly facts: readonly string[] }) {
  if (props.facts.length === 0) return null;
  return (
    <div style={{ margin: '0 0 16px' }}>
      {props.facts.map((fact) => (
        <span
          key={fact}
          style={{
            display: 'inline-block',
            margin: '0 8px 8px 0',
            padding: '5px 10px',
            borderRadius: 3,
            backgroundColor: EMAIL_COLOUR.factGround,
            color: EMAIL_COLOUR.link,
            fontFamily: TEXT_STACK,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: '18px',
          }}
        >
          {fact}
        </span>
      ))}
    </div>
  );
}
