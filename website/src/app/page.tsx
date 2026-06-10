import Image from "next/image";
import styles from "./page.module.css";

const phases = [
  {
    number: "01",
    time: "09:00 bis 21:00",
    title: "Ein Match am Morgen",
    body:
      "Choice zeigt dir genau eine Person und entscheidet, wer den ersten Schritt macht. Ihr habt den Tag, um euch ein erstes Bild zu machen.",
  },
  {
    number: "02",
    time: "Am nächsten Morgen",
    title: "Choice-Runde",
    body:
      "Wenn ihr beide weitermachen wollt, prüft Choice mit drei Dilemma-Fragen, ob eure Haltung bei wichtigen Themen wirklich zueinander passt.",
  },
  {
    number: "03",
    time: "Nach der Runde",
    title: "Bleiben oder neu starten",
    body:
      "Spätestens hier wird sichtbar, ob ihr euch wirklich füreinander entscheidet oder nur aus Gewohnheit weitergeschrieben hättet.",
  },
  {
    number: "04",
    time: "Raum statt Dauerchat",
    title: "Bewusste Pause",
    body:
      "Choice nimmt Druck raus. Nicht permanent verfügbar sein zu müssen, macht ehrlicher sichtbar, was nach dem ersten Reiz wirklich bleibt.",
  },
  {
    number: "05",
    time: "Das Finale",
    title: "Choice Award",
    body:
      "Wenn am Ende noch etwas da ist, bekommt eure Verbindung ein echtes Finale statt einfach im Nachrichtenverlauf zu verschwinden.",
  },
];

const principles = [
  {
    label: "Weniger Feed",
    title: "Choice will dich nicht beschäftigen, sondern für dich auswählen.",
    body:
      "Nicht möglichst viele Optionen, sondern möglichst viel Klarheit. Choice ist dafür gebaut, dich nicht in endlosen Entscheidungen festzuhalten.",
  },
  {
    label: "Mehr Haltung",
    title: "Entscheidend ist nicht nur, was ihr mögt, sondern wie ihr denkt.",
    body:
      "Interessen sind schön. Aber langfristig wichtiger ist, wie zwei Menschen mit Nähe, Grenzen, Unsicherheit, Ehrlichkeit und Konsequenz umgehen.",
  },
  {
    label: "Mehr Richtung",
    title: "Jede Phase hat eine Funktion und jede Entscheidung eine Folge.",
    body:
      "Statt Chat ohne Richtung entsteht Schritt für Schritt mehr Klarheit. So fühlt sich Dating weniger beliebig und deutlich aufgeräumter an.",
  },
];

const comparisons = [
  {
    title: "Klassische Dating-App",
    points: [
      "Viele Optionen gleichzeitig",
      "Endloses Swipen",
      "Beliebige Chats ohne Richtung",
      "Interesse bleibt oft unklar",
    ],
  },
  {
    title: "Choice",
    points: [
      "Ein Match pro Tag",
      "Klare Zeitfenster",
      "Phasen statt Dauerchat",
      "Mehr Klarheit statt mehr Lärm",
    ],
  },
];

const featuredPeople = [
  {
    name: "Mila",
    age: 26,
    city: "Berlin",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
    note: "Espresso, Flohmärkte, späte Spaziergänge.",
  },
  {
    name: "Lina",
    age: 24,
    city: "Köln",
    image:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
    note: "Galerien, lange Texte und spontane Zugtickets.",
  },
  {
    name: "Zoë",
    age: 27,
    city: "Hamburg",
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    note: "Läuft gern am Wasser und bleibt dann zu lange auf einen Flat White.",
  },
];

const faqs = [
  {
    question: "Warum nur ein Match am Tag?",
    answer:
      "Weil Choice nicht auf Masse setzt. Ein Match soll genug Raum bekommen, damit man wirklich merkt, ob da etwas ist oder nicht.",
  },
  {
    question: "Warum gibt es Phasen statt einfach nur einen Chat?",
    answer:
      "Weil sich ein Match sonst oft endlos zieht, ohne dass etwas klarer wird. Die Phasen sorgen dafür, dass jede Entscheidung etwas bedeutet.",
  },
  {
    question: "Worin ist Choice anders als Tinder oder Bumble?",
    answer:
      "Choice sucht nicht nach möglichst viel Aktivität, sondern nach echter Passung. Die App versucht bewusst, Druck, Beliebigkeit und Feed-Gefühl zu reduzieren.",
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroHeartBackdrop} aria-hidden="true" />
        <div className={styles.heroGlowBlue} aria-hidden="true" />
        <div className={styles.heroGlowPink} aria-hidden="true" />

        <div className={styles.heroBrandRow}>
          <span className={styles.brandMark}>Choice</span>
          <span className={styles.brandCaption}>Everyday a match</span>
        </div>

        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Eine Dating-App, die lieber auswählt als überfordert.</p>
            <h1 className={styles.headline}>Ein Match am Tag. Ein echter Ablauf. Weniger Lärm.</h1>
            <p className={styles.lead}>
              Choice sucht nicht nach möglichst vielen Optionen, sondern nach der Person, bei der es sich wirklich lohnen
              könnte. Statt Feed und Dauerchat gibt es klare Phasen, klare Zeitfenster und klarere Entscheidungen.
            </p>

            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href="#phasen">
                Die 5 Phasen
              </a>
              <a className={styles.secondaryAction} href="#prinzip">
                Warum Choice anders ist
              </a>
            </div>

            <div className={styles.heroMetaRow}>
              <span>09:00 ein Match</span>
              <span>bis 21:00 entscheiden</span>
              <span>5 klare Phasen</span>
            </div>
          </div>

          <div className={styles.heroStack}>
            <article className={styles.heroImageCard}>
              <div className={styles.heroImageFrame}>
                <Image
                  src="/choice-heart.png"
                  alt="Das Choice Herz"
                  fill
                  sizes="(max-width: 1080px) 100vw, 420px"
                  className={styles.heroImage}
                />
              </div>
              <div className={styles.heroImageMeta}>
                <span className={styles.heroImageTag}>Choice Award</span>
                <p className={styles.heroImageText}>Ein System mit eigenem Finale statt einfach nur einem weiteren Chat.</p>
              </div>
            </article>

            <article className={styles.scheduleCard}>
              <div className={styles.scheduleHeader}>
                <span className={styles.scheduleLabel}>Heute</span>
                <span className={styles.scheduleTime}>09:00</span>
              </div>
              <h2 className={styles.scheduleTitle}>Choice schaltet dein Match frei.</h2>
              <p className={styles.scheduleBody}>
                Ihr bekommt Raum für einen echten Tag statt für zehn halbe Gespräche. Bis 21 Uhr entscheidet ihr, ob es
                morgen weitergeht.
              </p>
            </article>

            <div className={styles.statGrid}>
              <article className={styles.statCard}>
                <span className={styles.statValue}>1</span>
                <span className={styles.statLabel}>Match pro Tag</span>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statValue}>3</span>
                <span className={styles.statLabel}>Fragen in Phase 2</span>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statValue}>5</span>
                <span className={styles.statLabel}>klare Schritte</span>
              </article>
            </div>

            <article className={styles.quoteCard}>
              <p className={styles.quoteText}>
                Choice soll sich nicht wie eine App anfühlen, die dich bei Laune hält. Sondern wie ein System, das dir
                hilft, die richtige Person ernster zu erkennen.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.section} id="prinzip">
        <div className={styles.sectionIntro}>
          <p className={styles.sectionEyebrow}>Was Choice anders macht</p>
          <h2 className={styles.sectionTitle}>Nicht mehr Auswahl. Sondern mehr Klarheit darüber, ob es wirklich passt.</h2>
        </div>

        <div className={styles.principlesGrid}>
          {principles.map((item) => (
            <article key={item.title} className={styles.principleCard}>
              <span className={styles.cardLabel}>{item.label}</span>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardBody}>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="menschen">
        <div className={styles.sectionIntro}>
          <p className={styles.sectionEyebrow}>Menschen statt Feed</p>
          <h2 className={styles.sectionTitle}>Choice soll nach echten Personen aussehen, nicht nach endloser Auswahl.</h2>
        </div>

        <div className={styles.peopleGrid}>
          {featuredPeople.map((person) => (
            <article key={person.name} className={styles.personCard}>
              <div className={styles.personImageWrap}>
                <img src={person.image} alt={`${person.name} aus ${person.city}`} className={styles.personImage} />
              </div>
              <div className={styles.personMeta}>
                <div className={styles.personTopRow}>
                  <h3 className={styles.personName}>
                    {person.name}, {person.age}
                  </h3>
                  <span className={styles.personCity}>{person.city}</span>
                </div>
                <p className={styles.personNote}>{person.note}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="visuell">
        <div className={styles.visualGrid}>
          <article className={styles.visualPhoneCard}>
            <div className={styles.visualPhoneFrame}>
              <div className={styles.visualPhoneTop}>
                <span className={styles.visualPhoneBrand}>Choice</span>
                <span className={styles.visualPhoneTime}>09:00</span>
              </div>
              <div className={styles.visualPhoneBody}>
                <div className={styles.visualBubbleLeft}>Choice zeigt dir genau eine Person.</div>
                <div className={styles.visualBubbleRight}>Bis 21 Uhr entscheidet ihr, ob es morgen weitergeht.</div>
                <div className={styles.visualPhaseRow}>
                  <span>Phase 1</span>
                  <span>Phase 2</span>
                  <span>Phase 3</span>
                </div>
              </div>
            </div>
          </article>

          <article className={styles.visualInfoCard}>
            <span className={styles.cardLabel}>Weniger Beliebigkeit</span>
            <h3 className={styles.cardTitle}>Choice reduziert die Oberfläche, damit das Entscheidende sichtbarer wird.</h3>
            <p className={styles.cardBody}>
              Weniger gleichzeitige Chats, weniger offene Schleifen und mehr Klarheit darüber, ob ihr wirklich zueinander
              passt.
            </p>
          </article>

          <article className={styles.visualHeartCard}>
            <div className={styles.visualHeartFrame}>
              <Image
                src="/choice-heart.png"
                alt="Choice Herz"
                fill
                sizes="(max-width: 1080px) 100vw, 520px"
                className={styles.visualHeartImage}
              />
            </div>
          </article>
        </div>
      </section>

      <section className={styles.section} id="vergleich">
        <div className={styles.comparisonWrap}>
          <div className={styles.comparisonIntro}>
            <p className={styles.sectionEyebrow}>Der Unterschied</p>
            <h2 className={styles.sectionTitle}>Choice will nicht mehr Aktivität. Choice will bessere Entscheidungen.</h2>
          </div>

          <div className={styles.comparisonGrid}>
            {comparisons.map((column) => (
              <article key={column.title} className={styles.comparisonCard}>
                <h3 className={styles.comparisonTitle}>{column.title}</h3>
                <ul className={styles.comparisonList}>
                  {column.points.map((point) => (
                    <li key={point} className={styles.comparisonItem}>
                      <span className={styles.comparisonDot} aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="phasen">
        <div className={styles.sectionIntro}>
          <p className={styles.sectionEyebrow}>Die 5 Phasen</p>
          <h2 className={styles.sectionTitle}>Fünf klare Schritte, damit aus einem Match nicht nur ein beliebiger Chat wird.</h2>
        </div>

        <div className={styles.phaseRail}>
          {phases.map((phase) => (
            <article key={phase.number} className={styles.phaseCard}>
              <div className={styles.phaseTopRow}>
                <span className={styles.phaseNumber}>{phase.number}</span>
                <span className={styles.phaseTime}>{phase.time}</span>
              </div>
              <h3 className={styles.phaseTitle}>{phase.title}</h3>
              <p className={styles.phaseBody}>{phase.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="faq">
        <div className={styles.sectionIntro}>
          <p className={styles.sectionEyebrow}>FAQ</p>
          <h2 className={styles.sectionTitle}>Die wichtigsten Fragen, bevor Choice überhaupt losgeht.</h2>
        </div>

        <div className={styles.faqList}>
          {faqs.map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>{item.question}</summary>
              <p className={styles.faqAnswer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaCard}>
          <p className={styles.sectionEyebrow}>Choice ist als App gedacht</p>
          <h2 className={styles.ctaTitle}>Die Website erklärt das System. Die App ist der eigentliche Ort für Match, Chat und Phasen.</h2>
          <p className={styles.ctaBody}>
            Choice soll sich auf dem Handy klar und konzentriert anfühlen. Die Website gibt den Überblick. Die App macht
            daraus einen echten Ablauf.
          </p>
          <div className={styles.ctaPills}>
            <span>Website auf choice-dating.app</span>
            <span>App-Fokus: Match, Chat, Phasen</span>
            <span>Weniger Feed, mehr Richtung</span>
          </div>
        </div>
      </section>
    </main>
  );
}
