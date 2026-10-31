import { Fragment } from 'react';
import { TextLink } from '@easyesg/ui';
import { Link } from '@/i18n/navigation';
import { INLINE, type Inline } from '../../tools/article-markdown';

/**
 * A run of an article's text as React elements (task 77; §12.5.6's task-77 row (12)) — what `markdownInlines` read,
 * drawn: strong and emphasis as themselves, a link to a path through this application's `Link`, so it keeps the reader's
 * language, and an `https:` address as an ordinary link. **Text is always a text node**, so nothing an editor types can
 * become markup.
 */
export function ArticleInlines({ inlines }: { readonly inlines: readonly Inline[] }) {
  return inlines.map((inline, index) => {
    switch (inline.kind) {
      case INLINE.TEXT:
        return <Fragment key={index}>{inline.text}</Fragment>;
      case INLINE.STRONG:
        return (
          <strong key={index}>
            <ArticleInlines inlines={inline.children} />
          </strong>
        );
      case INLINE.EMPHASIS:
        return (
          <em key={index}>
            <ArticleInlines inlines={inline.children} />
          </em>
        );
      case INLINE.LINK:
        return inline.external ? (
          <TextLink key={index} href={inline.href} rel="noopener noreferrer">
            <ArticleInlines inlines={inline.children} />
          </TextLink>
        ) : (
          <TextLink key={index} asChild>
            <Link href={inline.href}>
              <ArticleInlines inlines={inline.children} />
            </Link>
          </TextLink>
        );
    }
  });
}
