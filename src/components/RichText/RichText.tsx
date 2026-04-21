import React from "react";
import styles from "./RichText.module.scss";

interface RichTextProps {
  content: string;
  className?: string;
}

export const RichText: React.FC<RichTextProps> = ({ content, className }) => {
  if (!content) return null;

  return (
    <div
      className={`${styles.richText} ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};
