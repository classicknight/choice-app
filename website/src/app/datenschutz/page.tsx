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
          Diese Datenschutzerklärung beschreibt in komprimierter Form, wie personenbezogene Daten auf der Website von Choice
          verarbeitet werden. Sie bezieht sich auf die Website selbst. Spätere In-App-Funktionen können durch eine ergänzte
          oder erweiterte Datenschutzerklärung konkretisiert werden.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Verantwortlicher</h2>
          <div className={styles.info}>
            <div>Alexandr Gotfrid</div>
            <div>Großer Kamp 62</div>
            <div>45731 Waltrop</div>
            <div>E-Mail: kontakt@autovisa.de</div>
            <div>Telefon: 0152 02405308</div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Hosting</h2>
          <p className={styles.text}>
            Diese Website wird über Render bereitgestellt. Beim Aufruf der Seite können technisch notwendige Server-Logdaten
            verarbeitet werden, etwa IP-Adresse, Datum und Uhrzeit des Zugriffs, Browserinformationen und angeforderte
            Inhalte. Die Verarbeitung erfolgt zur sicheren und stabilen Bereitstellung der Website.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Informatorische Nutzung der Website</h2>
          <p className={styles.text}>
            Wenn du diese Website nur informatorisch nutzt, verarbeiten wir grundsätzlich nur die Daten, die dein Browser
            technisch an den Server übermittelt. Diese Verarbeitung ist erforderlich, um dir die Website anzuzeigen und die
            Sicherheit des Angebots zu gewährleisten.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Kontaktaufnahme</h2>
          <p className={styles.text}>
            Wenn du per E-Mail Kontakt aufnimmst, verarbeiten wir die von dir übermittelten Angaben, um deine Anfrage zu
            bearbeiten. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b oder lit. f DSGVO, je nach Inhalt
            deiner Anfrage.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Externe Links</h2>
          <p className={styles.text}>
            Diese Website enthält Links zu externen Diensten, insbesondere zu den App Stores. Beim Anklicken solcher Links
            verlässt du unsere Website. Für die Datenverarbeitung auf den verlinkten Seiten sind ausschließlich deren
            Betreiber verantwortlich.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Cookies und Tracking</h2>
          <p className={styles.text}>
            Aktuell setzt die Website von Choice nach unserem derzeitigen Stand keine eigenen Analyse- oder Marketing-Cookies
            ein. Sollten zukünftig einwilligungspflichtige Tracking- oder Marketing-Technologien ergänzt werden, wird diese
            Datenschutzerklärung entsprechend erweitert.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Deine Rechte</h2>
          <ul className={styles.list}>
            <li>Auskunft über die verarbeiteten personenbezogenen Daten</li>
            <li>Berichtigung unrichtiger Daten</li>
            <li>Löschung oder Einschränkung der Verarbeitung</li>
            <li>Widerspruch gegen bestimmte Verarbeitungen</li>
            <li>Datenübertragbarkeit, soweit anwendbar</li>
            <li>Beschwerde bei einer Datenschutzaufsichtsbehörde</li>
          </ul>
        </section>

        <p className={styles.note}>
          Diese Datenschutzerklärung ist bewusst auf die aktuelle Website zugeschnitten. Wenn wir für Choice Newsletter,
          Analytics, Kontaktformulare oder die öffentliche App-Freischaltung ergänzen, passe ich sie dir sauber an.
        </p>
      </section>

      <div className={styles.footerSpace}>
        <SiteFooter />
      </div>
    </main>
  );
}
