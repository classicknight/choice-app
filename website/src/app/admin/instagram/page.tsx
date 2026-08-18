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
const CHOICE_PINK = "#FF4C78";

let choiceLogoPromise: Promise<HTMLImageElement> | null = null;

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
  const base = context.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  base.addColorStop(0, background === "warmth" ? "#160B13" : "#09080F");
  base.addColorStop(0.58, background === "midnight" ? "#0B101B" : "#0C0912");
  base.addColorStop(1, background === "warmth" ? "#12070E" : "#08070C");
  context.fillStyle = base;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const blueGlow = context.createRadialGradient(990, 85, 0, 990, 85, 620);
  blueGlow.addColorStop(0, background === "warmth" ? "rgba(91, 205, 242, 0.12)" : "rgba(91, 205, 242, 0.27)");
  blueGlow.addColorStop(1, "rgba(91, 205, 242, 0)");
  context.fillStyle = blueGlow;
  context.fillRect(0, 0, CANVAS_WIDTH, 760);

  const pinkGlow = context.createRadialGradient(50, 1310, 0, 50, 1310, 610);
  pinkGlow.addColorStop(0, background === "midnight" ? "rgba(255, 76, 120, 0.09)" : "rgba(255, 76, 120, 0.22)");
  pinkGlow.addColorStop(1, "rgba(255, 76, 120, 0)");
  context.fillStyle = pinkGlow;
  context.fillRect(0, 720, CANVAS_WIDTH, 630);
}

function loadChoiceLogo() {
  if (!choiceLogoPromise) {
    choiceLogoPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = "/choice-logo.png";
    });
  }

  return choiceLogoPromise;
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

async function drawPost(
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
  const foreground = "#FFF4F7";
  const secondary = "rgba(232, 219, 236, 0.58)";
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
  context.fillStyle = CHOICE_BLUE;
  drawLetterSpacedText(context, "CHOICE", 84, 110, 10);
  context.restore();

  context.save();
  context.fillStyle = CHOICE_PINK;
  context.fillRect(84, 154, 58, 5);
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

  try {
    const logo = await loadChoiceLogo();
    context.save();
    context.globalAlpha = 0.95;
    context.drawImage(logo, 108, 52, 552, 486, 878, 1164, 128, 113);
    context.restore();
  } catch {
    // The post remains exportable if the decorative logo asset cannot load.
  }
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

    const render = () => void drawPost(canvas, draft.text, draft.background);
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
            <h1 className={styles.title}>Ein Monat Content, ohne jeden Tag neu anzufangen.</h1>
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
            <p>Zitat 650 · blauer Choice-Schriftzug 800 mit weitem Zeichenabstand</p>
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
