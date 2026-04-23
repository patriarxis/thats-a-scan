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
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <span>
        © {year} Up Hellas
      </span>
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
