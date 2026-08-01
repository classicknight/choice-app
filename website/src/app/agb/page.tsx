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
          Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung von Choice auf der Website und in der App. Sie gelten für
          Account, Matching, Chat, Moderation, kostenpflichtige Match-Pakete und Choice Plus. Stand: 27. Juli 2026.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Geltungsbereich</h2>
          <p className={styles.text}>
            Diese AGB gelten für die Nutzung des Angebots Choice durch Verbraucherinnen und Verbraucher. Sie ergänzen das
            Impressum, die Datenschutzerklärung und die weiteren rechtlichen Hinweise auf dieser Website.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Volljährigkeit und Konto</h2>
          <p className={styles.text}>
            Choice richtet sich ausschließlich an volljährige Nutzerinnen und Nutzer. Für die Nutzung kann ein persönliches
            Konto erforderlich sein. Nutzer sind verpflichtet, wahrheitsgemäße Angaben zu machen, ihre Zugangsdaten
            vertraulich zu behandeln und kein Konto für Dritte zu verwenden oder zu teilen.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Leistungsbeschreibung</h2>
          <p className={styles.text}>
            Choice ist ein kuratiertes Dating-Angebot. Nutzer erhalten Matches, durchlaufen phasenbasierte Interaktionen und
            können je nach Produktstand weitere Funktionen wie Chat, Meldungen, Blockierungen, Moderation, Match-Pakete oder
            finale Auszeichnungen nutzen. Matches setzen voraus, dass ein nach den jeweiligen Suchkriterien geeignetes und
            verfügbares Profil vorhanden ist. Ein Anspruch auf eine bestimmte Person, eine bestimmte Anzahl von Matches, einen
            bestimmten Verlauf oder auf Dating-Erfolg besteht nicht.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Verhalten auf Choice</h2>
          <p className={styles.text}>
            Choice lebt von respektvoller Kommunikation. Untersagt sind insbesondere beleidigende, diskriminierende,
            sexualisierte, bedrohende oder sonst rechtswidrige Inhalte. Ebenso unzulässig sind irreführende Angaben,
            Identitätstäuschung, Spam, das Umgehen von Sicherheitsmechanismen, das Teilen externer Kontaktkanäle zur
            Missbrauchsumgehung oder die Nutzung des Dienstes zu gewerblichen Zwecken ohne ausdrückliche Freigabe. Choice
            verfolgt bei objektiv anstößigen, bedrohend wirkenden oder ausbeuterischen Inhalten eine Null-Toleranz-Linie.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Meldungen, Blockierungen und Moderation</h2>
          <p className={styles.text}>
            Nutzer können Verhalten melden und andere Nutzer blockieren. Blockierungen beenden das betroffene Match sofort und
            verhindern künftige Vorschläge zwischen denselben Konten. Choice kann gemeldete Inhalte und Verhaltensweisen
            prüfen, Verwarnungen oder Strafpunkte vergeben, Inhalte zurückweisen, Konten zeitweise pausieren oder dauerhaft
            sperren. Dasselbe gilt, wenn systemseitige Regeln des Produkts verletzt werden, etwa wenn notwendige Phasen nicht
            gespielt oder festgelegte Startpflichten wiederholt ignoriert werden.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Kostenpflichtige Leistungen</h2>
          <p className={styles.text}>
            Choice kann kostenlose und kostenpflichtige Funktionen anbieten. Umfang, Preis, Abrechnungszeitraum und
            Produktbeschreibung ergeben sich aus der Darstellung unmittelbar vor dem Kauf und aus dem jeweiligen App Store.
            Der dort angezeigte Preis ist maßgeblich.
          </p>
          <p className={styles.text}>
            Match-Pakete sind Einmalkäufe und verlängern sich nicht automatisch. Gekaufte, noch nicht genutzte Match-Guthaben
            laufen nicht ab. Bei einer Kontopause oder Sperre können sie für die Dauer der Einschränkung eingefroren werden.
            Nach einer Aufhebung der Einschränkung stehen sie wieder zur Verfügung. Bereits verbrauchte Guthaben werden nicht
            erneut gutgeschrieben, soweit keine Erstattung über den Store erfolgt.
          </p>
          <p className={styles.text}>
            Choice Plus ist ein automatisch verlängerndes Monatsabonnement. Zum vorgesehenen Start beträgt der Preis im
            deutschen Store 9,99 Euro pro Monat; verbindlich ist stets der Preis, den der jeweilige Store unmittelbar vor der
            Bestätigung anzeigt. Choice Plus ermöglicht während einer aktiven Laufzeit bis zu ein bewusst ausgewähltes Match
            pro Tag, ohne dass dafür Match-Guthaben verbraucht wird. Auch mit Choice Plus besteht kein Anspruch auf ein Match,
            wenn kein geeignetes verfügbares Profil vorhanden ist. Es bleibt bei höchstens einem aktiven Match gleichzeitig.
          </p>
          <p className={styles.text}>
            Choice Plus verlängert sich jeweils um einen weiteren Monat, solange die automatische Verlängerung nicht über das
            Store-Konto beendet wird. Eine Kündigung wirkt zum Ende der bereits bezahlten Laufzeit. Abrechnung, Verwaltung,
            Wiederherstellung und Erstattungen erfolgen über den Store, in dem das Abo abgeschlossen wurde. Die geltenden
            Fairness-, Moderations-, Pausen- und Sperrregeln gelten auch für Abonnenten. Eine Pause oder Sperre beendet ein
            Store-Abo nicht automatisch; das Abo muss bei Bedarf zusätzlich im Store gekündigt werden.
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
            Konten bei schwerwiegenden oder wiederholten Verstößen gegen diese AGB einschränken, pausieren, sperren oder
            löschen. Die Löschung eines Choice-Kontos beendet ein über Apple oder Google abgeschlossenes Abonnement nicht
            automatisch. Nutzer müssen die automatische Verlängerung zuvor oder anschließend selbst in ihrem Store-Konto
            beenden.
          </p>
          <p className={styles.text}>
            Bereits verbrauchte Match-Kontingente und freigeschaltete Match-Zähler können dabei aus Gründen der
            Missbrauchsvermeidung, Abrechnung und Durchsetzung von Nutzungsgrenzen weiter an die verifizierte Telefonnummer
            gebunden bleiben.
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
          <h2 className={styles.sectionTitle}>10. Widerruf, Kündigung und Erstattungen</h2>
          <p className={styles.text}>
            Für Käufe und Abonnements gelten die gesetzlichen Verbraucherrechte sowie die Kauf- und Erstattungsprozesse des
            jeweiligen Stores. Die technische Nutzung einer kostenpflichtigen Leistung kann unmittelbar nach der
            Kaufbestätigung beginnen. Eine Kündigung der automatischen Verlängerung ist von einer Erstattungsanfrage und von
            der Löschung des Choice-Kontos zu unterscheiden. Gesetzliche Rechte werden durch diese AGB nicht eingeschränkt.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>11. Verbraucherhinweise</h2>
          <p className={styles.text}>
            Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts, soweit dem keine zwingenden
            Verbraucherschutzvorschriften entgegenstehen. Informationen zur Streitbeilegung finden sich ergänzend auf der
            Seite Rechtliches.
          </p>
        </section>
      </section>

      <div className={styles.footerSpace}>
        <SiteFooter />
      </div>
    </main>
  );
}
