import styles from "./LocatorFooter.module.scss";

type LocatorFooterProps = {
  termsLabel: string;
  privacyLabel: string;
};

export const LocatorFooter = ({ termsLabel, privacyLabel }: LocatorFooterProps) => {
  return (
    <footer className={styles.footer}>
      <span>© 2025 Up Hellas</span>
      <a
        href="https://uphellas.gr/oroi-xrisis"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.footerLink}
      >
        {termsLabel}
      </a>
      <a
        href="https://uphellas.gr/politiki-aporritou"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.footerLink}
      >
        {privacyLabel}
      </a>
    </footer>
  );
};
