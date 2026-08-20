"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const REEL_WIDTH = 1080;
const REEL_HEIGHT = 1920;
const REEL_STORAGE_KEY = "choice-instagram-reel-draft-v1";
const CHOICE_BLUE = "#8EDDF4";

type ReelStyle = "clean" | "reaction" | "dramatic";
type MessageSender = "me" | "partner";

type ChatMessage = {
  sender: MessageSender;
  text: string;
};

type ReelDraft = {
  hook: string;
  partner: string;
  messages: string;
  ending: string;
  reaction: string;
  style: ReelStyle;
  pace: number;
};

type ReelScene = {
  kind: "intro" | "chat" | "reaction" | "outro";
  visibleMessages: number;
  duration: number;
  label: string;
};

const DEFAULT_DRAFT: ReelDraft = {
  hook: "Sie antwortet nach drei Stunden. Dann schreibt sie das.",
  partner: "Mara",
  messages: [
    "sie: Ich musste gerade nochmal an gestern denken.",
    "ich: Hoffentlich an den guten Teil.",
    "sie: An den Teil, bei dem ich nicht gehen wollte.",
    "ich: Dann sollten wir ihn wiederholen.",
    "sie: Diesmal ohne Ausrede?",
    "ich: Diesmal als echtes Date.",
  ].join("\n"),
  ending: "Manchmal beginnt etwas Echtes mit einer Nachricht.",
  reaction: "ER VERSUCHT, COOL ZU BLEIBEN.",
  style: "clean",
  pace: 1500,
};

const STYLE_LABELS: Record<ReelStyle, { name: string; detail: string }> = {
  clean: {
    name: "Clean",
    detail: "Nur Chat, ruhig und hochwertig.",
  },
  reaction: {
    name: "Reaction",
    detail: "Ein kurzer Reaktions-Cut in der Mitte.",
  },
  dramatic: {
    name: "Dramatisch",
    detail: "Mehr Kontrast und langsamerer Spannungsaufbau.",
  },
};

function parseMessages(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<ChatMessage>((line, index) => {
      const separator = line.indexOf(":");

      if (separator === -1) {
        return {
          sender: index % 2 === 0 ? "partner" : "me",
          text: line,
        };
      }

      const author = line.slice(0, separator).trim().toLowerCase();
      const text = line.slice(separator + 1).trim();

      return {
        sender: ["ich", "er", "m", "me"].includes(author) ? "me" : "partner",
        text,
      };
    })
    .filter((message) => message.text);
}

function buildScenes(draft: ReelDraft, messages: ChatMessage[]) {
  const scenes: ReelScene[] = [
    {
      kind: "intro",
      visibleMessages: 0,
      duration: draft.pace + 300,
      label: "Hook",
    },
  ];
  const reactionAfter = Math.max(1, Math.ceil(messages.length / 2));

  messages.forEach((_, index) => {
    const visibleMessages = index + 1;
    scenes.push({
      kind: "chat",
      visibleMessages,
      duration: draft.style === "dramatic" ? draft.pace + 350 : draft.pace,
      label: `Nachricht ${visibleMessages}`,
    });

    if (draft.style === "reaction" && visibleMessages === reactionAfter) {
      scenes.push({
        kind: "reaction",
        visibleMessages,
        duration: 800,
        label: "Reaction-Cut",
      });
    }
  });

  scenes.push({
    kind: "outro",
    visibleMessages: messages.length,
    duration: draft.pace + 500,
    label: "Choice-Endcard",
  });

  return scenes;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function wrappedLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function fillWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const lines = wrappedLines(context, text, maxWidth);

  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });

  return lines.length;
}

function drawReelBackground(context: CanvasRenderingContext2D, style: ReelStyle) {
  context.fillStyle = "#08060D";
  context.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT);

  const topGlow = context.createRadialGradient(880, 120, 20, 880, 120, 620);
  topGlow.addColorStop(0, style === "dramatic" ? "rgba(228, 47, 93, 0.34)" : "rgba(60, 181, 218, 0.24)");
  topGlow.addColorStop(1, "rgba(8, 6, 13, 0)");
  context.fillStyle = topGlow;
  context.fillRect(0, 0, REEL_WIDTH, 760);

  const bottomGlow = context.createRadialGradient(80, 1810, 30, 80, 1810, 690);
  bottomGlow.addColorStop(0, "rgba(198, 36, 98, 0.25)");
  bottomGlow.addColorStop(1, "rgba(8, 6, 13, 0)");
  context.fillStyle = bottomGlow;
  context.fillRect(0, 1180, REEL_WIDTH, 740);
}

function drawWordmark(context: CanvasRenderingContext2D, bodyFont: string) {
  context.save();
  context.fillStyle = CHOICE_BLUE;
  context.font = `800 32px ${bodyFont}`;
  context.letterSpacing = "10px";
  context.fillText("CHOICE", 72, 92);
  context.restore();
}

function drawChatHeader(
  context: CanvasRenderingContext2D,
  partner: string,
  bodyFont: string,
) {
  context.save();
  roundedRect(context, 52, 138, 976, 152, 48);
  context.fillStyle = "rgba(24, 19, 31, 0.94)";
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.lineWidth = 2;
  context.stroke();

  const avatar = context.createLinearGradient(88, 178, 178, 264);
  avatar.addColorStop(0, "#84DFF8");
  avatar.addColorStop(1, "#D73974");
  context.beginPath();
  context.arc(132, 214, 45, 0, Math.PI * 2);
  context.fillStyle = avatar;
  context.fill();

  context.fillStyle = "#FFF5F8";
  context.font = `800 34px ${bodyFont}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(partner.trim().slice(0, 1).toUpperCase() || "M", 132, 214);

  context.textAlign = "left";
  context.fillStyle = "#FFF5F8";
  context.font = `750 37px ${bodyFont}`;
  context.fillText(partner || "Mara", 207, 197);

  context.fillStyle = "#77E8A8";
  context.beginPath();
  context.arc(217, 243, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(235, 225, 240, 0.62)";
  context.font = `550 23px ${bodyFont}`;
  context.fillText("online", 237, 244);

  context.fillStyle = "rgba(255, 255, 255, 0.52)";
  context.font = `700 38px ${bodyFont}`;
  context.fillText("•••", 914, 218);
  context.restore();
}

function measureBubble(
  context: CanvasRenderingContext2D,
  message: ChatMessage,
  bodyFont: string,
) {
  const maxTextWidth = 680;
  context.font = `560 36px ${bodyFont}`;
  const lines = wrappedLines(context, message.text, maxTextWidth);
  const textWidth = Math.max(...lines.map((line) => context.measureText(line).width), 150);

  return {
    lines,
    width: Math.min(760, Math.max(240, textWidth + 64)),
    height: lines.length * 50 + 54,
  };
}

function drawChatScene(
  context: CanvasRenderingContext2D,
  draft: ReelDraft,
  messages: ChatMessage[],
  visibleMessages: number,
  bodyFont: string,
) {
  context.save();
  drawChatHeader(context, draft.partner, bodyFont);

  const visible = messages.slice(0, visibleMessages);
  const placements: Array<{
    message: ChatMessage;
    lines: string[];
    width: number;
    height: number;
    x: number;
    y: number;
    newest: boolean;
  }> = [];
  let cursorY = 1570;

  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const message = visible[index];
    const measurement = measureBubble(context, message, bodyFont);
    const y = cursorY - measurement.height;

    if (y < 350) {
      break;
    }

    placements.unshift({
      message,
      ...measurement,
      x: message.sender === "me" ? REEL_WIDTH - 70 - measurement.width : 70,
      y,
      newest: index === visible.length - 1,
    });
    cursorY = y - 42;
  }

  for (const placement of placements) {
    roundedRect(context, placement.x, placement.y, placement.width, placement.height, 34);

    if (placement.message.sender === "me") {
      const bubble = context.createLinearGradient(
        placement.x,
        placement.y,
        placement.x + placement.width,
        placement.y + placement.height,
      );
      bubble.addColorStop(0, "#15629A");
      bubble.addColorStop(1, "#2479B2");
      context.fillStyle = bubble;
    } else {
      context.fillStyle = "#1D1923";
    }

    context.fill();
    context.strokeStyle = placement.newest
      ? "rgba(142, 221, 244, 0.34)"
      : "rgba(255, 255, 255, 0.08)";
    context.lineWidth = placement.newest ? 3 : 2;
    context.stroke();

    context.fillStyle = "#FFF7FA";
    context.font = `560 36px ${bodyFont}`;
    context.textBaseline = "top";
    placement.lines.forEach((line, index) => {
      context.fillText(line, placement.x + 32, placement.y + 27 + index * 50);
    });
  }

  context.fillStyle = "rgba(232, 219, 237, 0.48)";
  context.font = `750 21px ${bodyFont}`;
  context.textAlign = "center";
  context.fillText("BEGINN EURES CHATS", REEL_WIDTH / 2, 330);

  roundedRect(context, 52, 1644, 976, 126, 63);
  context.fillStyle = "rgba(24, 19, 31, 0.94)";
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.lineWidth = 2;
  context.stroke();
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(228, 214, 235, 0.42)";
  context.font = `550 31px ${bodyFont}`;
  context.fillText("Nachricht schreiben", 98, 1707);

  context.beginPath();
  context.arc(962, 1707, 42, 0, Math.PI * 2);
  context.fillStyle = "#D33470";
  context.fill();
  context.strokeStyle = "#FFF7FA";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(962, 1726);
  context.lineTo(962, 1688);
  context.moveTo(947, 1703);
  context.lineTo(962, 1688);
  context.lineTo(977, 1703);
  context.stroke();

  context.fillStyle = "rgba(235, 224, 239, 0.5)";
  context.font = `650 24px ${bodyFont}`;
  context.textAlign = "center";
  context.fillText("MÄNNER-PERSPEKTIVE", REEL_WIDTH / 2, 1845);
  context.restore();
}

function drawIntro(
  context: CanvasRenderingContext2D,
  draft: ReelDraft,
  bodyFont: string,
) {
  context.fillStyle = "rgba(142, 221, 244, 0.72)";
  context.font = `800 25px ${bodyFont}`;
  context.letterSpacing = "7px";
  context.fillText("EIN CHATVERLAUF", 76, 442);
  context.letterSpacing = "0px";

  context.fillStyle = "#FFF4F7";
  context.font = `760 76px ${bodyFont}`;
  context.textBaseline = "top";
  const lineCount = fillWrappedText(context, draft.hook, 76, 510, 900, 91);

  context.fillStyle = "rgba(232, 219, 237, 0.62)";
  context.font = `550 31px ${bodyFont}`;
  fillWrappedText(
    context,
    "Die Nachrichten erscheinen einzeln. Der Moment bleibt im Mittelpunkt.",
    76,
    510 + lineCount * 91 + 54,
    780,
    45,
  );

  roundedRect(context, 76, 1454, 928, 170, 50);
  context.fillStyle = "rgba(255, 255, 255, 0.04)";
  context.fill();
  context.strokeStyle = "rgba(142, 221, 244, 0.18)";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = CHOICE_BLUE;
  context.font = `800 24px ${bodyFont}`;
  context.fillText("GLEICH IM CHAT", 120, 1514);
  context.fillStyle = "#FFF4F7";
  context.font = `650 35px ${bodyFont}`;
  context.fillText(`${draft.partner || "Mara"} tippt ...`, 120, 1564);
}

function drawReaction(
  context: CanvasRenderingContext2D,
  draft: ReelDraft,
  bodyFont: string,
) {
  const glow = context.createRadialGradient(540, 900, 40, 540, 900, 590);
  glow.addColorStop(0, "rgba(211, 52, 112, 0.26)");
  glow.addColorStop(1, "rgba(8, 6, 13, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 280, REEL_WIDTH, 1250);

  context.fillStyle = "rgba(142, 221, 244, 0.75)";
  context.font = `800 24px ${bodyFont}`;
  context.textAlign = "center";
  context.letterSpacing = "7px";
  context.fillText("REACTION CUT", REEL_WIDTH / 2, 670);
  context.letterSpacing = "0px";

  context.fillStyle = "#FFF5F8";
  context.font = `800 79px ${bodyFont}`;
  context.textBaseline = "top";
  const lines = wrappedLines(context, draft.reaction, 820);
  const startY = 800 - ((lines.length - 1) * 92) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, REEL_WIDTH / 2, startY + index * 92);
  });

  context.fillStyle = "rgba(235, 221, 238, 0.48)";
  context.font = `600 27px ${bodyFont}`;
  context.fillText("0,8 SEKUNDEN", REEL_WIDTH / 2, 1160);
}

function drawOutro(
  context: CanvasRenderingContext2D,
  draft: ReelDraft,
  bodyFont: string,
) {
  context.fillStyle = "#FFF4F7";
  context.font = `750 72px ${bodyFont}`;
  context.textBaseline = "top";
  fillWrappedText(context, draft.ending, 78, 610, 900, 88);

  context.fillStyle = CHOICE_BLUE;
  context.font = `850 48px ${bodyFont}`;
  context.letterSpacing = "14px";
  context.fillText("CHOICE", 78, 1320);
  context.letterSpacing = "0px";
  context.fillStyle = "rgba(235, 222, 238, 0.6)";
  context.font = `650 27px ${bodyFont}`;
  context.fillText("EVERYDAY A MATCH.", 80, 1396);

  roundedRect(context, 78, 1510, 474, 92, 46);
  context.fillStyle = "rgba(211, 52, 112, 0.15)";
  context.fill();
  context.strokeStyle = "rgba(240, 79, 135, 0.42)";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#FFF4F7";
  context.font = `750 28px ${bodyFont}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Mehr als endlos swipen", 315, 1556);
}

function drawReelScene(
  canvas: HTMLCanvasElement,
  draft: ReelDraft,
  messages: ChatMessage[],
  scene: ReelScene,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = REEL_WIDTH;
  canvas.height = REEL_HEIGHT;
  const bodyFont = window.getComputedStyle(document.body).fontFamily || "Manrope, sans-serif";

  drawReelBackground(context, draft.style);
  drawWordmark(context, bodyFont);

  if (scene.kind === "intro") {
    drawIntro(context, draft, bodyFont);
  } else if (scene.kind === "chat") {
    drawChatScene(context, draft, messages, scene.visibleMessages, bodyFont);
  } else if (scene.kind === "reaction") {
    drawReaction(context, draft, bodyFont);
  } else {
    drawOutro(context, draft, bodyFont);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Der Frame konnte nicht erstellt werden."));
      }
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildCutPlan(scenes: ReelScene[], draft: ReelDraft, messages: ChatMessage[]) {
  let elapsed = 0;
  const timeline = scenes.map((scene, index) => {
    const start = elapsed;
    elapsed += scene.duration;
    return `${String(index + 1).padStart(2, "0")}  ${scene.label.padEnd(18, " ")}  ${(
      start / 1000
    ).toFixed(1)}s - ${(elapsed / 1000).toFixed(1)}s  (${scene.duration} ms)`;
  });

  return [
    "CHOICE REEL - SCHNITTPLAN",
    "==========================",
    "",
    `Stil: ${STYLE_LABELS[draft.style].name}`,
    `Format: ${REEL_WIDTH} x ${REEL_HEIGHT} (9:16)`,
    `Gesamtdauer: ${(elapsed / 1000).toFixed(1)} Sekunden`,
    "Empfehlung: 30 fps, dezente Tipp-/Nachrichtensounds, Musik leise unterlegen.",
    "",
    "TIMELINE",
    ...timeline,
    "",
    "CHAT",
    ...messages.map((message) => `${message.sender === "me" ? "ICH" : draft.partner.toUpperCase()}: ${message.text}`),
    "",
    "CAPTION-IDEE",
    `${draft.ending}\n\n#choice #dating #chatverlauf #kennenlernen`,
  ].join("\n");
}

export default function ReelStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasLoadedDraft = useRef(false);
  const [draft, setDraft] = useState<ReelDraft>(DEFAULT_DRAFT);
  const [activeScene, setActiveScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const messages = parseMessages(draft.messages);
  const scenes = buildScenes(draft, messages);
  const safeActiveScene = Math.min(activeScene, scenes.length - 1);
  const scene = scenes[safeActiveScene];

  useEffect(() => {
    const storedDraft = window.localStorage.getItem(REEL_STORAGE_KEY);

    if (storedDraft) {
      try {
        const savedDraft = {
          ...DEFAULT_DRAFT,
          ...(JSON.parse(storedDraft) as Partial<ReelDraft>),
        };
        const animationFrame = window.requestAnimationFrame(() => {
          hasLoadedDraft.current = true;
          setDraft(savedDraft);
        });
        return () => window.cancelAnimationFrame(animationFrame);
      } catch {
        window.localStorage.removeItem(REEL_STORAGE_KEY);
      }
    }

    hasLoadedDraft.current = true;
  }, []);

  useEffect(() => {
    if (hasLoadedDraft.current) {
      window.localStorage.setItem(REEL_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [draft]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !scene) {
      return;
    }

    const render = () => drawReelScene(canvas, draft, messages, scene);
    render();
    void document.fonts?.ready.then(render);
  }, [draft, scene, messages]);

  useEffect(() => {
    if (!isPlaying || !scene) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (activeScene >= scenes.length - 1) {
        setIsPlaying(false);
        return;
      }

      setActiveScene((current) => current + 1);
    }, scene.duration);

    return () => window.clearTimeout(timer);
  }, [activeScene, isPlaying, scene, scenes.length]);

  function updateDraft(update: Partial<ReelDraft>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function togglePlayback() {
    if (!isPlaying && safeActiveScene >= scenes.length - 1) {
      setActiveScene(0);
    }

    setIsPlaying((current) => !current);
  }

  async function downloadCurrentFrame() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, `choice-reel-${String(safeActiveScene + 1).padStart(2, "0")}.png`);
  }

  async function downloadCutPackage() {
    setExportStatus("Schnittpaket wird erstellt ...");

    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const frameFolder = zip.folder("frames");

      if (!frameFolder) {
        throw new Error("Der Frame-Ordner konnte nicht erstellt werden.");
      }

      for (let index = 0; index < scenes.length; index += 1) {
        const exportCanvas = document.createElement("canvas");
        drawReelScene(exportCanvas, draft, messages, scenes[index]);
        const blob = await canvasToBlob(exportCanvas);
        const safeLabel = scenes[index].label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        frameFolder.file(
          `${String(index + 1).padStart(2, "0")}-${safeLabel}-${scenes[index].duration}ms.png`,
          blob,
        );
      }

      zip.file("schnittplan.txt", buildCutPlan(scenes, draft, messages));
      zip.file(
        "README.txt",
        [
          "CHOICE REEL SCHNITTPAKET",
          "",
          "1. Importiere den Ordner 'frames' in CapCut, Canva, Premiere oder Final Cut.",
          "2. Lege die Frames in der nummerierten Reihenfolge auf die Timeline.",
          "3. Die empfohlene Standzeit steht im Dateinamen und im schnittplan.txt.",
          "4. Ergänze kurze Tipp- oder Nachrichtensounds. Beim Reaction-Stil darf der Reaction-Frame durch einen eigenen Clip ersetzt werden.",
          "5. Exportiere als 1080 x 1920 MP4.",
          "",
          "Alle Inhalte wurden lokal in deinem Browser erstellt.",
        ].join("\n"),
      );

      const archive = await zip.generateAsync({ type: "blob" });
      downloadBlob(archive, "choice-reel-schnittpaket.zip");
      setExportStatus("Schnittpaket heruntergeladen");
    } catch {
      setExportStatus("Export fehlgeschlagen. Bitte versuche es erneut.");
    }

    window.setTimeout(() => setExportStatus(null), 2600);
  }

  return (
    <section id="reel-studio" className={styles.reelSection}>
      <div className={styles.reelHeader}>
        <div>
          <p className={styles.eyebrow}>Reel-Werkstatt</p>
          <h2>Ein Chat, Szene für Szene bereit zum Schneiden.</h2>
          <p>
            Schreibe den Verlauf, prüfe das Timing und lade alle 9:16-Frames samt Schnittplan als ZIP herunter.
          </p>
        </div>
        <span className={styles.reelBadge}>1080 × 1920</span>
      </div>

      <div className={styles.reelWorkspace}>
        <div className={styles.reelPreviewPanel}>
          <div className={styles.previewMeta}>
            <div>
              <span>Szene {safeActiveScene + 1} von {scenes.length}</span>
              <strong>{scene?.label}</strong>
            </div>
            <span className={styles.resolution}>{scene ? `${(scene.duration / 1000).toFixed(1)} s` : ""}</span>
          </div>

          <canvas ref={canvasRef} className={styles.reelCanvas} aria-label="Choice Reel-Vorschau" />

          <div className={styles.reelTransport}>
            <button
              type="button"
              className={styles.transportButton}
              onClick={() => setActiveScene((current) => Math.max(0, current - 1))}
              disabled={safeActiveScene === 0}
              aria-label="Vorherige Szene"
            >
              ‹
            </button>
            <button type="button" className={styles.playButton} onClick={togglePlayback}>
              {isPlaying ? "Pause" : safeActiveScene >= scenes.length - 1 ? "Neu abspielen" : "Vorschau abspielen"}
            </button>
            <button
              type="button"
              className={styles.transportButton}
              onClick={() => setActiveScene((current) => Math.min(scenes.length - 1, current + 1))}
              disabled={safeActiveScene >= scenes.length - 1}
              aria-label="Nächste Szene"
            >
              ›
            </button>
          </div>

          <div className={styles.sceneRail} aria-label="Reel-Szenen">
            {scenes.map((item, index) => (
              <button
                key={`${item.kind}-${index}`}
                type="button"
                className={index === safeActiveScene ? styles.sceneDotActive : styles.sceneDot}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveScene(index);
                }}
                aria-label={`Szene ${index + 1}: ${item.label}`}
              />
            ))}
          </div>
        </div>

        <div className={styles.reelControls}>
          <div className={styles.controlHeader}>
            <div>
              <p className={styles.controlEyebrow}>Story bearbeiten</p>
              <h2>Chat-Reel</h2>
            </div>
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => {
                setDraft(DEFAULT_DRAFT);
                setActiveScene(0);
                setIsPlaying(false);
              }}
            >
              Zurücksetzen
            </button>
          </div>

          <div className={styles.stylePicker}>
            {(Object.keys(STYLE_LABELS) as ReelStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                className={draft.style === style ? styles.styleOptionActive : styles.styleOption}
                onClick={() => updateDraft({ style })}
              >
                <strong>{STYLE_LABELS[style].name}</strong>
                <span>{STYLE_LABELS[style].detail}</span>
              </button>
            ))}
          </div>

          <div className={styles.reelFieldGrid}>
            <label className={styles.field}>
              <span>Name im Chat</span>
              <input
                value={draft.partner}
                onChange={(event) => updateDraft({ partner: event.target.value })}
                maxLength={18}
              />
            </label>
            <label className={styles.field}>
              <span>Tempo pro Szene</span>
              <select
                value={draft.pace}
                onChange={(event) => updateDraft({ pace: Number(event.target.value) })}
              >
                <option value={1100}>Schnell · 1,1 s</option>
                <option value={1500}>Ruhig · 1,5 s</option>
                <option value={1900}>Langsam · 1,9 s</option>
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Hook am Anfang</span>
            <textarea
              value={draft.hook}
              onChange={(event) => updateDraft({ hook: event.target.value })}
              rows={3}
              maxLength={150}
            />
          </label>

          <label className={styles.field}>
            <span>Nachrichten</span>
            <textarea
              value={draft.messages}
              onChange={(event) => updateDraft({ messages: event.target.value })}
              rows={10}
              spellCheck
            />
            <small>Eine Zeile pro Nachricht: „sie:“ oder „ich:“ · aktuell {messages.length} Nachrichten</small>
          </label>

          {draft.style === "reaction" ? (
            <label className={styles.field}>
              <span>Text für den Reaction-Cut</span>
              <input
                value={draft.reaction}
                onChange={(event) => updateDraft({ reaction: event.target.value })}
                maxLength={90}
              />
            </label>
          ) : null}

          <label className={styles.field}>
            <span>Endcard</span>
            <textarea
              value={draft.ending}
              onChange={(event) => updateDraft({ ending: event.target.value })}
              rows={3}
              maxLength={140}
            />
          </label>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={() => void downloadCutPackage()}>
              Schnittpaket (.zip)
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => void downloadCurrentFrame()}>
              Aktuellen Frame
            </button>
          </div>

          <p className={styles.exportHint}>
            Das ZIP enthält nummerierte PNG-Szenen, Standzeiten, Chattext und eine kurze Import-Anleitung.
          </p>
          {exportStatus ? <p className={styles.exportStatus}>{exportStatus}</p> : null}
        </div>
      </div>
    </section>
  );
}
