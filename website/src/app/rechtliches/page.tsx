import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";
import styles from "../legal.module.css";

export default function RechtlichesPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>Choice</span>
        <Link href="/" className={styles.backLink}>
          Zurück zur Startseite
        </Link>
      </header>

      <section className={styles.card}>
        <p className={styles.eyebrow}>Hinweise</p>
        <h1 className={styles.title}>Rechtliches</h1>
        <p className={styles.intro}>
          Auf dieser Seite stehen die wichtigsten ergänzenden rechtlichen Hinweise für die Website von Choice. Für die
          spätere öffentliche App können zusätzliche Nutzungsbedingungen oder Community-Regeln sinnvoll sein.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Hinweis zur Verfügbarkeit</h2>
          <p className={styles.text}>
            Die Inhalte dieser Website dienen der Information über Choice. Trotz sorgfältiger Pflege übernehmen wir keine
            Gewähr für ständige Verfügbarkeit, Vollständigkeit oder technische Fehlerfreiheit.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Externe Links</h2>
          <p className={styles.text}>
            Diese Website kann Verlinkungen zu externen Diensten enthalten, etwa zu App Stores. Für die Inhalte externer
            Seiten sind ausschließlich deren Betreiber verantwortlich.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Urheberrecht</h2>
          <p className={styles.text}>
            Inhalte, Texte, Gestaltungselemente und Markenauftritte dieser Website unterliegen – soweit rechtlich möglich –
            dem Urheber- und Kennzeichenrecht. Eine Nutzung außerhalb der gesetzlichen Schranken bedarf der vorherigen
            Zustimmung.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Verbraucherstreitbeilegung</h2>
          <p className={styles.text}>
            Wir sind nicht verpflichtet und derzeit nicht bereit, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Hinweis zur früheren EU-Online-Streitbeilegung</h2>
          <p className={styles.text}>
            Die frühere europäische Plattform zur Online-Streitbeilegung wird seit dem 20. Juli 2025 nicht mehr betrieben.
            Deshalb wird auf dieser Website bewusst kein aktiver OS-Plattform-Link mehr verwendet.
          </p>
        </section>

        <p className={styles.note}>
          Wenn du für Choice später noch eigene Nutzungsbedingungen, Community-Regeln oder App-spezifische AGB willst, kann
          ich sie dir auf derselben Basis direkt ergänzen.
        </p>
      </section>

      <div className={styles.footerSpace}>
        <SiteFooter />
      </div>
    </main>
  );
}
