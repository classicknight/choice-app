"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const CHOICE_BLUE = "#8EDDF4";
const MIME_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm",
];

type VideoDetails = {
  duration: number;
  height: number;
  width: number;
};

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

function drawChoiceWordmark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  bodyFont: string,
) {
  const fontSize = Math.max(28, Math.round(width * 0.033));
  const x = Math.round(width * 0.065);
  const y = Math.round(height * 0.086);

  context.save();
  context.font = `800 ${fontSize}px ${bodyFont}`;
  context.fillStyle = CHOICE_BLUE;
  context.shadowColor = "rgba(0, 0, 0, 0.58)";
  context.shadowBlur = Math.max(5, width * 0.008);
  context.shadowOffsetY = Math.max(2, width * 0.002);
  context.textBaseline = "middle";
  drawLetterSpacedText(context, "CHOICE", x, y, width * 0.009);
  context.restore();
}

function waitForEvent(target: HTMLMediaElement, eventName: "loadedmetadata" | "canplay") {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Das Video konnte nicht rechtzeitig geladen werden."));
    }, 15000);

    const handleSuccess = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Das Video konnte nicht gelesen werden."));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      target.removeEventListener(eventName, handleSuccess);
      target.removeEventListener("error", handleError);
    };

    target.addEventListener(eventName, handleSuccess, { once: true });
    target.addEventListener("error", handleError, { once: true });
  });
}

function preferredMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function VideoBrandStudio() {
  const previewRef = useRef<HTMLVideoElement>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [details, setDetails] = useState<VideoDetails | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  function selectVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("video/")) {
      setStatus("Bitte wähle eine Videodatei aus.");
      return;
    }

    setSourceUrl(URL.createObjectURL(file));
    setSourceName(file.name);
    setDetails(null);
    setProgress(0);
    setStatus(null);
    event.target.value = "";
  }

  function readVideoDetails() {
    const video = previewRef.current;

    if (!video) {
      return;
    }

    setDetails({
      duration: video.duration,
      height: video.videoHeight,
      width: video.videoWidth,
    });
  }

  async function exportBrandedVideo() {
    if (!sourceUrl || isExporting) {
      return;
    }

    const mimeType = preferredMimeType();

    if (mimeType === null) {
      setStatus("Dieser Browser unterstützt den Video-Export leider nicht. Bitte öffne die Seite in Safari oder Chrome.");
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setStatus("Video wird vorbereitet …");

    let animationFrame = 0;
    let progressTimer = 0;
    let audioContext: AudioContext | null = null;
    let recordingStream: MediaStream | null = null;

    try {
      const video = document.createElement("video");
      video.src = sourceUrl;
      video.preload = "auto";
      video.playsInline = true;

      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await waitForEvent(video, "loadedmetadata");
      }
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        await waitForEvent(video, "canplay");
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d", { alpha: false });

      if (!context || !canvas.width || !canvas.height) {
        throw new Error("Das Videoformat konnte nicht vorbereitet werden.");
      }

      const bodyFont = window.getComputedStyle(document.body).fontFamily || "Manrope, sans-serif";
      const drawFrame = () => {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawChoiceWordmark(context, canvas.width, canvas.height, bodyFont);
      };
      const scheduleFrame = () => {
        drawFrame();

        if (!video.ended && !video.paused) {
          animationFrame = window.requestAnimationFrame(scheduleFrame);
        }
      };

      drawFrame();
      recordingStream = canvas.captureStream(30);

      audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(video);
      const audioDestination = audioContext.createMediaStreamDestination();
      source.connect(audioDestination);
      audioDestination.stream.getAudioTracks().forEach((track) => recordingStream?.addTrack(track));
      await audioContext.resume();

      const recorder = new MediaRecorder(recordingStream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 192000,
        videoBitsPerSecond: Math.min(16000000, Math.max(7000000, canvas.width * canvas.height * 4)),
      });
      const chunks: BlobPart[] = [];
      const recording = new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size) {
            chunks.push(event.data);
          }
        });
        recorder.addEventListener("stop", () => {
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" }));
        }, { once: true });
        recorder.addEventListener("error", () => reject(new Error("Der Video-Export wurde unterbrochen.")), { once: true });
      });

      const finished = new Promise<void>((resolve, reject) => {
        video.addEventListener("ended", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("Das Video konnte nicht vollständig abgespielt werden.")), { once: true });
      });

      recorder.start(1000);
      await video.play();
      scheduleFrame();
      setStatus("Choice wird eingebrannt. Bitte lasse diesen Tab geöffnet …");
      progressTimer = window.setInterval(() => {
        setProgress(video.duration ? Math.min(99, (video.currentTime / video.duration) * 100) : 0);
      }, 150);

      await finished;
      drawFrame();
      window.clearInterval(progressTimer);
      setProgress(100);

      if (recorder.state !== "inactive") {
        recorder.stop();
      }

      const blob = await recording;
      const exportedType = recorder.mimeType || mimeType || "video/webm";
      const extension = exportedType.includes("mp4") ? "mp4" : "webm";
      const baseName = (sourceName ?? "choice-video").replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${baseName}-choice.${extension}`);
      setStatus(`Fertig: Video als ${extension.toUpperCase()} heruntergeladen.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Der Export ist fehlgeschlagen. Bitte versuche es erneut.");
      setProgress(0);
    } finally {
      window.cancelAnimationFrame(animationFrame);
      window.clearInterval(progressTimer);
      recordingStream?.getTracks().forEach((track) => track.stop());
      await audioContext?.close().catch(() => undefined);
      setIsExporting(false);
    }
  }

  return (
    <section id="video-branding" className={styles.videoBrandSection}>
      <div className={styles.reelHeader}>
        <div>
          <p className={styles.eyebrow}>Video-Branding</p>
          <h2>Dein Video. Sofort im Choice-Look.</h2>
          <p>
            Lade einen fertigen Clip hoch. Choice sitzt automatisch oben links in der sicheren Reel-Zone und wird beim Export fest eingebrannt.
          </p>
        </div>
        <span className={styles.reelBadge}>Lokal verarbeitet</span>
      </div>

      <div className={styles.videoBrandWorkspace}>
        <div className={styles.videoBrandPreviewPanel}>
          <div className={styles.previewMeta}>
            <div>
              <span>Vorschau</span>
              <strong>{sourceName ?? "Noch kein Video ausgewählt"}</strong>
            </div>
            <span className={styles.resolution}>
              {details ? `${details.width} × ${details.height}` : "9:16 empfohlen"}
            </span>
          </div>

          <div className={styles.videoBrandStage}>
            {sourceUrl ? (
              <video
                ref={previewRef}
                className={styles.videoBrandVideo}
                src={sourceUrl}
                controls
                playsInline
                onLoadedMetadata={readVideoDetails}
              />
            ) : (
              <div className={styles.videoBrandEmpty}>
                <span>CHOICE</span>
                <strong>Video auswählen</strong>
                <p>MP4, MOV oder ein anderes browserfähiges Video.</p>
              </div>
            )}
            {sourceUrl ? <span className={styles.videoBrandOverlay}>CHOICE</span> : null}
          </div>
        </div>

        <div className={styles.videoBrandControls}>
          <p className={styles.controlEyebrow}>Feste Position</p>
          <h2>Oben links, klar und dezent.</h2>
          <p className={styles.videoBrandDescription}>
            Die Wortmarke bleibt bei jedem Clip gleich groß und sitzt mit genügend Abstand zu den Instagram-Bedienelementen. Ton und Bild des Originals bleiben erhalten.
          </p>

          <div className={styles.videoBrandMarkPreview}>
            <span>CHOICE</span>
            <div>
              <strong>Choice-Blau</strong>
              <small>#8EDDF4 · leichter Schatten für Lesbarkeit</small>
            </div>
          </div>

          <label className={styles.videoUploadButton}>
            <input type="file" accept="video/*,.mov,.mp4,.m4v" onChange={selectVideo} disabled={isExporting} />
            {sourceUrl ? "Anderes Video wählen" : "Video auswählen"}
          </label>

          <button
            type="button"
            className={styles.videoExportButton}
            onClick={() => void exportBrandedVideo()}
            disabled={!sourceUrl || isExporting}
          >
            {isExporting ? `Export läuft · ${Math.round(progress)} %` : "Video mit Choice herunterladen"}
          </button>

          {isExporting ? (
            <div className={styles.videoExportProgress} aria-label={`Export zu ${Math.round(progress)} Prozent abgeschlossen`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          <p className={styles.exportHint}>
            Der Export läuft einmal in Echtzeit: Ein 10-Sekunden-Clip dauert ungefähr 10 Sekunden. Währenddessen den Tab geöffnet lassen.
          </p>
          {status ? <p className={styles.exportStatus}>{status}</p> : null}
        </div>
      </div>
    </section>
  );
}
