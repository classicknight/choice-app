import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";
import styles from "../legal.module.css";

export default function ImpressumPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>Choice</span>
        <Link href="/" className={styles.backLink}>
          Zurück zur Startseite
        </Link>
      </header>

      <section className={styles.card}>
        <p className={styles.eyebrow}>Angaben gemäß § 5 DDG</p>
        <h1 className={styles.title}>Impressum</h1>
        <p className={styles.intro}>
          Choice ist ein Angebot von Alexandr Gotfrid. Die hier verwendeten Kontakt- und Unternehmensdaten basieren auf den
          bereits veröffentlichten Angaben von autovisa.de.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Anbieter</h2>
          <div className={styles.info}>
            <div>Alexandr Gotfrid</div>
            <div>Großer Kamp 62</div>
            <div>45731 Waltrop</div>
            <div>Deutschland</div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Kontakt</h2>
          <div className={styles.info}>
            <div>Telefon: 0152 02405308</div>
            <div>E-Mail: kontakt@autovisa.de</div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Umsatzsteuer</h2>
          <div className={styles.info}>
            <div>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:</div>
            <div>DE461348534</div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Verantwortlich für den Inhalt</h2>
          <div className={styles.info}>
            <div>Alexandr Gotfrid</div>
            <div>Großer Kamp 62</div>
            <div>45731 Waltrop</div>
          </div>
        </section>

        <p className={styles.note}>
          Wenn du die Kontakt- oder Unternehmensdaten für Choice später anders führen willst als bei AutoVisa, kann ich dir
          diese Seite sofort entsprechend umstellen.
        </p>
      </section>

      <div className={styles.footerSpace}>
        <SiteFooter />
      </div>
    </main>
  );
}
