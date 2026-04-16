import styles from "./LocatorFooter.module.scss";

type LocatorFooterProps = {
  termsLabel: string;
  privacyLabel: string;
  termsUrl: string;
  privacyUrl: string;
};

export const LocatorFooter = ({
  termsLabel,
  privacyLabel,
  termsUrl,
  privacyUrl,
}: LocatorFooterProps) => {
  return (
    <footer className={styles.footer}>
      <span>© 2025 Up Hellas</span>
      <a
        href={termsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.footerLink}
      >
        {termsLabel}
      </a>
      <a
        href={privacyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.footerLink}
      >
        {privacyLabel}
      </a>
    </footer>
  );
};
