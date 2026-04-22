import React, { useMemo } from "react";
import styles from "./RichText.module.scss";

interface RichTextProps {
  content: string;
  className?: string;
}

function processContent(html: string): string {
  if (!html) return html;

  let processed = html.replace(
    /<a\b([^>]*)>(.*?)<\/a>/gi,
    (match, attrs, innerText) => {
      let newText = innerText;
      if (innerText.trim().match(/^https?:\/\//i) && innerText.length > 35) {
        try {
          const urlObj = new URL(innerText.trim());
          newText = urlObj.hostname.replace(/^www\./, "");
        } catch {
          newText = "Link";
        }
        return `<a${attrs}>${newText}</a>`;
      }
      return match;
    },
  );

  const parts = processed.split(/(<[^>]*>)/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      parts[i] = parts[i].replace(
        /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi,
        (url) => {
          let cleanUrl = url;
          const trailingPunctuation = /[.,:;)"']$/;
          let suffix = "";
          if (trailingPunctuation.test(cleanUrl)) {
            suffix = cleanUrl.slice(-1);
            cleanUrl = cleanUrl.slice(0, -1);
          }

          let label = cleanUrl;
          if (cleanUrl.length > 35) {
            try {
              const u = new URL(cleanUrl);
              label = u.hostname.replace(/^www\./, "");
            } catch (e) {
              label = "Link";
            }
          }
          return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${label}</a>${suffix}`;
        },
      );

      parts[i] = parts[i].replace(/\n/g, "<br/>");
    }
  }

  return parts.join("");
}

export const RichText: React.FC<RichTextProps> = ({ content, className }) => {
  const processedHtml = useMemo(() => processContent(content), [content]);

  if (!content) return null;

  return (
    <div
      className={`${styles.richText} ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
};
