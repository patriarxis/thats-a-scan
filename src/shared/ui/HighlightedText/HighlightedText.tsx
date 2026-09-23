import { useMemo } from "react";
import { foldForMatch } from "@/lib/utils/string";
import styles from "./HighlightedText.module.scss";

type HighlightedTextProps = {
  text: string;
  query: string;
};

export const HighlightedText = ({ text, query }: HighlightedTextProps) => {
  const parts = useMemo(() => {
    const normalizedQuery = foldForMatch(query.trim());
    if (!normalizedQuery) return [<span key="0">{text}</span>];

    // Folded, not trimmed — these indices are used against `text` directly.
    const normalizedText = foldForMatch(text);
    const result: React.ReactNode[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      const matchIndex = normalizedText.indexOf(normalizedQuery, currentIndex);
      if (matchIndex === -1) {
        result.push(<span key={currentIndex}>{text.slice(currentIndex)}</span>);
        break;
      }

      if (matchIndex > currentIndex) {
        result.push(
          <span key={currentIndex}>{text.slice(currentIndex, matchIndex)}</span>,
        );
      }

      const matchText = text.slice(matchIndex, matchIndex + normalizedQuery.length);
      result.push(
        <span key={`h-${matchIndex}`} className={styles.highlight}>
          {matchText}
        </span>,
      );
      currentIndex = matchIndex + normalizedQuery.length;
    }

    return result;
  }, [text, query]);

  return <>{parts}</>;
};
