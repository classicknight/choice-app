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
          Auf dieser Seite stehen ergänzende rechtliche Hinweise zu Sicherheit, Moderation, Beschwerdewegen und Transparenz
          bei Choice. Stand dieser Hinweise: 19. Juli 2026.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Community- und Sicherheitsgrundsätze</h2>
          <p className={styles.text}>
            Choice ist als respektvoller, volljähriger Dating-Kontext gedacht. Nicht erlaubt sind insbesondere Bedrohungen,
            sexualisierte Belästigung, Hass, Täuschung, Ausbeutung, Spam, Zwang, Doxxing, das Umgehen von Schutzmechanismen
            oder sonst rechtswidrige Inhalte und Verhaltensweisen. Choice kann Inhalte automatisiert vorfiltern, Chats
            zurückweisen, Matches schließen, Konten pausieren oder dauerhaft sperren.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Meldungen und Blockierungen</h2>
          <p className={styles.text}>
            Nutzer können anderes Verhalten in der App melden. Meldungen werden zusammen mit relevanten Moderations- und
            Kontextdaten geprüft. Zusätzlich können Nutzer andere Konten blockieren. Eine Blockierung beendet das betroffene
            Match sofort und verhindert künftige Vorschläge zwischen denselben Konten.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Moderationsentscheidungen und Einspruch</h2>
          <p className={styles.text}>
            Wenn Choice Inhalte zurückweist, Meldungen bestätigt, Strafpunkte vergibt, ein Konto pausiert oder sperrt, kann
            die betroffene Person eine erneute Prüfung anfragen. Dafür genügt eine Nachricht an{" "}
            <a href="mailto:kontakt@autovisa.de" className={styles.link}>
              kontakt@autovisa.de
            </a>{" "}
            mit dem betreffenden Konto, soweit möglich der Match- oder Meldungsreferenz und einer kurzen Begründung.
            Choice prüft solche Anfragen ohne unangemessene Verzögerung erneut.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Transparenz zu Moderation</h2>
          <p className={styles.text}>
            Soweit Choice als betroffene Online-Plattform hierzu verpflichtet ist, veröffentlicht Choice mindestens jährlich
            einen Transparenzbericht über Meldungen, Moderationsmaßnahmen, Kontosanktionen und grundlegende
            Sicherheitsmechanismen. Vor dem öffentlichen Regelbetrieb lagen hierfür am 19. Juli 2026 noch keine vollständigen
            Jahresdaten vor.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Hinweis zur Verfügbarkeit</h2>
          <p className={styles.text}>
            Die Inhalte dieser Website dienen der Information über Choice. Trotz sorgfältiger Pflege übernehmen wir keine
            Gewähr für ständige Verfügbarkeit, Vollständigkeit oder technische Fehlerfreiheit.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Externe Links und Stores</h2>
          <p className={styles.text}>
            Diese Website kann Verlinkungen zu externen Diensten enthalten, insbesondere zu App Stores. Für Inhalte und
            Datenverarbeitung auf verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Urheberrecht</h2>
          <p className={styles.text}>
            Inhalte, Texte, Gestaltungselemente und Markenauftritte dieser Website unterliegen, soweit rechtlich möglich,
            dem Urheber- und Kennzeichenrecht. Eine Nutzung außerhalb der gesetzlichen Schranken bedarf der vorherigen
            Zustimmung.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Verbraucherstreitbeilegung</h2>
          <p className={styles.text}>
            Wir sind nicht verpflichtet und derzeit nicht bereit, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>9. Hinweis zur früheren EU-Online-Streitbeilegung</h2>
          <p className={styles.text}>
            Die frühere europäische Plattform zur Online-Streitbeilegung wird seit dem 20. Juli 2025 nicht mehr betrieben.
            Deshalb wird auf dieser Website bewusst kein aktiver OS-Plattform-Link mehr verwendet.
          </p>
        </section>
      </section>

      <div className={styles.footerSpace}>
        <SiteFooter />
      </div>
    </main>
  );
}
