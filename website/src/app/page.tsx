import styles from "./page.module.css";

const phases = [
  {
    number: "01",
    title: "Ein Match am Morgen",
    body:
      "Choice zeigt dir um 9 Uhr genau eine Person und entscheidet, wer den ersten Schritt macht.",
  },
  {
    number: "02",
    title: "Choice-Runde",
    body:
      "Wenn ihr beide weitermachen wollt, prüft Choice mit drei Dilemma-Fragen, ob eure Haltungen wirklich zusammenpassen.",
  },
  {
    number: "03",
    title: "Bleiben oder neu starten",
    body:
      "Am nächsten Tag wird sichtbar, ob ihr euch wirklich füreinander entscheidet oder lieber ein neues Match wollt.",
  },
  {
    number: "04",
    title: "Bewusste Pause",
    body:
      "Nicht dauerhaft schreiben, sondern Raum lassen. Choice nimmt Druck raus und macht Interesse klarer sichtbar.",
  },
  {
    number: "05",
    title: "Choice Award",
    body:
      "Wenn am Ende noch etwas da ist, bekommt eure Verbindung ein eigenes Finale statt einfach im Chat zu verschwinden.",
  },
];

const principles = [
  {
    title: "Weniger Auswahl, mehr Absicht",
    body: "Choice will dich nicht endlos beschäftigen, sondern die eine Person finden, bei der es sich wirklich lohnen könnte.",
  },
  {
    title: "Nicht nur Likes, sondern Haltung",
    body: "Interessen sind schön. Entscheidender ist, wie zwei Menschen mit Nähe, Grenzen, Ehrlichkeit und Unsicherheit umgehen.",
  },
  {
    title: "Ein System, das Klarheit schafft",
    body: "Jede Phase hat eine Funktion. Dadurch wirkt Dating weniger beliebig und fühlt sich am Ende viel eindeutiger an.",
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroHeartBackdrop} aria-hidden="true" />
        <div className={styles.heroBrandRow}>
          <span className={styles.brandPill}>Choice</span>
          <span className={styles.brandCaption}>Everyday a match</span>
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Eine Dating-App, die lieber auswählt als überfordert.</p>
            <h1 className={styles.headline}>Ein Match. Ein echter Tag. Kein endloses Swipen.</h1>
            <p className={styles.lead}>
              Choice sucht nicht möglichst viele Optionen, sondern die Person, bei der es wirklich passen könnte.
              Die App führt euch in klaren Phasen durch das Kennenlernen, statt euch einfach mit einem Chat allein zu lassen.
            </p>

            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href="#phasen">
                Die 5 Phasen ansehen
              </a>
              <a className={styles.secondaryAction} href="#prinzip">
                Wie Choice denkt
              </a>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.panelOrbBlue} />
            <div className={styles.panelOrbPink} />

            <div className={styles.timelineCard}>
              <div className={styles.timelineHeader}>
                <span className={styles.timelineLabel}>Heute</span>
                <span className={styles.timelineTime}>09:00</span>
              </div>
              <p className={styles.timelineTitle}>Dein Match wird freigeschaltet.</p>
              <p className={styles.timelineText}>Choice legt fest, wer den Chat eröffnet. Bis 21 Uhr entscheidet ihr, ob es morgen weitergeht.</p>
            </div>

            <div className={styles.metricRow}>
              <article className={styles.metricCard}>
                <span className={styles.metricValue}>1</span>
                <span className={styles.metricLabel}>Match pro Tag</span>
              </article>
              <article className={styles.metricCard}>
                <span className={styles.metricValue}>3</span>
                <span className={styles.metricLabel}>Fragen in Phase 2</span>
              </article>
              <article className={styles.metricCard}>
                <span className={styles.metricValue}>5</span>
                <span className={styles.metricLabel}>klare Phasen</span>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="prinzip">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Was Choice anders macht</p>
          <h2 className={styles.sectionTitle}>Choice soll sich eher wie ein gutes System anfühlen als wie ein Feed.</h2>
        </div>

        <div className={styles.principlesGrid}>
          {principles.map((item) => (
            <article key={item.title} className={styles.principleCard}>
              <h3 className={styles.principleTitle}>{item.title}</h3>
              <p className={styles.principleBody}>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="phasen">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Die Reise</p>
          <h2 className={styles.sectionTitle}>Fünf Phasen, damit aus einem Match nicht nur ein beliebiger Chat wird.</h2>
        </div>

        <div className={styles.phasesGrid}>
          {phases.map((phase) => (
            <article key={phase.number} className={styles.phaseCard}>
              <div className={styles.phaseNumber}>{phase.number}</div>
              <h3 className={styles.phaseTitle}>{phase.title}</h3>
              <p className={styles.phaseBody}>{phase.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaCard}>
          <p className={styles.sectionEyebrow}>Website + App</p>
          <h2 className={styles.ctaTitle}>Die Website erklärt Choice. Die App ist der eigentliche Ort für Matches, Chat und Phasen.</h2>
          <p className={styles.ctaBody}>
            Das Schöne daran: Wir können beides im selben Projekt halten. Die Website läuft sauber im Browser auf dem Mac und Handy.
            Die Expo-App bleibt parallel für iPhone, Android und Expo Go bestehen.
          </p>
          <div className={styles.ctaMeta}>
            <span>Website: Next.js</span>
            <span>App: Expo</span>
            <span>Ein gemeinsames Projekt</span>
          </div>
        </div>
      </section>
    </main>
  );
}
