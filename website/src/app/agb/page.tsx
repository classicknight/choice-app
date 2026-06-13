import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";
import styles from "../legal.module.css";

export default function AgbPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>Choice</span>
        <Link href="/" className={styles.backLink}>
          Zurück zur Startseite
        </Link>
      </header>

      <section className={styles.card}>
        <p className={styles.eyebrow}>Nutzungsbedingungen</p>
        <h1 className={styles.title}>AGB</h1>
        <p className={styles.intro}>
          Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung von Choice auf der Website und in der App. Sie sind
          als erste belastbare Grundlage für Account, Matching, Meldungen, Premium-Funktionen und Moderation gedacht und
          können später mit dem Live-Produkt weiter präzisiert werden.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Geltungsbereich</h2>
          <p className={styles.text}>
            Diese AGB gelten für die Nutzung des Angebots Choice durch Verbraucherinnen und Verbraucher. Sie ergänzen das
            Impressum, die Datenschutzerklärung und die weiteren rechtlichen Hinweise auf dieser Website.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Leistungsbeschreibung</h2>
          <p className={styles.text}>
            Choice ist ein kuratiertes Dating-Angebot. Nutzer erhalten Matches, durchlaufen phasenbasierte Interaktionen
            und können je nach Produktstand weitere Funktionen wie Chat, Meldungen, Premium-Features oder finale
            Auszeichnungen nutzen. Ein Anspruch auf eine bestimmte Anzahl von Matches oder einen konkreten Erfolg besteht
            nicht.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Nutzerkonto</h2>
          <p className={styles.text}>
            Für die Nutzung kann ein persönliches Konto erforderlich sein. Nutzer sind verpflichtet, wahrheitsgemäße
            Angaben zu machen, ihre Zugangsdaten vertraulich zu behandeln und kein Konto für Dritte zu verwenden oder zu
            teilen.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Verhalten auf Choice</h2>
          <p className={styles.text}>
            Choice lebt von respektvoller Kommunikation. Untersagt sind insbesondere beleidigende, diskriminierende,
            sexualisierte, bedrohende oder sonst rechtswidrige Inhalte. Ebenso unzulässig sind irreführende Angaben,
            Identitätstäuschung, Spam oder die Nutzung des Dienstes zu gewerblichen Zwecken ohne ausdrückliche Freigabe.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Meldungen, Strafpunkte und Pausierung</h2>
          <p className={styles.text}>
            Nutzer können Verhalten melden. Choice kann gemeldete Inhalte und Verhaltensweisen prüfen, Verwarnungen oder
            Strafpunkte vergeben, Konten zeitweise pausieren oder dauerhaft sperren. Dasselbe gilt, wenn systemseitige
            Regeln des Produkts verletzt werden, etwa wenn notwendige Phasen nicht gespielt oder festgelegte Startpflichten
            wiederholt ignoriert werden.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Premium und kostenpflichtige Funktionen</h2>
          <p className={styles.text}>
            Choice kann kostenlose und kostenpflichtige Funktionen anbieten. Umfang, Preis, Laufzeit und mögliche
            Verlängerungen ergeben sich aus der jeweils konkreten Angebotsdarstellung innerhalb des Produkts oder des
            Stores. Bereits freigeschaltete Leistungen können an Konten gebunden sein und sind nur im jeweils beschriebenen
            Umfang nutzbar. Nach den ersten 8 enthaltenen Matches kann Choice zusätzliche Match-Pakete, etwa 8 weitere
            Matches für 3,99 €, anbieten.
          </p>
          <p className={styles.text}>
            Wird ein Konto vorübergehend pausiert, können noch nicht genutzte gekaufte Match-Pakete eingefroren und nach
            einer Entsperrung wieder freigegeben werden. Bei schweren oder
            wiederholten Verstößen kann Choice ein Konto dauerhaft sperren; in solchen Fällen können verbleibende gekaufte
            Match-Pakete verfallen, sofern dies im Einzelfall verhältnismäßig ist.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Verfügbarkeit und Änderungen</h2>
          <p className={styles.text}>
            Choice wird mit angemessener Sorgfalt bereitgestellt. Es besteht jedoch kein Anspruch auf unterbrechungsfreie
            Verfügbarkeit. Funktionen, Phasen, Matching-Logiken oder Designs können jederzeit weiterentwickelt, angepasst
            oder eingestellt werden, soweit berechtigte Nutzerinteressen berücksichtigt werden.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Beendigung und Löschung</h2>
          <p className={styles.text}>
            Nutzer können ihr Konto im Rahmen der verfügbaren Funktionen löschen oder die Nutzung beenden. Choice kann
            Konten bei schwerwiegenden oder wiederholten Verstößen gegen diese AGB einschränken, pausieren oder löschen.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>9. Haftung</h2>
          <p className={styles.text}>
            Choice haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder
            Gesundheit. Im Übrigen richtet sich die Haftung nach den gesetzlichen Vorschriften. Für Inhalte und Verhalten
            anderer Nutzer wird nur im Rahmen der gesetzlichen Verantwortlichkeit gehaftet.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>10. Verbraucherhinweise</h2>
          <p className={styles.text}>
            Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts, soweit dem keine zwingenden
            Verbraucherschutzvorschriften entgegenstehen. Informationen zur Streitbeilegung finden sich ergänzend auf der
            Seite Rechtliches.
          </p>
        </section>

        <p className={styles.note}>
          Diese AGB sind jetzt als belastbare Choice-Grundlage angelegt. Wenn du später noch genauere Regeln für Premium,
          Kündigung, Community-Standards oder App-Store-Käufe brauchst, kann ich sie dir gezielt erweitern.
        </p>
      </section>

      <div className={styles.footerSpace}>
        <SiteFooter />
      </div>
    </main>
  );
}
