import Link from "next/link";
import { SiteFooter } from "../../components/SiteFooter";
import styles from "../legal.module.css";

export default function DatenschutzPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>Choice</span>
        <Link href="/" className={styles.backLink}>
          Zurück zur Startseite
        </Link>
      </header>

      <section className={styles.card}>
        <p className={styles.eyebrow}>DSGVO</p>
        <h1 className={styles.title}>Datenschutzerklärung</h1>
        <p className={styles.intro}>
          Diese Datenschutzerklärung beschreibt, wie personenbezogene Daten bei Choice auf der Website, in der App und in den
          zugehörigen API- und Moderationsprozessen verarbeitet werden. Stand dieser Fassung: 19. Juli 2026.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Verantwortlicher</h2>
          <div className={styles.info}>
            <div>Alexandr Gotfrid</div>
            <div>Großer Kamp 62</div>
            <div>45731 Waltrop</div>
            <div>E-Mail: kontakt@autovisa.de</div>
            <div>Telefon: 01759659954</div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Welche Daten wir verarbeiten</h2>
          <ul className={styles.list}>
            <li>Kontaktdaten und Verifizierungsdaten, insbesondere Telefonnummer und Login- bzw. Verifizierungsvorgänge</li>
            <li>Profildaten wie Vorname, Alter, Stadt, Interessen, Dating-Intentionen, Pronomen, Identität und Suchpräferenzen</li>
            <li>hochgeladene Fotos und optionale Videos</li>
            <li>Chat-, Match-, Moderations- und Blockierungsdaten</li>
            <li>Kauf- und Store-Informationen zu Match-Paketen</li>
            <li>technische Nutzungs- und Sicherheitsdaten, etwa Logdaten, Geräte- und Push-Informationen</li>
            <li>lokale Sitzungs-, Status- und Einstellungsdaten, die die App auf deinem Gerät speichert</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Konto, Verifizierung, Login und App-Berechtigungen</h2>
          <p className={styles.text}>
            Für die Nutzung von Choice ist eine Konto- bzw. Login-Verifizierung per Telefonnummer vorgesehen. Dabei
            verarbeiten wir deine Telefonnummer, Verifizierungsstatus, technische Challenge-Daten und Sicherheitsinformationen,
            um dein Konto bereitzustellen, Missbrauch zu verhindern und dich erneut einloggen zu lassen.
          </p>
          <p className={styles.text}>
            Wenn du die App-Funktionen aktiv nutzt, kann Choice außerdem Berechtigungen für den Zugriff auf deine Mediathek
            sowie für Push-Mitteilungen anfragen. Der Zugriff auf die Mediathek wird nur benötigt, wenn du Fotos oder ein
            Video für dein Profil auswählst. Push-Berechtigungen werden nur genutzt, wenn du Benachrichtigungen zu Matches,
            Phasen oder Chats erhalten möchtest.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Profil, Matching und sensible Angaben</h2>
          <p className={styles.text}>
            Choice verarbeitet deine Profildaten, um dein Konto anzuzeigen, passende Matches zu bilden und die einzelnen
            Phasen des Produkts durchzuführen. Dazu gehören auch Angaben, aus denen Rückschlüsse auf Dating-Präferenzen oder
            sexuelle Orientierung möglich sein können, etwa Identität, Pronomen und Suchpräferenzen. Solche Angaben werden nur
            verarbeitet, wenn du sie selbst im Profil hinterlegst und der entsprechenden Verarbeitung ausdrücklich zustimmst.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Chats, Meldungen, Blockierungen und Moderation</h2>
          <p className={styles.text}>
            Wenn du mit einem Match schreibst, verarbeiten wir die Chatnachrichten zur Bereitstellung des Chats, zur
            Synchronisierung eurer Match-Phasen und zur Missbrauchsabwehr. Wenn du eine Person meldest oder blockierst,
            speichern wir die Meldung, Angaben zum betroffenen Match, den relevanten Chatkontext sowie Moderationsentscheidungen,
            damit wir Verstöße prüfen, Sanktionen dokumentieren und künftige Matches sicherer steuern können.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Käufe, App Stores und Zahlungsabwicklung</h2>
          <p className={styles.text}>
            Wenn du kostenpflichtige Match-Pakete kaufst, läuft die Abrechnung über den jeweiligen Store. Wir selbst erhalten
            keine vollständigen Zahlungsdaten deiner Karte, sondern verarbeiten insbesondere Store- und Kaufreferenzen,
            Produktkennungen, Zeitpunkte, Statusmeldungen und Gutschriften, damit dein Kauf deinem Choice-Konto zugeordnet
            werden kann.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Technische Dienstleister</h2>
          <p className={styles.text}>
            Choice nutzt technische Dienstleister für Hosting, Verifizierung, Uploads, Push-Kommunikation und Store-Abwicklung.
            Dazu können je nach Funktionsumfang insbesondere Render, Twilio Verify, Cloudinary, Expo Push, RevenueCat sowie
            Apple und Google als Store-Betreiber gehören. Diese Einbindungen erfolgen nur, soweit sie für den Betrieb,
            die Sicherheit oder die Kaufabwicklung erforderlich sind.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>8. App-Nutzung, lokale Gerätespeicherung, Hosting, Logdaten und Sicherheit</h2>
          <p className={styles.text}>
            Website, App, API und Admin-Oberflächen werden technisch bereitgestellt und abgesichert. Beim Aufruf und bei der
            Nutzung können dabei Server-Logdaten, Zeitstempel, technische Geräteinformationen, IP-Adressen,
            Sicherheitsereignisse sowie Push- oder Geräte-Token verarbeitet werden, um Stabilität, Fehlersuche,
            Missbrauchserkennung, Benachrichtigungen und den Schutz des Dienstes sicherzustellen.
          </p>
          <p className={styles.text}>
            Auf deinem Gerät kann die App außerdem lokale Sitzungs-, Login- und Statusdaten speichern, damit du angemeldet
            bleibst, laufende Match-Phasen wiederhergestellt werden können und ausgewählte Einstellungen nicht bei jedem
            Öffnen neu eingegeben werden müssen. Diese lokale Speicherung dient der Funktionsfähigkeit und Nutzerfreundlichkeit
            der App.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>9. Rechtsgrundlagen</h2>
          <p className={styles.text}>
            Wir verarbeiten personenbezogene Daten je nach Vorgang insbesondere zur Vertragserfüllung, zur Durchführung des
            Dienstes, auf Grundlage berechtigter Interessen an Sicherheit und Missbrauchsabwehr sowie auf Grundlage deiner
            Einwilligung. Soweit Profilangaben sensible Rückschlüsse zulassen können, erfolgt deren Verarbeitung auf Grundlage
            deiner ausdrücklichen Einwilligung.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>10. Speicherdauer</h2>
          <p className={styles.text}>
            Kontodaten speichern wir grundsätzlich für die Dauer des bestehenden Kontos. Profildaten, Chatdaten und
            Matchhistorien werden gelöscht oder anonymisiert, wenn sie für den Dienst nicht mehr erforderlich sind oder du dein
            Konto wirksam löschst, soweit keine gesetzlichen Aufbewahrungspflichten, Sicherheitsinteressen oder noch offene
            Moderations- bzw. Missbrauchsvorgänge entgegenstehen. Kauf- und Abrechnungsdaten können aufgrund handels- und
            steuerrechtlicher Pflichten länger gespeichert werden.
          </p>
          <p className={styles.text}>
            Soweit dies für die Durchsetzung von Match-Kontingenten, Missbrauchsabwehr oder Abrechnungsnachweise erforderlich
            ist, kann Choice auch nach einer Kontolöschung minimierte, nicht öffentlich sichtbare Nutzungszähler zu bereits
            freigeschalteten Matches weiter speichern, insbesondere bezogen auf die verifizierte Telefonnummer.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>11. Deine Rechte</h2>
          <ul className={styles.list}>
            <li>Auskunft über die verarbeiteten personenbezogenen Daten</li>
            <li>Berichtigung unrichtiger Daten</li>
            <li>Löschung oder Einschränkung der Verarbeitung</li>
            <li>Widerspruch gegen bestimmte Verarbeitungen</li>
            <li>Datenübertragbarkeit, soweit anwendbar</li>
            <li>Beschwerde bei einer Datenschutzaufsichtsbehörde</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>12. Minderjährige</h2>
          <p className={styles.text}>
            Choice richtet sich ausschließlich an volljährige Personen. Die Nutzung ist erst ab 18 Jahren vorgesehen.
          </p>
        </section>

        <p className={styles.note}>
          Für Datenschutzanfragen, Löschungsanliegen oder Fragen zu Moderationsentscheidungen erreichst du Choice unter{" "}
          <a href="mailto:kontakt@autovisa.de" className={styles.link}>
            kontakt@autovisa.de
          </a>
          .
        </p>
      </section>

      <div className={styles.footerSpace}>
        <SiteFooter />
      </div>
    </main>
  );
}
