"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import {
  BACKGROUND_LABELS,
  INSTAGRAM_POSTS,
  type InstagramBackground,
} from "./content";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const CHOICE_BLUE = "#8EDDF4";

type StoredDraft = {
  text: string;
  caption: string;
  background: InstagramBackground;
  published: boolean;
};

type DraftMap = Record<number, StoredDraft>;

function drawLetterSpacedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  let cursor = x;

  for (const character of text) {
    context.fillText(character, cursor, y);
    cursor += context.measureText(character).width + spacing;
  }
}

function drawBackground(context: CanvasRenderingContext2D, background: InstagramBackground) {
  const base = context.createRadialGradient(
    CANVAS_WIDTH * 0.52,
    CANVAS_HEIGHT * 0.46,
    40,
    CANVAS_WIDTH * 0.52,
    CANVAS_HEIGHT * 0.46,
    CANVAS_HEIGHT * 0.78,
  );

  if (background === "warmth") {
    base.addColorStop(0, "#F4E5E8");
    base.addColorStop(1, "#E8CFD5");
  } else if (background === "midnight") {
    base.addColorStop(0, "#141317");
    base.addColorStop(1, "#050506");
  } else {
    base.addColorStop(0, "#F7F2E9");
    base.addColorStop(1, "#E9DFD2");
  }

  context.fillStyle = base;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function getWrappedLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.trim().split(/\s+/);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;

      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) {
      lines.push(line);
    }
  }

  return lines;
}

function drawPost(
  canvas: HTMLCanvasElement,
  text: string,
  background: InstagramBackground,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  drawBackground(context, background);

  const bodyFont = window.getComputedStyle(document.body).fontFamily || "Manrope, sans-serif";
  const foreground = background === "midnight" ? "#F3EEE7" : "#171616";
  const secondary = background === "midnight" ? "rgba(243, 238, 231, 0.58)" : "rgba(23, 22, 22, 0.58)";
  const wordmarkColor = background === "midnight" ? CHOICE_BLUE : "#171616";
  let fontSize = 76;
  const maxWidth = 820;
  let lines: string[] = [];

  while (fontSize >= 50) {
    context.font = `650 ${fontSize}px ${bodyFont}`;
    lines = getWrappedLines(context, text, maxWidth);
    const estimatedHeight = lines.reduce((height, line) => height + (line ? fontSize * 1.16 : fontSize * 0.7), 0);

    if (estimatedHeight <= 640) {
      break;
    }

    fontSize -= 2;
  }

  const lineHeight = fontSize * 1.16;
  const blankHeight = fontSize * 0.7;
  const totalHeight = lines.reduce((height, line) => height + (line ? lineHeight : blankHeight), 0);
  let y = Math.max(330, (CANVAS_HEIGHT - totalHeight) * 0.44);

  context.save();
  context.font = `800 31px ${bodyFont}`;
  context.fillStyle = wordmarkColor;
  drawLetterSpacedText(context, "CHOICE", 84, 110, 10);
  context.restore();

  context.save();
  context.font = `650 ${fontSize}px ${bodyFont}`;
  context.fillStyle = foreground;
  context.textBaseline = "top";

  for (const line of lines) {
    if (!line) {
      y += blankHeight;
      continue;
    }

    context.fillText(line, 84, y);
    y += lineHeight;
  }

  context.restore();

  context.save();
  context.font = `750 17px ${bodyFont}`;
  context.fillStyle = secondary;
  drawLetterSpacedText(context, "EVERYDAY A MATCH.", 84, 1247, 4.2);
  context.restore();
}

export default function InstagramStudioPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasLoadedDrafts = useRef(false);
  const [activeDay, setActiveDay] = useState(1);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const basePost = INSTAGRAM_POSTS[activeDay - 1];
  const draft = drafts[activeDay] ?? {
    text: basePost.text,
    caption: basePost.caption,
    background: basePost.background,
    published: false,
  };

  useEffect(() => {
    const loadDrafts = window.setTimeout(() => {
      const storedDrafts = window.localStorage.getItem("choice-instagram-drafts-v1");

      if (storedDrafts) {
        try {
          setDrafts(JSON.parse(storedDrafts) as DraftMap);
        } catch {
          window.localStorage.removeItem("choice-instagram-drafts-v1");
        }
      }

      hasLoadedDrafts.current = true;
    }, 0);

    return () => window.clearTimeout(loadDrafts);
  }, []);

  useEffect(() => {
    if (!hasLoadedDrafts.current) {
      return;
    }

    window.localStorage.setItem("choice-instagram-drafts-v1", JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const render = () => drawPost(canvas, draft.text, draft.background);
    render();
    void document.fonts?.ready.then(render);
  }, [draft.background, draft.text]);

  function updateDraft(update: Partial<StoredDraft>) {
    setDrafts((current) => ({
      ...current,
      [activeDay]: {
        ...draft,
        ...update,
      },
    }));
  }

  function selectDay(day: number) {
    setActiveDay(day);
    setCopyNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetDraft() {
    setDrafts((current) => {
      const next = { ...current };
      delete next[activeDay];
      return next;
    });
  }

  function downloadPost() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    link.download = `choice-instagram-${String(activeDay).padStart(2, "0")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function copyCaption() {
    await navigator.clipboard.writeText(draft.caption);
    setCopyNotice("Caption kopiert");
    window.setTimeout(() => setCopyNotice(null), 1800);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Choice Content Studio</p>
            <h1 className={styles.title}>Sechs Wochen Content, ohne jeden Tag neu anzufangen.</h1>
            <p className={styles.lead}>
              Fester Choice-Look, editierbare Texte und direkter PNG-Export für Instagram. Deine Änderungen und der
              Veröffentlichungsstatus bleiben in diesem Browser gespeichert.
            </p>
          </div>
          <Link href="/admin" className={styles.backLink}>Zum Adminbereich</Link>
        </header>

        <section className={styles.brandGuide}>
          <div>
            <span className={styles.guideLabel}>Schrift</span>
            <strong>Söhne / Manrope</strong>
            <p>Zitat 650 · Choice-Schriftzug 800: blau, auf Creme kontrastreich dunkel</p>
          </div>
          <div>
            <span className={styles.guideLabel}>Rhythmus</span>
            <strong>7 Formate pro Woche</strong>
            <p>Haltung · Frage · Nähe · Klarheit · Mut · Leichtigkeit · Reflexion</p>
          </div>
          <div>
            <span className={styles.guideLabel}>Format</span>
            <strong>1080 × 1350 PNG</strong>
            <p>Instagram 4:5 · genügend Rand für die Feed-Vorschau</p>
          </div>
        </section>

        <section className={styles.workspace}>
          <div className={styles.previewPanel}>
            <div className={styles.previewMeta}>
              <div>
                <span>Tag {activeDay} · {basePost.weekday}</span>
                <strong>{basePost.purpose}</strong>
              </div>
              <span className={styles.resolution}>1080 × 1350</span>
            </div>
            <canvas ref={canvasRef} className={styles.canvas} aria-label="Instagram-Beitragsvorschau" />
          </div>

          <div className={styles.controls}>
            <div className={styles.controlHeader}>
              <div>
                <p className={styles.controlEyebrow}>{basePost.theme}</p>
                <h2>Beitrag bearbeiten</h2>
              </div>
              <button type="button" className={styles.resetButton} onClick={resetDraft}>Zurücksetzen</button>
            </div>

            <label className={styles.field}>
              <span>Text im Bild</span>
              <textarea
                value={draft.text}
                onChange={(event) => updateDraft({ text: event.target.value })}
                rows={7}
                maxLength={230}
              />
              <small>{draft.text.length}/230 Zeichen</small>
            </label>

            <label className={styles.field}>
              <span>Choice-Hintergrund</span>
              <select
                value={draft.background}
                onChange={(event) => updateDraft({ background: event.target.value as InstagramBackground })}
              >
                {(Object.keys(BACKGROUND_LABELS) as InstagramBackground[]).map((key) => (
                  <option key={key} value={key}>{BACKGROUND_LABELS[key]}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Caption</span>
              <textarea
                value={draft.caption}
                onChange={(event) => updateDraft({ caption: event.target.value })}
                rows={8}
              />
            </label>

            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={downloadPost}>PNG herunterladen</button>
              <button type="button" className={styles.secondaryButton} onClick={() => void copyCaption()}>
                {copyNotice ?? "Caption kopieren"}
              </button>
            </div>

            <label className={styles.publishToggle}>
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(event) => updateDraft({ published: event.target.checked })}
              />
              <span>Als veröffentlicht markieren</span>
            </label>
          </div>
        </section>

        <section className={styles.planSection}>
          <div className={styles.planHeader}>
            <div>
              <p className={styles.eyebrow}>28-Tage-Plan</p>
              <h2>Ein klarer Rhythmus statt 28 beliebiger Zitate.</h2>
            </div>
            <p>Die Themen wiederholen sich wöchentlich, die Aussagen nicht. So wirkt der Feed zusammenhängend, aber nicht monoton.</p>
          </div>

          <div className={styles.planGrid}>
            {INSTAGRAM_POSTS.map((post) => {
              const postDraft = drafts[post.day];
              const published = postDraft?.published ?? false;

              return (
                <button
                  key={post.day}
                  type="button"
                  className={[
                    styles.planCard,
                    activeDay === post.day ? styles.planCardActive : "",
                    published ? styles.planCardPublished : "",
                  ].join(" ")}
                  onClick={() => selectDay(post.day)}
                >
                  <span className={styles.planDay}>{String(post.day).padStart(2, "0")}</span>
                  <span className={styles.planTheme}>{post.weekday} · {post.theme}</span>
                  <strong>{postDraft?.text || post.text}</strong>
                  <span className={styles.planStatus}>{published ? "Veröffentlicht" : "Öffnen"}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
