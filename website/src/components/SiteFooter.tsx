import Link from "next/link";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <span className={styles.brand}>Choice</span>
          <p className={styles.copy}>Everyday a match. Weniger Feed, mehr Richtung.</p>
        </div>

        <nav className={styles.nav} aria-label="Rechtliches">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/rechtliches">Rechtliches</Link>
        </nav>
      </div>
    </footer>
  );
}
