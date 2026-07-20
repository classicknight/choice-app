import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Path,
  Rect,
} from "react-native-svg";
import {
  applyRemoteSystemPenalty,
  blockRemoteJourneyPartner,
  bootstrapDevSession,
  createRemoteReport,
  createRemoteProfile,
  deleteRemoteAccount,
  fetchRemoteAccountState,
  fetchRemoteJourney,
  fetchRemoteProfile,
  registerRemotePushToken,
  setApiAccessToken,
  type RemoteJourneyPartnerProfile,
  type RemoteJourneyState,
  sendRemoteJourneyMessage,
  setRemotePhaseOneDecision,
  setRemotePhaseThreeDecision,
  startPhoneVerification,
  startRemotePhaseTwo,
  submitRemotePhaseTwoAnswer,
  uploadProfilePhotos,
  uploadProfileVideo,
  verifyPhoneVerification,
} from "../lib/api";
import {
  demoProfiles,
  type DemoProfile,
} from "../lib/mock-data";
import {
  getMatchPackStoreProduct,
  hasRevenueCatConfig,
  purchaseMatchPackProduct,
  syncRevenueCatUser,
  logOutRevenueCat,
} from "../lib/purchases";
import {
  buildSummary,
  calculateAgeFromProfile,
  dealbreakerOptions,
  datingIntentOptions,
  greenFlagOptions,
  identityOptions,
  initialRegistrationProfile,
  interestOptions,
  lookingForOptions,
  pronounOptions,
  selfDescriptionOptions,
  type RegistrationProfile,
} from "../lib/registration";
import {
  clearTransientState,
  clearPersistedSession,
  loadPersistedSession,
  loadRememberedSessions,
  loadTransientState,
  removeRememberedSession,
  saveTransientState,
  savePersistedSession,
  type PersistedSession,
} from "../lib/session";
import {
  clearJourneyLocalNotifications,
  getExpoPushToken,
  cancelScheduledLocalNotification,
  scheduleMatchReleaseNotification,
  syncJourneyLocalNotifications,
  type JourneyLocalNotificationPlan,
} from "../lib/notifications";

type SelectOption = {
  value: string;
  label: string;
};

type PhaseTwoResponseOption = {
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
};

type PhaseTwoAnswerBranch = {
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
  followUpPrompt: string;
  followUpOptions: PhaseTwoResponseOption[];
};

type PhaseTwoRoundConfig = {
  id: string;
  prompt: string;
  answerOptions: PhaseTwoAnswerBranch[];
};

type PhaseTwoRoundResult = {
  roundId: string;
  prompt: string;
  personALabel: string;
  personAScore: number;
  followUpPrompt: string;
  followUpOptions: PhaseTwoResponseOption[];
  personBLabel: string;
  personBScore: number;
  compatibility: number;
};

type RemoteAccountState = Awaited<ReturnType<typeof fetchRemoteAccountState>>;

type RememberedSessionMatchState = {
  hasMatch: boolean;
  badgeLabel: string | null;
  detailLabel: string | null;
  partnerName: string | null;
  sortTime: number;
};

const PHASE_THREE_THRESHOLD = 50;
const PHASE_TWO_ROUNDS_PER_SESSION = 3;
const PHASE_WARNING_LEAD_MS = 60 * 60 * 1000;
const MATCH_RELEASE_HOUR = 9;
const MATCH_DECISION_HOUR = 21;
const LEGAL_URLS = {
  impressum: "https://choice-dating.app/impressum",
  datenschutz: "https://choice-dating.app/datenschutz",
  rechtliches: "https://choice-dating.app/rechtliches",
  agb: "https://choice-dating.app/agb",
  supportModeration: "mailto:kontakt@autovisa.de?subject=Choice%20Moderationspr%C3%BCfung",
} as const;
const authRequestErrors = new Set(["AUTH_REQUIRED", "AUTH_INVALID", "AUTH_FORBIDDEN"]);

async function openExternalUrl(url: string) {
  await Linking.openURL(url);
}

type GermanCityRecord = {
  city: string;
  state: string;
  postalCodes: string[];
};

type GermanCityOption = GermanCityRecord & {
  cityKey: string;
  searchKey: string;
};

type IntroScreen = {
  id: "intro";
  kind: "intro";
  title: string;
  subtitle: string;
};

type PhoneScreen = {
  id: "phone";
  kind: "phone";
  title: string;
  hint?: string;
  placeholder: string;
};

type OtpScreen = {
  id: "otp";
  kind: "otp";
  title: string;
  hint?: string;
  placeholder: string;
};

type TextScreen = {
  id: keyof RegistrationProfile;
  kind: "text" | "textarea";
  title: string;
  hint?: string;
  placeholder: string;
  keyboardType?: "default" | "number-pad";
};

type AgeRangeScreen = {
  id: "ageRange";
  kind: "ageRange";
  title: string;
  hint?: string;
};

type BirthdayScreen = {
  id: "birthday";
  kind: "birthday";
  title: string;
  hint?: string;
};

type SingleScreen = {
  id: keyof RegistrationProfile;
  kind: "single";
  title: string;
  hint?: string;
  options: readonly SelectOption[];
};

type MultiScreen = {
  id: "interests";
  kind: "multi";
  title: string;
  hint?: string;
  options: readonly SelectOption[];
};

type PreferenceScreen = {
  id: "preferences";
  kind: "preferences";
  title: string;
  hint?: string;
  greenFlagOptions: readonly SelectOption[];
  dealbreakerOptions: readonly SelectOption[];
};

type PhotosScreen = {
  id: "photos";
  kind: "photos";
  title: string;
  hint?: string;
};

type DoneScreen = {
  id: "done";
  kind: "done";
  title: string;
};

type Screen =
  | IntroScreen
  | PhoneScreen
  | OtpScreen
  | TextScreen
  | AgeRangeScreen
  | BirthdayScreen
  | SingleScreen
  | MultiScreen
  | PreferenceScreen
  | PhotosScreen
  | DoneScreen;

type EditableProfileScreenId = Exclude<Screen["id"], "intro" | "phone" | "otp" | "done">;

type EntryMode = "signup" | "signin";
type AppSurface = "onboarding" | "overview";
type OverviewTabId = "today" | "match" | "chats" | "activity" | "profile";

type PersistedJourneyState = {
  ownerUserId: string;
  releaseAt: string;
  sharedChatMessages: SharedChatMessage[];
  lastSeenPartnerMessageId: string | null;
  seenMatchReleaseAt: string | null;
  scheduledMatchNotificationId: string | null;
  scheduledMatchNotificationReleaseAt: string | null;
  phaseOneStarterPenaltyAppliedAt: string | null;
  phaseTwoPenaltyAppliedAt: string | null;
  phaseOneDecisions: Record<string, "continue" | "new-match">;
  phaseThreeDecisions: Record<string, "stay" | "new-match">;
  phaseTwoOpen: boolean;
  phaseTwoRounds: PhaseTwoRoundConfig[];
  phaseTwoRoundIndex: number;
  phaseTwoStage: "starter" | "partner" | "result";
  phaseTwoResults: PhaseTwoRoundResult[];
  phaseTwoStarterUserId: string | null;
  phaseTwoPartnerUserId: string | null;
  phaseTwoStarterName: string;
  phaseTwoPartnerName: string;
};

const optionify = (items: readonly string[]): SelectOption[] => items.map((item) => ({ value: item, label: item }));
const choiceLogo = require("../assets/logo-untertitel-hero.png");
const choiceWordmark = require("../assets/choice-wordmark.png");
const introHighlights = ["Ohne Swipes", "Unter 2 Minuten", "1 Match pro Tag"] as const;
const phonePrefix = "+49";
const minimumPhotoCount = 2;
const maximumPhotoCount = 8;
const overviewTabs: { id: OverviewTabId; label: string }[] = [
  { id: "today", label: "Home" },
  { id: "match", label: "Match" },
  { id: "chats", label: "Chat" },
  { id: "activity", label: "Status" },
  { id: "profile", label: "Profil" },
];
const reportReasonOptions: readonly SelectOption[] = [
  { value: "unangemessenes-verhalten", label: "Unangemessenes Verhalten" },
  { value: "respektloser-chat", label: "Respektlose oder sexualisierte Nachrichten" },
  { value: "choice-regel-ignoriert", label: "Choice-Regel wurde ignoriert" },
];

function getOptionLabel(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}

function isAuthRequestError(value: unknown) {
  const message = value instanceof Error ? value.message : "";
  return authRequestErrors.has(message);
}

const cityCoordinates: Record<string, { lat: number; lon: number }> = {
  berlin: { lat: 52.52, lon: 13.405 },
  koln: { lat: 50.9375, lon: 6.9603 },
  hamburg: { lat: 53.5511, lon: 9.9937 },
  munchen: { lat: 48.1351, lon: 11.582 },
  leipzig: { lat: 51.3397, lon: 12.3731 },
  frankfurt: { lat: 50.1109, lon: 8.6821 },
  dusseldorf: { lat: 51.2277, lon: 6.7735 },
};

function extractCityKey(value: string) {
  const cityOnly = value.split(",")[0]?.trim() ?? value.trim();
  return normalizeLookup(cityOnly);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function estimateDistanceKm(fromCity: string, toCity: string) {
  const from = cityCoordinates[extractCityKey(fromCity)];
  const to = cityCoordinates[extractCityKey(toCity)];

  if (!from || !to) {
    return null;
  }

  if (extractCityKey(fromCity) === extractCityKey(toCity)) {
    return 7;
  }

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const startLat = toRadians(from.lat);
  const endLat = toRadians(to.lat);
  const a =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;
  const distance = 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(distance);
}

function formatDistanceLabel(distanceKm: number | null) {
  if (distanceKm == null) {
    return "";
  }

  if (distanceKm <= 1) {
    return "1 km entfernt";
  }

  return `${distanceKm} km entfernt`;
}

type ChoiceMatchReason = {
  label: string;
  text: string;
};

function joinNaturalList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} und ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
}

function getSelfDescriptionReason(value: string) {
  switch (value) {
    case "direct":
      return "Ihr mögt beide eher klare Worte statt Spielchen.";
    case "warm":
      return "Ihr seid beide offen und schnell im Gespräch.";
    case "calm":
      return "Ihr geht beide eher ruhig ins Kennenlernen.";
    case "deep":
      return "Ihr mögt beide mehr Tiefe als oberflächlichen Small Talk.";
    case "playful":
      return "Ihr seid beide eher spontan, locker und leicht im Umgang.";
    case "slow-burn":
      return "Ihr braucht beide eher kurz, bis es sich wirklich öffnet.";
    default:
      return "";
  }
}

function getDatingIntentReason(value: string) {
  switch (value) {
    case "relationship":
      return "Ihr sucht beide eher etwas Ernstes.";
    case "intentional-dating":
      return "Ihr seid beide offen, aber nicht beliebig unterwegs.";
    case "open-minded":
      return "Ihr geht beide eher leicht und ohne großen Druck rein.";
    default:
      return "";
  }
}

function getChoiceMatchReasons(params: {
  viewerCity: string;
  partnerCity: string;
  distanceLabel: string;
  sharedInterests: string[];
  viewerSelfDescription: string;
  partnerSelfDescription: string;
  viewerDatingIntent: string;
  partnerDatingIntent: string;
  viewerAgeRangeMin: number;
  viewerAgeRangeMax: number;
  partnerAgeRangeMin: number;
  partnerAgeRangeMax: number;
  viewerAge: number | null;
  partnerAge: number;
}) {
  const reasons: ChoiceMatchReason[] = [];

  if (params.sharedInterests.length >= 2) {
    reasons.push({
      label: "Gemeinsame Interessen",
      text: `Ihr teilt mit ${joinNaturalList(params.sharedInterests.slice(0, 3))} direkt mehrere gemeinsame Anknüpfungspunkte.`,
    });
  } else if (params.sharedInterests.length === 1) {
    reasons.push({
      label: "Gemeinsamer Punkt",
      text: `Ihr habt mit ${params.sharedInterests[0]} direkt etwas, worüber ihr beide wirklich gern sprecht.`,
    });
  }

  if (params.viewerDatingIntent && params.viewerDatingIntent === params.partnerDatingIntent) {
    const intentReason = getDatingIntentReason(params.viewerDatingIntent);

    if (intentReason) {
      reasons.push({
        label: "Ähnliche Intention",
        text: intentReason,
      });
    }
  }

  if (
    params.viewerAgeRangeMin > 0
    && params.viewerAgeRangeMax > 0
    && params.partnerAgeRangeMin > 0
    && params.partnerAgeRangeMax > 0
    && params.partnerAge >= params.viewerAgeRangeMin
    && params.partnerAge <= params.viewerAgeRangeMax
    && params.viewerAge !== null
    && params.viewerAge >= params.partnerAgeRangeMin
    && params.viewerAge <= params.partnerAgeRangeMax
  ) {
    reasons.push({
      label: "Wunschalter passt",
      text: "Ihr liegt beide im Wunschalter des anderen, ohne dass Choice hier verbiegen musste.",
    });
  }

  if (extractCityKey(params.viewerCity) === extractCityKey(params.partnerCity)) {
    reasons.push({
      label: "Gleiche Stadt",
      text: `Ihr lebt beide in ${params.partnerCity}. Das macht spontane echte Treffen deutlich leichter.`,
    });
  } else if (params.distanceLabel) {
    reasons.push({
      label: "Gute Nähe",
      text: `Mit ${params.distanceLabel} seid ihr nah genug, dass aus Schreiben schnell ein echtes Treffen werden kann.`,
    });
  }

  if (
    params.viewerSelfDescription
    && params.viewerSelfDescription === params.partnerSelfDescription
  ) {
    const selfDescriptionReason = getSelfDescriptionReason(params.viewerSelfDescription);

    if (selfDescriptionReason) {
      reasons.push({
        label: "Ähnliche Art",
        text: selfDescriptionReason,
      });
    }
  }

  return reasons.slice(0, 4);
}

function formatCityFieldValue(entry: GermanCityRecord) {
  return normalizeLookup(entry.city) === normalizeLookup(entry.state) ? entry.city : `${entry.city}, ${entry.state}`;
}

const germanCities = (require("../data/german-cities.json") as GermanCityRecord[]).map((entry) => ({
  ...entry,
  cityKey: normalizeLookup(entry.city),
  searchKey: normalizeLookup(`${entry.city} ${entry.state} ${entry.postalCodes.join(" ")}`),
}));

function getDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getLocalPhonePart(value: string) {
  const digits = getDigits(value);
  return digits.startsWith("49") ? digits.slice(2) : digits;
}

function formatPhoneForStorage(localPart: string) {
  const digits = getDigits(localPart);
  return digits.length ? `${phonePrefix} ${digits}` : phonePrefix;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function setTimeOfDay(date: Date, hour: number, minute: number) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function buildPhaseSchedule(now: Date) {
  const release = new Date(now);
  release.setHours(MATCH_RELEASE_HOUR, 0, 0, 0);
  const decisionDeadline = new Date(now);
  decisionDeadline.setHours(MATCH_DECISION_HOUR, 0, 0, 0);
  const phaseTwoStart = addDaysAtSameTime(release, 1);
  const phaseThreeStart = addDaysAtSameTime(release, 2);
  const phaseFourStart = addDaysAtSameTime(release, 3);
  const phaseFiveStart = new Date(phaseFourStart);
  phaseFiveStart.setHours(MATCH_DECISION_HOUR, 0, 0, 0);

  return {
    release,
    decisionDeadline,
    phaseTwoStart,
    phaseThreeStart,
    phaseFourStart,
    phaseFiveStart,
  };
}

function resolveJourneyPhaseSchedule(journey: RemoteJourneyState | null, fallbackDate: Date) {
  const fallbackBase = journey?.releaseAt ? new Date(journey.releaseAt) : fallbackDate;
  const fallback = buildPhaseSchedule(fallbackBase);

  return {
    release: journey?.releaseAt ? new Date(journey.releaseAt) : fallback.release,
    decisionDeadline: journey?.decisionDeadlineAt ? new Date(journey.decisionDeadlineAt) : fallback.decisionDeadline,
    phaseTwoStart: journey?.phaseTwoStartAt ? new Date(journey.phaseTwoStartAt) : fallback.phaseTwoStart,
    phaseThreeStart: journey?.phaseThreeStartAt ? new Date(journey.phaseThreeStartAt) : fallback.phaseThreeStart,
    phaseFourStart: journey?.phaseFourStartAt ? new Date(journey.phaseFourStartAt) : fallback.phaseFourStart,
    phaseFiveStart: journey?.phaseFiveStartAt ? new Date(journey.phaseFiveStartAt) : fallback.phaseFiveStart,
  };
}

function getDecisionDeadline(now: Date) {
  return buildPhaseSchedule(now).decisionDeadline;
}

function getMatchReleaseTime(now: Date) {
  return buildPhaseSchedule(now).release;
}

function getPhaseTwoStartTime(now: Date) {
  return buildPhaseSchedule(now).phaseTwoStart;
}

function addDaysAtSameTime(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function createInitialReleaseAt(now: Date) {
  const release = getMatchReleaseTime(now);

  if (now >= release) {
    release.setDate(release.getDate() + 1);
  }

  return release;
}

function formatClockTime(value: Date) {
  return value.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeDateTimeLabel(target: Date, now: Date) {
  const clockLabel = formatClockTime(target);

  if (target.toDateString() === now.toDateString()) {
    return `heute um ${clockLabel}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (target.toDateString() === tomorrow.toDateString()) {
    return `morgen um ${clockLabel}`;
  }

  return `am ${formatDateTime(target.toISOString())}`;
}

type TimelinePhaseState = "upcoming" | "active" | "done";

type TimelinePhaseStatus = {
  state: TimelinePhaseState;
  label: string;
};

function buildTimelinePhaseStatus(input: {
  now: Date;
  start: Date;
  end?: Date | null;
  upcomingPrefix?: string;
  activePrefix?: string;
  doneLabel?: string;
  activeUntilLabel?: string;
  activeWithoutEndLabel?: string;
}) {
  const {
    now,
    start,
    end,
    upcomingPrefix = "Startet in",
    activePrefix = "Läuft noch",
    doneLabel = "Vorbei",
    activeUntilLabel,
    activeWithoutEndLabel = "Jetzt offen",
  } = input;

  if (now < start) {
    return {
      state: "upcoming",
      label: `${upcomingPrefix} ${formatDurationLabel(start.getTime() - now.getTime())} • ${formatRelativeDateTimeLabel(start, now)}`,
    } satisfies TimelinePhaseStatus;
  }

  if (!end) {
    return {
      state: "active",
      label: activeWithoutEndLabel,
    } satisfies TimelinePhaseStatus;
  }

  if (now < end) {
    return {
      state: "active",
      label: `${activePrefix} ${formatDurationLabel(end.getTime() - now.getTime())} • ${activeUntilLabel ?? `bis ${formatRelativeDateTimeLabel(end, now)}`}`,
    } satisfies TimelinePhaseStatus;
  }

  return {
    state: "done",
    label: doneLabel,
  } satisfies TimelinePhaseStatus;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildPenaltyEntryGroupKey(entry: {
  source: "system" | "report";
  reasonCode: string;
  reasonLabel: string;
}) {
  if (entry.source === "system") {
    return `system:${entry.reasonCode.trim()}`;
  }

  return `report:${entry.reasonLabel.trim().toLocaleLowerCase("de-DE")}`;
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPenaltyCountdownLabel(milliseconds: number) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const totalSeconds = Math.floor(safeMilliseconds / 1000);
  const totalDays = Math.floor(totalSeconds / (24 * 60 * 60));
  const remainingMs = safeMilliseconds - totalDays * 24 * 60 * 60 * 1000;
  const clockLabel = formatDurationLabel(remainingMs);

  if (totalDays <= 0) {
    return clockLabel;
  }

  return `${totalDays} Tag${totalDays === 1 ? "" : "e"} ${clockLabel}`;
}

function getJourneyPhaseLabel(journey: RemoteJourneyState, now = new Date()) {
  const releaseAt = journey.releaseAt ? new Date(journey.releaseAt) : null;
  const phaseTwoStartAt = journey.phaseTwoStartAt ? new Date(journey.phaseTwoStartAt) : null;
  const phaseThreeStartAt = journey.phaseThreeStartAt ? new Date(journey.phaseThreeStartAt) : null;
  const phaseFourStartAt = journey.phaseFourStartAt ? new Date(journey.phaseFourStartAt) : null;
  const phaseFiveStartAt = journey.phaseFiveStartAt ? new Date(journey.phaseFiveStartAt) : null;

  if (releaseAt && now < releaseAt) {
    return `Match um ${formatClockTime(releaseAt)}`;
  }

  if (phaseFiveStartAt && now >= phaseFiveStartAt) {
    return "Phase 5 offen";
  }

  if (phaseFourStartAt && now >= phaseFourStartAt) {
    return "Phase 4 aktiv";
  }

  if (phaseThreeStartAt && now >= phaseThreeStartAt) {
    return "Phase 3 aktiv";
  }

  if (phaseTwoStartAt && now >= phaseTwoStartAt) {
    return "Phase 2 aktiv";
  }

  return "Phase 1 aktiv";
}

function summarizeRememberedSessionMatch(journey: RemoteJourneyState, now = new Date()): RememberedSessionMatchState {
  const partnerName = journey.partner?.firstName?.trim() || null;
  const statusSupportsMatch = journey.status === "PENDING" || journey.status === "ACTIVE" || journey.status === "KEPT";
  const hasMatch = Boolean(journey.matchId && journey.partner && statusSupportsMatch);
  const releaseAt = journey.releaseAt ? new Date(journey.releaseAt) : null;
  const phaseLabel = hasMatch ? getJourneyPhaseLabel(journey, now) : null;

  return {
    hasMatch,
    badgeLabel: hasMatch ? (releaseAt && now < releaseAt ? "Match geplant" : "Match live") : null,
    detailLabel: hasMatch ? [partnerName ? `Mit ${partnerName}` : null, phaseLabel].filter(Boolean).join(" • ") : null,
    partnerName,
    sortTime: releaseAt ? releaseAt.getTime() : Number.MAX_SAFE_INTEGER,
  };
}

function formatDurationLabel(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatVideoDurationLabel(milliseconds: number | null) {
  if (!milliseconds || milliseconds <= 0) {
    return "Max. 30 Sek.";
  }

  const totalSeconds = Math.max(1, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getCompatibilityPoints(scoreA: number, scoreB: number) {
  const difference = Math.abs(scoreA - scoreB);

  if (difference === 0) {
    return 100;
  }

  if (difference === 1) {
    return 75;
  }

  if (difference === 2) {
    return 50;
  }

  if (difference === 3) {
    return 25;
  }

  return 0;
}

function getPhaseTwoTopicLabel(roundId: string) {
  switch (roundId) {
    case "flirting":
      return "Flirten in Beziehungen";
    case "conflict":
      return "Streit und Verletzung";
    case "cancellation":
      return "Späte Absage";
    case "ex-contact":
      return "Kontakt zur Ex-Person";
    case "party-alone":
      return "Allein feiern gehen";
    case "phone-privacy":
      return "Handy und Privatsphäre";
    case "physical-pace":
      return "Tempo bei Nähe";
    case "social-media":
      return "Nachrichten von außen";
    case "apology":
      return "Entschuldigung";
    case "family-intro":
      return "Umfeld kennenlernen";
    case "move-away":
      return "Distanz und Umzug";
    case "alone-time":
      return "Freiraum";
    case "money-date":
      return "Bezahlen beim Date";
    case "stress":
      return "Verhalten unter Stress";
    case "exclusive":
      return "Exklusivität";
    case "doubt":
      return "Umgang mit Zweifel";
    case "friends-opinion":
      return "Einfluss vom Umfeld";
    case "holiday":
      return "Gemeinsame Reise";
    case "late-replies":
      return "Lange Antwortzeiten";
    case "public-relationship":
      return "Beziehung öffentlich machen";
    default:
      return "Diese Runde";
  }
}

function buildProfileFromDemoProfile(entry: DemoProfile): RegistrationProfile {
  const currentYear = new Date().getFullYear();

  return {
    firstName: entry.firstName,
    birthDay: "01",
    birthMonth: "01",
    birthYear: String(currentYear - entry.age),
    city: entry.city,
    selfDescription: entry.selfDescription,
    pronouns: entry.pronouns,
    identity: entry.identity,
    lookingFor: entry.lookingFor,
    datingIntent: entry.datingIntent,
    ageRangeMin: String(entry.ageRangeMin),
    ageRangeMax: String(entry.ageRangeMax),
    interests: [...entry.interests],
    greenFlags: [...entry.greenFlags],
    dealbreakers: [...entry.dealbreakers],
    matchTime: "09:00",
    conversationStyle: "direct",
    consent: true,
  };
}

function classifyLocalProfileTarget(profile: { lookingFor: string; pronouns: string }) {
  if (profile.lookingFor === "Alle") {
    return "Alle";
  }

  if (profile.pronouns === "sie/ihr") {
    return "Frauen";
  }

  if (profile.pronouns === "er/ihm") {
    return "Männer";
  }

  return "Alle";
}

function isLocallyCompatible(
  viewer: {
    lookingFor: string;
    pronouns: string;
    age: number;
    ageRangeMin: number;
    ageRangeMax: number;
  },
  candidate: DemoProfile,
) {
  const viewerTarget = classifyLocalProfileTarget(candidate);
  const candidateTarget = classifyLocalProfileTarget(viewer);

  const viewerAccepts = viewer.lookingFor === "Alle" || viewer.lookingFor === viewerTarget;
  const candidateAccepts = candidate.lookingFor === "Alle" || candidate.lookingFor === candidateTarget;
  const viewerAgeOk = candidate.age >= viewer.ageRangeMin && candidate.age <= viewer.ageRangeMax;
  const candidateAgeOk = viewer.age >= candidate.ageRangeMin && viewer.age <= candidate.ageRangeMax;

  return viewerAccepts && candidateAccepts && viewerAgeOk && candidateAgeOk;
}

function calculateLocalCandidateScore(
  viewer: {
    city: string;
    interests: string[];
    lookingFor: string;
    datingIntent: string;
  },
  candidate: DemoProfile,
) {
  const sharedInterests = viewer.interests.filter((interest) => candidate.interests.includes(interest));
  const sameCity = viewer.city.trim().toLocaleLowerCase("de-DE") === candidate.city.trim().toLocaleLowerCase("de-DE");
  const sameIntent = viewer.datingIntent === candidate.datingIntent;
  const sameLookingFor = viewer.lookingFor === candidate.lookingFor;

  return (
    sharedInterests.length * 18
    + (sameCity ? 12 : 0)
    + (sameIntent ? 10 : 0)
    + (sameLookingFor ? 6 : 0)
  );
}

function getPhaseTwoDifferenceLabel(compatibility: number) {
  if (compatibility >= 100) {
    return "fast dieselbe Haltung";
  }

  if (compatibility >= 75) {
    return "eine sehr ähnliche Haltung";
  }

  if (compatibility >= 50) {
    return "eine teilweise ähnliche, aber spürbar andere Haltung";
  }

  if (compatibility >= 25) {
    return "eine klare Reibung";
  }

  return "einen harten Gegensatz";
}

function getPhaseTwoRoundComment(entry: PhaseTwoRoundResult) {
  const topic = getPhaseTwoTopicLabel(entry.roundId);

  if (entry.compatibility >= 100) {
    return `Choice sieht beim Thema ${topic.toLocaleLowerCase("de-DE")} beinahe dieselbe Haltung bei euch beiden. Genau solche Stellen fühlen sich oft ungewöhnlich leicht an.`;
  }

  if (entry.compatibility >= 75) {
    return `Choice sieht beim Thema ${topic.toLocaleLowerCase("de-DE")} viel Nähe. Ihr setzt nicht exakt dieselbe Grenze, denkt aber deutlich in dieselbe Richtung.`;
  }

  if (entry.compatibility >= 50) {
    return `Choice sieht beim Thema ${topic.toLocaleLowerCase("de-DE")} eine erkennbare Basis, aber auch einen echten Unterschied in der Gewichtung.`;
  }

  if (entry.compatibility >= 25) {
    return `Choice sieht beim Thema ${topic.toLocaleLowerCase("de-DE")} eine deutliche Reibung. Ihr würdet damit wahrscheinlich spürbar anders umgehen.`;
  }

  return `Choice sieht beim Thema ${topic.toLocaleLowerCase("de-DE")} fast entgegengesetzte Haltungen. Genau daran scheitert Nähe oft früh.`;
}

function getPhaseTwoOverallComment(entries: PhaseTwoRoundResult[], compatibility: number, unlocked: boolean) {
  const completedEntries = entries.filter((entry) => entry.personBLabel);
  const weakestEntry = [...completedEntries].sort((left, right) => left.compatibility - right.compatibility)[0];

  if (!weakestEntry) {
    return unlocked
      ? "Choice sieht genug gemeinsame Basis für Phase 3."
      : "Choice sieht noch nicht genug gemeinsame Basis für Phase 3.";
  }

  const weakestTopic = getPhaseTwoTopicLabel(weakestEntry.roundId).toLocaleLowerCase("de-DE");

  if (unlocked && compatibility >= 95) {
    return `Choice sieht hier etwas Seltenes. Eure Antworten lagen fast durchgehend erstaunlich nah beieinander. Das wirkt nicht nur tragfähig, sondern außergewöhnlich stimmig.`;
  }

  if (unlocked && compatibility >= 90) {
    return `Choice sieht bei euch auffallend viel Nähe. Selbst dort, wo leichte Unterschiede da waren, wart ihr emotional und inhaltlich sehr nah beieinander. Das fühlt sich deutlich mehr als nur solide an.`;
  }

  if (unlocked && compatibility >= 75) {
    return `Choice bewertet eure Runde als stark. Die größte Reibung lag beim Thema ${weakestTopic}, aber insgesamt seid ihr klar nah genug für Phase 3.`;
  }

  if (unlocked) {
    return `Choice bewertet eure Runde als tragfähig. Die größte Reibung lag beim Thema ${weakestTopic}, aber insgesamt reicht eure Nähe für Phase 3.`;
  }

  return `Choice bewertet eure Runde als zu weit auseinander. Gescheitert ist es vor allem am Thema ${weakestTopic}, dort lagen eure Haltungen am weitesten auseinander.`;
}

function getPhaseTwoResultHeadline(compatibility: number, unlocked: boolean) {
  if (unlocked && compatibility >= 95) {
    return "Choice sieht hier etwas Besonderes.";
  }

  if (unlocked && compatibility >= 90) {
    return "Das fühlt sich außergewöhnlich stimmig an.";
  }

  if (unlocked && compatibility >= 75) {
    return "Da ist spürbar echte Nähe.";
  }

  if (unlocked) {
    return "Das hat genug Substanz für Phase 3.";
  }

  if (compatibility >= 40) {
    return "Da ist etwas da, aber es reicht noch nicht.";
  }

  return "Choice sieht euch gerade zu weit auseinander.";
}

function getPhaseTwoResultSupportText(compatibility: number, unlocked: boolean) {
  if (unlocked && compatibility >= 95) {
    return "Über 90% passiert hier nicht zufällig. Eure Antworten lagen fast überall ungewöhnlich nah beieinander und wirken wie echte Passung, nicht nur wie ein guter Moment.";
  }

  if (unlocked && compatibility >= 90) {
    return "Choice sieht hier deutlich mehr als ein okayes Match. Eure Antworten hatten über mehrere Themen hinweg eine seltene Ruhe und Nähe.";
  }

  if (unlocked && compatibility >= 75) {
    return "Choice vergleicht pro Runde eure Antwortscores und sieht klar genug gemeinsame Richtung, damit ihr mit Phase 3 weitermachen könnt.";
  }

  if (unlocked) {
    return "Choice vergleicht pro Runde eure Antwortscores und sieht genug gemeinsame Basis, damit ihr in Phase 3 weitergehen könnt.";
  }

  return "Für Phase 3 braucht ihr mehr als 50%. Mit diesem Ergebnis endet es nach Phase 2.";
}

function buildPhaseTwoRounds(selfName: string, partnerName: string): PhaseTwoRoundConfig[] {
  const createResponseOptions = (
    labels: [string, string, string, string, string],
  ): PhaseTwoResponseOption[] =>
    labels.map((label, index) => ({
      label,
      score: (index + 1) as 1 | 2 | 3 | 4 | 5,
    }));

  const createAnswerBranches = (
    labels: [string, string, string, string, string],
    followUpPrompts: [string, string, string, string, string],
    followUpOptions: PhaseTwoResponseOption[],
  ): PhaseTwoAnswerBranch[] =>
    labels.map((label, index) => ({
      label,
      score: (index + 1) as 1 | 2 | 3 | 4 | 5,
      followUpPrompt: followUpPrompts[index],
      followUpOptions,
    }));

  const questionBank: PhaseTwoRoundConfig[] = [
    {
      id: "flirting",
      prompt: `${selfName}, du bist in einer Beziehung und jemand flirtet offen mit dir. Wie reagierst du?`,
      answerOptions: createAnswerBranches(
        [
          "Ich ignoriere es komplett.",
          "Ich bleibe höflich, aber klar distanziert.",
          "Etwas harmlose Aufmerksamkeit finde ich okay.",
          "Ich flirte leicht zurück, solange es harmlos bleibt.",
          "Es kommt für mich ganz auf die Situation an.",
        ],
        [
          "Wie wichtig ist dir eine sehr klare Grenze bei Flirts von außen?",
          "Würde dir höfliche Distanz in so einer Situation Sicherheit geben?",
          "Wie gut kannst du mit harmloser Aufmerksamkeit von außen umgehen?",
          "Wo wäre für dich beim Flirten die Grenze?",
          "Kannst du mit Grauzonen beim Flirten in Beziehungen gut umgehen?",
        ],
        createResponseOptions([
          "Schon bewusstes Flirten wäre für mich zu viel.",
          "Kurzer Smalltalk ist okay, aber mehr nicht.",
          "Mit klaren Grenzen könnte ich damit umgehen.",
          "Leichtes Flirten finde ich nicht schlimm.",
          "Ich sehe Flirten grundsätzlich sehr entspannt.",
        ]),
      ),
    },
    {
      id: "conflict",
      prompt: `${selfName}, nach einem Streit merkst du, dass dich etwas wirklich verletzt hat. Wie gehst du am ehesten damit um?`,
      answerOptions: createAnswerBranches(
        [
          "Ich spreche es ruhig an, bevor es größer wird.",
          "Ich brauche kurz Abstand und suche dann das Gespräch.",
          "Ich schaue erst, ob es sich von selbst legt.",
          "Ich ziehe mich erst einmal zurück.",
          "Ich spreche es direkt und ohne Umweg an.",
        ],
        [
          "Wie wichtig ist dir, dass Verletzungen früh und ruhig angesprochen werden?",
          "Wie passend fühlt sich eine kurze Pause vor dem Gespräch für dich an?",
          "Kannst du nachvollziehen, Dinge erst einmal etwas sacken zu lassen?",
          "Wie gut könntest du mit Rückzug nach einem Streit umgehen?",
          "Wie gut passt sehr direkte Konfrontation für dich?",
        ],
        createResponseOptions([
          "Ich würde Verletzungen auch früh und ruhig ansprechen.",
          "Kurz Abstand und dann reden fühlt sich für mich richtig an.",
          "Ich lasse manches lieber erst einmal etwas sacken.",
          "Ich ziehe mich in so einem Moment eher zurück.",
          "Ich spreche Probleme lieber sofort und direkt an.",
        ]),
      ),
    },
    {
      id: "cancellation",
      prompt: `${selfName}, ihr habt ein Date geplant und ${partnerName} sagt zwei Stunden vorher ab. Was macht das am ehesten mit dir?`,
      answerOptions: createAnswerBranches(
        [
          "Wenn es ehrlich kommuniziert ist, bleibe ich entspannt.",
          "Ich bin kurz enttäuscht, bleibe aber offen.",
          "Es kommt für mich stark auf den Grund an.",
          "Ich verliere dann ziemlich schnell Interesse.",
          "Danach bin ich eher raus.",
        ],
        [
          "Wie wichtig ist dir Gelassenheit, wenn eine Absage ehrlich begründet ist?",
          "Wie fair wirkt für dich eine kurze Enttäuschung mit offenem Blick nach vorn?",
          "Wie stark hängt dein Urteil bei einer Absage vom Grund ab?",
          "Wie schnell würdest du nach einer späten Absage Distanz aufbauen?",
          "Wann wäre eine späte Absage für dich ein echter Schlussstrich?",
        ],
        createResponseOptions([
          "Eine ehrliche Absage würde ich ziemlich entspannt nehmen.",
          "Ich wäre kurz enttäuscht, bliebe aber offen.",
          "Für mich hängt fast alles vom Grund ab.",
          "Ich würde dadurch eher schnell Distanz aufbauen.",
          "Nach so etwas wäre ich wahrscheinlich eher raus.",
        ]),
      ),
    },
    {
      id: "ex-contact",
      prompt: `${selfName}, dein Gegenüber hat noch regelmäßig Kontakt zur Ex-Person. Wie fühlst du dich damit?`,
      answerOptions: createAnswerBranches(
        [
          "Solange alles transparent ist, stört es mich kaum.",
          "Es ist okay, wenn die Grenzen klar sind.",
          "Ich beobachte erst einmal, wie sich das anfühlt.",
          "Ich wäre damit eher vorsichtig.",
          "Das wäre für mich fast immer ein Problem.",
        ],
        [
          "Wie unproblematisch ist Ex-Kontakt für dich, wenn alles offen ist?",
          "Wie wichtig wären dir klare Grenzen bei Kontakt zur Ex-Person?",
          "Wie sehr würdest du so etwas erst einmal beobachten wollen?",
          "Wie vorsichtig wärst du selbst bei regelmäßigem Ex-Kontakt?",
          "Ab wann wäre Ex-Kontakt für dich ein echtes Problem?",
        ],
        createResponseOptions([
          "Transparenter Ex-Kontakt ist für mich grundsätzlich okay.",
          "Mit klaren Grenzen könnte ich gut leben.",
          "Ich müsste erst sehen, wie es sich konkret anfühlt.",
          "Regelmäßiger Ex-Kontakt würde mich eher vorsichtig machen.",
          "Das wäre für mich ziemlich schnell ein Problem.",
        ]),
      ),
    },
    {
      id: "party-alone",
      prompt: `${selfName}, deine Person geht feiern und du bist nicht dabei. Was ist für dich am stimmigsten?`,
      answerOptions: createAnswerBranches(
        [
          "Ich brauche da kaum Updates, ich vertraue einfach.",
          "Eine kurze Nachricht zwischendurch finde ich schön.",
          "Einmal kurz hören reicht mir meistens.",
          "Ich merke, dass mir das eher Unsicherheit gibt.",
          "Ohne enge Abstimmung fände ich das schwierig.",
        ],
        [
          "Wie leicht fällt dir Vertrauen, wenn die andere Person ohne dich feiern geht?",
          "Wie schön wäre für dich eine kleine Nachricht zwischendurch?",
          "Wie sehr reicht dir in so einer Nacht ein kurzes Lebenszeichen?",
          "Wie schnell würde so eine Situation dir Unsicherheit geben?",
          "Wie eng abgestimmt müsstest du dich in so einer Nacht fühlen?",
        ],
        createResponseOptions([
          "Ich brauche da kaum Rückversicherung.",
          "Eine kleine Nachricht zwischendurch finde ich schön.",
          "Ein kurzes Lebenszeichen würde mir reichen.",
          "Ohne Rückmeldung wäre ich eher angespannt.",
          "Ich bräuchte in so einer Situation viel Sicherheit.",
        ]),
      ),
    },
    {
      id: "phone-privacy",
      prompt: `${selfName}, wie gehst du in einer Beziehung mit Handy und Privatsphäre um?`,
      answerOptions: createAnswerBranches(
        [
          "Vertrauen heißt für mich: gar nicht kontrollieren.",
          "Offenheit ist gut, aber jeder darf seinen Raum haben.",
          "Ich finde gemeinsame Regeln sinnvoll.",
          "Ich wäre bei dem Thema eher sensibel.",
          "Wenn etwas komisch wirkt, würde ich Klarheit wollen.",
        ],
        [
          "Wie sehr heißt Vertrauen für dich auch, Privatsphäre ganz unangetastet zu lassen?",
          "Wie passend ist für dich Offenheit bei gleichzeitig klaren eigenen Räumen?",
          "Wie hilfreich fändest du feste Regeln rund ums Handy?",
          "Wie sensibel bist du selbst beim Thema Privatsphäre im Handy?",
          "Wann würdest du bei komischem Gefühl aktiv Klarheit einfordern?",
        ],
        createResponseOptions([
          "Kontrolle wäre für mich gar kein Thema.",
          "Offenheit ja, aber jedes Handy bleibt privat.",
          "Gemeinsame Regeln dazu fände ich sinnvoll.",
          "Wenn etwas komisch wirkt, würde ich nachhaken.",
          "Bei dem Thema hätte ich schnell ein Problem.",
        ]),
      ),
    },
    {
      id: "physical-pace",
      prompt: `${selfName}, wenn es körperlich schnell intensiv wird, was beschreibt dich am ehesten?`,
      answerOptions: createAnswerBranches(
        [
          "Ich brauche dafür Zeit und echtes Vertrauen.",
          "Ich lasse es ruhig entstehen.",
          "Wenn es sich gut anfühlt, bin ich offen.",
          "Ich bin da eher spontan.",
          "Ich entscheide das sehr aus dem Moment heraus.",
        ],
        [
          "Wie wichtig sind dir Zeit und Vertrauen bei körperlicher Nähe?",
          "Wie stimmig fühlt sich für dich ein ruhiges Tempo an?",
          "Wie offen bist du, wenn es sich einfach gut anfühlt?",
          "Wie spontan darf körperliche Nähe für dich entstehen?",
          "Wie stark entscheidest du so etwas aus dem Moment heraus?",
        ],
        createResponseOptions([
          "Ich brauche dabei viel Zeit und Vertrauen.",
          "Langsam und ruhig fühlt sich für mich richtig an.",
          "Wenn es passt, darf es sich natürlich entwickeln.",
          "Ich bin bei Nähe eher offen und spontan.",
          "Ich entscheide so etwas stark aus dem Moment heraus.",
        ]),
      ),
    },
    {
      id: "social-media",
      prompt: `${selfName}, jemand schreibt deiner Person regelmäßig auf Social Media. Was wäre für dich okay?`,
      answerOptions: createAnswerBranches(
        [
          "Solange alles offen ist, sehe ich darin kein Problem.",
          "Unproblematisch, solange die Grenzen klar sind.",
          "Kommt auf Ton und Häufigkeit an.",
          "Ich fände das eher unangenehm.",
          "Das wäre schnell ein klares Thema für mich.",
        ],
        [
          "Wie entspannt bist du bei Nachrichten von außen, wenn alles offen ist?",
          "Wie wichtig sind dir klare Grenzen bei Kontakt von außen?",
          "Wie sehr hängt es für dich von Ton und Häufigkeit ab?",
          "Wie unangenehm würdest du regelmäßige Nachrichten von außen finden?",
          "Wann würde so etwas für dich ein klares Thema werden?",
        ],
        createResponseOptions([
          "Nachrichten von außen stören mich kaum.",
          "Solange Grenzen klar sind, ist das okay.",
          "Das hängt für mich stark von Ton und Intensität ab.",
          "Ich fände regelmäßiges Schreiben eher unangenehm.",
          "Das wäre ziemlich schnell ein rotes Tuch für mich.",
        ]),
      ),
    },
    {
      id: "apology",
      prompt: `${selfName}, du merkst, dass du einen Fehler gemacht hast. Wie entschuldigst du dich am ehesten?`,
      answerOptions: createAnswerBranches(
        [
          "Klar, direkt und ohne Ausreden.",
          "Ich suche schnell das Gespräch und erkläre mich.",
          "Ich brauche kurz, um es richtig einzuordnen.",
          "Ich tue mich mit Entschuldigungen eher schwer.",
          "Ich brauche oft länger, bis ich das zugebe.",
        ],
        [
          "Wie wichtig ist dir eine klare, direkte Entschuldigung ohne Ausreden?",
          "Wie gut fühlt sich eine schnelle Erklärung im Gespräch für dich an?",
          "Wie viel Verständnis hast du dafür, wenn jemand kurz sortieren muss?",
          "Wie schwer wäre für dich eine Person, die sich mit Entschuldigungen schwertut?",
          "Wie lange könntest du damit umgehen, wenn Einsicht erst spät kommt?",
        ],
        createResponseOptions([
          "Eine klare direkte Entschuldigung brauche ich fast immer.",
          "Schnell das Gespräch zu suchen fühlt sich für mich richtig an.",
          "Kurzes Sortieren ist okay, solange danach Klarheit kommt.",
          "Ich kann auch mit längerer Verarbeitung noch umgehen.",
          "Späte Einsicht wäre für mich nicht automatisch ein Problem.",
        ]),
      ),
    },
    {
      id: "family-intro",
      prompt: `${selfName}, wann würdest du eine neue Person ungefähr deinem Umfeld vorstellen?`,
      answerOptions: createAnswerBranches(
        [
          "Erst wenn ich wirklich sicher bin.",
          "Nach etwas gemeinsamer Zeit und Klarheit.",
          "Wenn es sich natürlich ergibt.",
          "Relativ früh, um zu sehen wie es passt.",
          "Ich bin da ziemlich spontan.",
        ],
        [
          "Wie spät würdest du eine Person erst deinem Umfeld zeigen?",
          "Wie viel gemeinsame Zeit und Klarheit brauchst du dafür meistens?",
          "Wie natürlich darf das Kennenlernen mit deinem Umfeld für dich entstehen?",
          "Wie offen wärst du für ein eher frühes Kennenlernen mit dem Umfeld?",
          "Wie spontan darf so ein Schritt für dich sein?",
        ],
        createResponseOptions([
          "Ich würde mein Umfeld erst sehr spät einbeziehen.",
          "Nach etwas Zeit und Sicherheit fühlt es sich richtig an.",
          "Wenn es sich natürlich ergibt, ist es gut.",
          "Ein frühes Kennenlernen finde ich eher positiv.",
          "Ich bin damit ziemlich locker und spontan.",
        ]),
      ),
    },
    {
      id: "move-away",
      prompt: `${selfName}, eine Person, die du magst, bekommt ein starkes Jobangebot in einer anderen Stadt. Wie denkst du zuerst darüber?`,
      answerOptions: createAnswerBranches(
        [
          "Ich schaue zuerst, wie wir gemeinsam eine Lösung finden.",
          "Ich bin offen, wenn die Verbindung stark ist.",
          "Ich würde es mir ehrlich offenhalten.",
          "Distanz macht mich eher skeptisch.",
          "Das wäre für mich fast direkt ein Stop.",
        ],
        [
          "Wie sehr suchst du zuerst nach einer gemeinsamen Lösung bei Distanz?",
          "Wie offen bist du für Distanz, wenn die Verbindung stark ist?",
          "Wie sehr würdest du dir das erst ehrlich offenhalten?",
          "Wie skeptisch macht dich räumliche Distanz generell?",
          "Ab wann wäre Distanz für dich fast direkt ein Schlussstrich?",
        ],
        createResponseOptions([
          "Ich würde zuerst nach einer gemeinsamen Lösung suchen.",
          "Wenn die Verbindung stark ist, wäre ich offen.",
          "Ich würde ehrlich prüfen, ob es tragbar ist.",
          "Distanz macht mich eher skeptisch.",
          "Für mich wäre das fast direkt ein Ende.",
        ]),
      ),
    },
    {
      id: "alone-time",
      prompt: `${selfName}, wie wichtig ist dir in einer Beziehung eigener Freiraum?`,
      answerOptions: createAnswerBranches(
        [
          "Sehr wichtig, ohne dass Nähe darunter leidet.",
          "Wichtig, aber gut abgestimmt.",
          "Ich mag eine gute Balance.",
          "Zu viel Abstand macht mich eher unsicher.",
          "Ich wünsche mir meistens sehr viel Nähe.",
        ],
        [
          "Wie wichtig ist eigener Raum für dich, ohne dass Nähe verloren geht?",
          "Wie gut passt für dich Freiraum, wenn er gut abgestimmt ist?",
          "Wie sehr suchst du selbst eine Balance aus Nähe und Eigenem?",
          "Wie schnell macht dich zu viel Abstand eher unsicher?",
          "Wie viel dauerhafte Nähe wünschst du dir meistens?",
        ],
        createResponseOptions([
          "Eigener Raum ist für mich sehr wichtig.",
          "Freiraum gehört für mich klar dazu.",
          "Ich mag eine gute Balance aus Nähe und Eigenem.",
          "Zu viel Abstand macht mich eher unsicher.",
          "Ich wünsche mir meistens sehr viel gemeinsame Zeit.",
        ]),
      ),
    },
    {
      id: "money-date",
      prompt: `${selfName}, beim ersten teureren Date: Wie gehst du am liebsten mit dem Bezahlen um?`,
      answerOptions: createAnswerBranches(
        [
          "Am liebsten ganz selbstverständlich teilen.",
          "Ich finde Abwechseln charmant.",
          "Mir ist wichtiger, dass es locker bleibt.",
          "Ich mag es, wenn eine Person übernimmt.",
          "Ich habe da eher ein klassisches Bild.",
        ],
        [
          "Wie selbstverständlich fühlt sich Teilen für dich bei einem Date an?",
          "Wie charmant findest du eher ein lockeres Abwechseln?",
          "Wie wichtig ist dir vor allem, dass es ohne Druck bleibt?",
          "Wie gern darf eine Person bei einem Date übernehmen?",
          "Wie klassisch ist dein Bild beim Bezahlen eher?",
        ],
        createResponseOptions([
          "Teilen fühlt sich für mich am besten an.",
          "Ich mag es, wenn man sich abwechselt.",
          "Hauptsache es bleibt locker und fair.",
          "Ich finde es schön, wenn eine Person öfter übernimmt.",
          "Ich mag da eher klassische Rollen.",
        ]),
      ),
    },
    {
      id: "stress",
      prompt: `${selfName}, wenn du beruflich oder privat stark unter Druck stehst, was passiert meistens mit dir?`,
      answerOptions: createAnswerBranches(
        [
          "Ich kommuniziere das offen und bleibe erreichbar.",
          "Ich ziehe mich etwas zurück, sage das aber klar.",
          "Ich funktioniere erst und rede später darüber.",
          "Ich werde dann schnell still.",
          "In Stressphasen bin ich kaum erreichbar.",
        ],
        [
          "Wie wichtig ist dir offene Kommunikation auch in Stressphasen?",
          "Wie verständlich ist für dich etwas Rückzug, wenn er klar benannt wird?",
          "Wie gut passt für dich erst funktionieren und später reden?",
          "Wie schwer wäre für dich eine Person, die dann schnell still wird?",
          "Wie gut könntest du mit kaum Erreichbarkeit in Stressphasen umgehen?",
        ],
        createResponseOptions([
          "Auch in Stressphasen bleibe ich eher offen und erreichbar.",
          "Ich ziehe mich etwas zurück, sage das aber klar.",
          "Oft funktioniere ich erst und rede später darüber.",
          "Unter Stress werde ich eher still.",
          "In Stressphasen bin ich häufig kaum erreichbar.",
        ]),
      ),
    },
    {
      id: "exclusive",
      prompt: `${selfName}, ab wann fühlt sich Dating für dich exklusiv an?`,
      answerOptions: createAnswerBranches(
        [
          "Erst wenn man es klar ausgesprochen hat.",
          "Relativ früh, wenn beide ernst wirken.",
          "Es entwickelt sich für mich eher schrittweise.",
          "Ich brauche dafür deutlich mehr Zeit.",
          "Exklusivität ist für mich sehr spät ein Thema.",
        ],
        [
          "Wie wichtig ist dir ein klares ausgesprochenes Exklusivitätsgespräch?",
          "Wie früh fühlst du Exklusivität, wenn beide ernst wirken?",
          "Wie natürlich entwickelt sich Exklusivität für dich eher schrittweise?",
          "Wie viel Zeit brauchst du selbst bis zu echter Exklusivität?",
          "Wie spät wird Exklusivität für dich überhaupt erst relevant?",
        ],
        createResponseOptions([
          "Exklusivität beginnt für mich erst nach einem klaren Gespräch.",
          "Wenn beide ernst wirken, darf es früh klar werden.",
          "Ich sehe das eher als fließenden Übergang.",
          "Ich brauche lange, bis ich Exklusivität wirklich fühle.",
          "Für mich ist Exklusivität erst sehr spät ein Thema.",
        ]),
      ),
    },
    {
      id: "doubt",
      prompt: `${selfName}, du merkst, dass du bei jemandem Zweifel hast. Wie gehst du damit am ehesten um?`,
      answerOptions: createAnswerBranches(
        [
          "Ich spreche es ehrlich an.",
          "Ich beobachte kurz und rede dann offen darüber.",
          "Ich will erst verstehen, ob es nur eine Phase ist.",
          "Ich ziehe mich eher zurück.",
          "Wenn ich zweifle, bin ich innerlich meist schon weg.",
        ],
        [
          "Wie schnell würdest du Zweifel ehrlich ansprechen?",
          "Wie passend ist für dich erst beobachten und dann offen reden?",
          "Wie sehr möchtest du Zweifel erst für dich einordnen?",
          "Wie gut könntest du mit Rückzug bei Zweifel umgehen?",
          "Wie endgültig fühlt sich innerer Rückzug für dich an?",
        ],
        createResponseOptions([
          "Zweifel würde ich früh offen ansprechen.",
          "Erst sortieren und dann ehrlich reden passt zu mir.",
          "Ich will Zweifel oft erst für mich verstehen.",
          "Ich ziehe mich bei Zweifel eher etwas zurück.",
          "Wenn ich innerlich stark zweifle, bin ich oft schnell weg.",
        ]),
      ),
    },
    {
      id: "friends-opinion",
      prompt: `${selfName}, dein enges Umfeld mag eine Person nicht, die du datest. Wie sehr beeinflusst dich das?`,
      answerOptions: createAnswerBranches(
        [
          "Ich höre es mir an, entscheide aber selbst.",
          "Ich nehme es ernst, ohne sofort zu kippen.",
          "Es würde mich schon nachdenklich machen.",
          "Das hätte für mich viel Gewicht.",
          "Ohne Rückhalt von meinem Umfeld wäre ich fast raus.",
        ],
        [
          "Wie unabhängig triffst du solche Entscheidungen trotz Gegenwind von außen?",
          "Wie ernst nimmst du Warnungen aus deinem Umfeld, ohne sofort zu kippen?",
          "Wie nachdenklich würde dich so ein Gegenwind machen?",
          "Wie viel Gewicht hätte das Urteil deines Umfelds für dich?",
          "Wie wichtig ist dir der Rückhalt deines Umfelds für ein Weitergehen?",
        ],
        createResponseOptions([
          "Ich höre mein Umfeld an, entscheide aber selbst.",
          "Warnungen nehme ich ernst, ohne sofort zu kippen.",
          "Mich würde das deutlich nachdenklich machen.",
          "Die Meinung meines Umfelds hätte viel Gewicht.",
          "Ohne Rückhalt von außen würde ich stark zweifeln.",
        ]),
      ),
    },
    {
      id: "holiday",
      prompt: `${selfName}, eine gemeinsame Reise steht im Raum. Wann fühlt sich das für dich richtig an?`,
      answerOptions: createAnswerBranches(
        [
          "Erst wenn schon viel Vertrauen da ist.",
          "Nach einer gewissen Stabilität.",
          "Wenn es sich natürlich ergibt.",
          "Ich bin dafür ziemlich offen.",
          "Ich mache so etwas eher spontan.",
        ],
        [
          "Wie viel Vertrauen brauchst du, bevor eine gemeinsame Reise passt?",
          "Wie wichtig ist dir erst eine gewisse Stabilität?",
          "Wie natürlich darf eine gemeinsame Reise für dich entstehen?",
          "Wie offen bist du selbst für eine frühere gemeinsame Reise?",
          "Wie spontan darf so ein Schritt für dich sein?",
        ],
        createResponseOptions([
          "Reisen würde ich erst mit viel Vertrauen angehen.",
          "Nach etwas Stabilität fühlt es sich gut an.",
          "Wenn es sich ergibt, bin ich offen dafür.",
          "Ich würde so etwas eher früh ausprobieren.",
          "Ich bin bei solchen Dingen ziemlich spontan.",
        ]),
      ),
    },
    {
      id: "late-replies",
      prompt: `${selfName}, eine Person antwortet immer wieder erst viele Stunden später. Was löst das bei dir aus?`,
      answerOptions: createAnswerBranches(
        [
          "Nicht viel, wenn der Kontakt sonst stimmig ist.",
          "Ich merke es, kann aber gut damit umgehen.",
          "Kommt auf Kontext und Verbindlichkeit an.",
          "Ich verliere dann eher Vertrauen.",
          "Das wäre für mich ziemlich schnell ein Problem.",
        ],
        [
          "Wie entspannt bist du bei langen Antwortzeiten, wenn sonst alles stimmig ist?",
          "Wie gut kannst du mit längeren Pausen im Schreiben umgehen?",
          "Wie sehr hängt das für dich von Kontext und Verbindlichkeit ab?",
          "Wie schnell schwächen lange Pausen dein Vertrauen?",
          "Ab wann wären späte Antworten für dich ein echtes Problem?",
        ],
        createResponseOptions([
          "Lange Antwortzeiten stressen mich kaum.",
          "Ich kann gut damit umgehen, wenn sonst alles klar ist.",
          "Für mich hängt es von Kontext und Verbindlichkeit ab.",
          "Auf Dauer würde es mein Vertrauen schwächen.",
          "Das wäre für mich ziemlich schnell zu wenig.",
        ]),
      ),
    },
    {
      id: "public-relationship",
      prompt: `${selfName}, wie schnell würdest du eine Beziehung öffentlich machen?`,
      answerOptions: createAnswerBranches(
        [
          "Sehr spät, das ist für mich etwas Privates.",
          "Wenn es sich stabil anfühlt.",
          "Es ist mir eher nicht so wichtig.",
          "Ich teile so etwas gern relativ früh.",
          "Wenn es schön ist, darf man es auch sofort zeigen.",
        ],
        [
          "Wie privat hältst du Beziehungen lieber am Anfang?",
          "Wie wichtig ist dir erst Stabilität, bevor etwas öffentlich wird?",
          "Wie egal oder wichtig ist Öffentlichkeit für dich grundsätzlich?",
          "Wie gern würdest du eine Beziehung eher früh sichtbar machen?",
          "Wie schnell dürfte eine schöne Beziehung für dich auch nach außen sichtbar sein?",
        ],
        createResponseOptions([
          "Ich halte Beziehungen lieber lange privat.",
          "Öffentlich würde es für mich erst bei Stabilität werden.",
          "Ob es sichtbar ist, ist mir nicht so wichtig.",
          "Ich teile schöne Dinge gern eher früh.",
          "Wenn es gut ist, dürfte man es auch schnell zeigen.",
        ]),
      ),
    },
  ];

  const shuffled = [...questionBank];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[randomIndex];
    shuffled[randomIndex] = current;
  }

  return shuffled.slice(0, Math.min(PHASE_TWO_ROUNDS_PER_SESSION, shuffled.length));
}

function buildCompletedPhaseTwoResults(rounds: PhaseTwoRoundConfig[]): PhaseTwoRoundResult[] {
  return rounds.map((round) => {
    const personA = round.answerOptions[1] ?? round.answerOptions[0];
    const personB = personA.followUpOptions[1] ?? personA.followUpOptions[0];

    return {
      roundId: round.id,
      prompt: round.prompt,
      personALabel: personA.label,
      personAScore: personA.score,
      followUpPrompt: personA.followUpPrompt,
      followUpOptions: personA.followUpOptions,
      personBLabel: personB.label,
      personBScore: personB.score,
      compatibility: getCompatibilityPoints(personA.score, personB.score),
    };
  });
}

function getReleaseAnchorForCurrentTime(now: Date) {
  const anchor = new Date(now);
  anchor.setHours(MATCH_RELEASE_HOUR, 0, 0, 0);

  if (now < anchor) {
    anchor.setDate(anchor.getDate() - 1);
  }

  return anchor;
}

function createBirthdayBounds() {
  const now = new Date();
  const latest = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  const earliest = new Date(now.getFullYear() - 99, now.getMonth(), now.getDate());

  return {
    earliest,
    latest,
  };
}

function getBirthdayPickerDate(profile: RegistrationProfile) {
  const year = Number(profile.birthYear);
  const month = Number(profile.birthMonth);
  const day = Number(profile.birthDay);

  if (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year > 1900 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31
  ) {
    const birthday = new Date(year, month - 1, day);

    if (
      birthday.getFullYear() === year &&
      birthday.getMonth() === month - 1 &&
      birthday.getDate() === day
    ) {
      return birthday;
    }
  }

  const fallback = new Date();
  fallback.setFullYear(fallback.getFullYear() - 25);
  return fallback;
}

const screens: Screen[] = [
  {
    id: "intro",
    kind: "intro",
    title: "1 Match.\nJeden Tag.",
    subtitle: "Ohne Swipes.",
  },
  {
    id: "phone",
    kind: "phone",
    title: "Nummer",
    hint: "Sicherer Einstieg",
    placeholder: "+49 151 23456789",
  },
  {
    id: "otp",
    kind: "otp",
    title: "Code eingeben",
    hint: "SMS-Bestätigung",
    placeholder: "123456",
  },
  {
    id: "firstName",
    kind: "text",
    title: "Wie dürfen wir dich nennen?",
    hint: "So erscheinst du in Choice",
    placeholder: "Alex",
  },
  {
    id: "birthday",
    kind: "birthday",
    title: "Wann bist du geboren?",
    hint: "Tag, Monat, Jahr",
  },
  {
    id: "city",
    kind: "text",
    title: "Wo lebst du gerade?",
    hint: "Damit dein Match in deiner Nähe ist",
    placeholder: "Berlin",
  },
  {
    id: "selfDescription",
    kind: "single",
    title: "Welcher Satz beschreibt dich eher?",
    hint: "Wähl einfach den, der sich am ehesten nach dir anfühlt",
    options: selfDescriptionOptions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  },
  {
    id: "pronouns",
    kind: "single",
    title: "Wie möchtest du angesprochen werden?",
    hint: "Für die Ansprache in Choice",
    options: pronounOptions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  },
  {
    id: "identity",
    kind: "single",
    title: "Was trifft eher auf dich zu?",
    hint: "Nimm einfach das, was am ehesten passt",
    options: identityOptions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  },
  {
    id: "lookingFor",
    kind: "single",
    title: "Wen möchtest du kennenlernen?",
    hint: "Damit wir passend matchen",
    options: optionify(lookingForOptions),
  },
  {
    id: "datingIntent",
    kind: "single",
    title: "Was darf daraus werden?",
    hint: "Ganz ohne Druck",
    options: datingIntentOptions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  },
  {
    id: "ageRange",
    kind: "ageRange",
    title: "Welches Alter passt für dich?",
    hint: "Von bis",
  },
  {
    id: "interests",
    kind: "multi",
    title: "Wofür begeisterst du dich?",
    hint: "Wähl 3 bis 5 Dinge wie Musik, Reisen, Kochen oder Cafés",
    options: optionify(interestOptions),
  },
  {
    id: "preferences",
    kind: "preferences",
    title: "Was magst du beim Kennenlernen?",
    greenFlagOptions: optionify(greenFlagOptions),
    dealbreakerOptions: optionify(dealbreakerOptions),
  },
  {
    id: "photos",
    kind: "photos",
    title: "Zeig dich noch kurz",
    hint: "2 bis 8 Bilder, optional 1 Video",
  },
  {
    id: "done",
    kind: "done",
    title: "Geschafft.",
  },
];

type SelectionChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

type SharedChatAuthor = "primary" | "partner";

type SharedChatTextMessage = {
  id: string;
  author: SharedChatAuthor;
  kind: "text";
  text: string;
  createdAt: string;
  sending?: boolean;
};

type SharedChatImageMessage = {
  id: string;
  author: SharedChatAuthor;
  kind: "image";
  imageUri: string;
  createdAt: string;
  sending?: boolean;
};

type SharedChatMessage =
  | SharedChatTextMessage
  | SharedChatImageMessage;

type SharedChatMessageInput =
  | { kind: "text"; text: string }
  | { kind: "image"; imageUri: string };

type ChatRenderMessage =
  | { id: string; side: "left" | "right"; kind: "text"; text: string; createdAt: string; sending?: boolean }
  | { id: string; side: "left" | "right"; kind: "image"; imageUri: string; createdAt: string; sending?: boolean };

function mapSharedChatMessagesForViewer(
  messages: readonly SharedChatMessage[],
): ChatRenderMessage[] {
  return messages.map((message) => {
    const side = message.author === "primary" ? "right" : "left";

    if (message.kind === "image") {
      return {
        id: message.id,
        side,
        kind: "image",
        imageUri: message.imageUri,
        createdAt: message.createdAt,
        sending: message.sending,
      };
    }

    return {
      id: message.id,
      side,
      kind: "text",
      text: message.text,
      createdAt: message.createdAt,
      sending: message.sending,
    };
  });
}

function getSharedChatMessagePreview(message: SharedChatMessage | undefined) {
  if (!message) {
    return null;
  }

  if (message.kind === "image") {
    return "📷 Bild";
  }

  return message.text;
}

function normalizeSharedChatMessages(value: unknown): SharedChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<SharedChatMessage[]>((messages, entry) => {
    if (!entry || typeof entry !== "object") {
      return messages;
    }

    const candidate = entry as Record<string, unknown>;
    const rawAuthor = typeof candidate.author === "string" ? candidate.author : null;
    const author =
      rawAuthor === "partner"
      || rawAuthor === "mila"
        ? "partner"
        : rawAuthor === "primary"
          ? "primary"
          : null;
    const id = typeof candidate.id === "string" ? candidate.id : null;
    const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString();
    const sending = candidate.sending === true;

    if (!author || !id) {
      return messages;
    }

    if (
      candidate.kind === "image"
      && typeof candidate.imageUri === "string"
      && candidate.imageUri.trim()
      && !/\.(mp4|mov|m4v|avi|webm)(\?|#|$)/i.test(candidate.imageUri)
    ) {
      messages.push({
        id,
        author,
        kind: "image" as const,
        imageUri: candidate.imageUri,
        createdAt,
        sending,
      });
      return messages;
    }

    if (candidate.kind === "text" && typeof candidate.text === "string") {
      messages.push({
        id,
        author,
        kind: "text" as const,
        text: candidate.text,
        createdAt,
        sending,
      });
    }

    return messages;
  }, []);
}

function mapRemoteJourneyMessages(
  messages: readonly RemoteJourneyState["sharedChatMessages"][number][],
  viewerUserId: string,
): SharedChatMessage[] {
  return messages.reduce<SharedChatMessage[]>((items, message) => {
    if (message.kind === "system") {
      return items;
    }

    const author: SharedChatAuthor = message.senderUserId === viewerUserId ? "primary" : "partner";

    if (message.kind === "image" && message.imageUri) {
      items.push({
        id: message.id,
        author,
        kind: "image",
        imageUri: message.imageUri,
        createdAt: message.createdAt,
      });
      return items;
    }

    if (message.kind === "text" && message.text) {
      items.push({
        id: message.id,
        author,
        kind: "text",
        text: message.text,
        createdAt: message.createdAt,
      });
    }

    return items;
  }, []);
}

function mapRemoteJourneyPartnerToDemoProfile(partner: RemoteJourneyPartnerProfile | null): DemoProfile | null {
  if (!partner) {
    return null;
  }

  const primaryPhoto = partner.photoUrls.find((entry) => entry?.trim()) ?? partner.avatarUrl ?? demoProfiles[0].imageUri;
  const preferenceTagline = partner.greenFlags.slice(0, 2).join(" • ");
  const interestTagline = partner.interests.slice(0, 2).join(" • ");
  const tagline = preferenceTagline
    ? `Mag eher: ${preferenceTagline}`
    : interestTagline || "Choice Match";

  return {
    id: partner.userId,
    firstName: partner.firstName.trim() || "Choice",
    age: partner.age,
    city: partner.city.trim() || "Berlin",
    selfDescription: partner.selfDescription,
    tagline,
    imageUri: primaryPhoto,
    photoUris: partner.photoUrls.length ? partner.photoUrls : [primaryPhoto],
    introVideoUrl: partner.introVideoUrl,
    interests: partner.interests,
    pronouns: partner.pronouns,
    identity: partner.identity,
    lookingFor: partner.lookingFor,
    datingIntent: partner.datingIntent,
    ageRangeMin: partner.ageRangeMin,
    ageRangeMax: partner.ageRangeMax,
    greenFlags: partner.greenFlags,
    dealbreakers: partner.dealbreakers,
    time: partner.matchTime || "Heute 21:00",
  };
}

function isEmojiOnlyMessage(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return false;
  }

  const nonWhitespaceCharacters = [...trimmed].filter((character) => !/\s/u.test(character));
  return nonWhitespaceCharacters.length <= 6 && /^[\p{Extended_Pictographic}\uFE0F\s]+$/u.test(trimmed);
}

function chooseStableStarterUserId(userA: string, userB: string) {
  const [left, right] = [userA, userB].sort();
  const key = `${left}:${right}`;
  const sum = [...key].reduce((current, character) => current + character.charCodeAt(0), 0);
  return sum % 2 === 0 ? left : right;
}

function SelectionChip({ label, active, onPress }: SelectionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        pressed && styles.chipPressed,
        active && styles.chipActive,
        active && pressed && styles.chipActivePressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {active ? (
        <View style={styles.chipCheck}>
          <Text style={styles.chipCheckText}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function StatementOptionCard({ label, active, onPress }: SelectionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statementOptionCard,
        pressed && styles.statementOptionCardPressed,
        active && styles.statementOptionCardActive,
        active && pressed && styles.statementOptionCardActivePressed,
      ]}
    >
      <Text style={[styles.statementOptionText, active && styles.statementOptionTextActive]}>{label}</Text>
      {active ? (
        <View style={styles.statementOptionCheck}>
          <Text style={styles.statementOptionCheckText}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type InlineVideoPreviewProps = {
  uri: string;
  height?: number;
};

function InlineVideoPreview({ uri, height = 220 }: InlineVideoPreviewProps) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={[styles.inlineVideoPreview, { height }]}
      nativeControls
      allowsFullscreen
      allowsPictureInPicture={false}
      contentFit="contain"
    />
  );
}

type ProgressRingProps = {
  current: number;
  total: number;
  activeColor: string;
  label: string;
  displayValue?: string;
  unlocked?: boolean;
  unlockedColor?: string;
  unlockedValue?: string;
  unlockedLabel?: string;
};

function ProgressRing({
  current,
  total,
  activeColor,
  label,
  displayValue,
  unlocked = false,
  unlockedColor = "#8dffb8",
  unlockedValue = "∞",
  unlockedLabel = "frei",
}: ProgressRingProps) {
  const size = 118;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = unlocked ? 1 : Math.min(Math.max(current / total, 0), 1);
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={styles.unlockRingWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={unlocked ? unlockedColor : activeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.unlockRingCenter}>
        <Text style={styles.unlockRingValue}>{unlocked ? unlockedValue : displayValue ?? `${current}/${total}`}</Text>
        <Text style={styles.unlockRingLabel}>{unlocked ? unlockedLabel : label}</Text>
      </View>
    </View>
  );
}

type ChoiceAwardHeartProps = {
  leftUri: string;
  rightUri: string;
  size?: number;
};

function ChoiceAwardHeart({ leftUri, rightUri, size = 260 }: ChoiceAwardHeartProps) {
  const heartWidth = size;
  const heartHeight = size * 1.02;
  const heartPath =
    "M50 84 C45 78 14 56 14 29 C14 16 24 8 35 8 C43 8 49 12 50 20 C51 12 57 8 65 8 C76 8 86 16 86 29 C86 56 55 78 50 84 Z";
  const centerWavePath =
    "L50 10 C43 18 58 28 50 40 C42 52 58 62 50 74 C47 78 48 82 50 84";
  const leftHalfPath = `M0 0 H50 ${centerWavePath} V100 H0 Z`;
  const rightHalfPath = `M100 0 H50 ${centerWavePath} V100 H100 Z`;

  return (
    <Svg width={heartWidth} height={heartHeight} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="choiceAwardHeartClip">
          <Path d={heartPath} />
        </ClipPath>
        <ClipPath id="choiceAwardHeartLeftHalf">
          <Path d={leftHalfPath} />
        </ClipPath>
        <ClipPath id="choiceAwardHeartRightHalf">
          <Path d={rightHalfPath} />
        </ClipPath>
      </Defs>

      <G clipPath="url(#choiceAwardHeartClip)">
        <Rect x="0" y="0" width="100" height="92" fill="#110c18" />
        <SvgImage
          href={{ uri: leftUri }}
          x="-2"
          y="1"
          width="54"
          height="86"
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#choiceAwardHeartLeftHalf)"
        />
        <SvgImage
          href={{ uri: rightUri }}
          x="48"
          y="1"
          width="54"
          height="86"
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#choiceAwardHeartRightHalf)"
        />
      </G>

      <G clipPath="url(#choiceAwardHeartClip)">
        <Path
          d={`M50 10 C43 18 58 28 50 40 C42 52 58 62 50 74 C47 78 48 82 50 84`}
          fill="none"
          stroke="rgba(20, 15, 24, 0.72)"
          strokeWidth="1.18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>

      <G clipPath="url(#choiceAwardHeartLeftHalf)">
        <Path
          d={heartPath}
          fill="none"
          stroke="#2C9DFF"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </G>
      <G clipPath="url(#choiceAwardHeartRightHalf)">
        <Path
          d={heartPath}
          fill="none"
          stroke="#FF4C78"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </G>
      <Path
        d={heartPath}
        fill="none"
        stroke="rgba(185, 173, 182, 0.14)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type MatchPreviewCardProps = {
  profile: DemoProfile;
  eyebrow: string;
  detail: string;
  compact?: boolean;
};

function MatchPreviewCard({ profile, eyebrow, detail, compact = false }: MatchPreviewCardProps) {
  return (
    <View style={[styles.matchCard, compact && styles.matchCardCompact]}>
      <Image source={{ uri: profile.imageUri }} style={[styles.matchImage, compact && styles.matchImageCompact]} />
      <View style={styles.matchImageShade} />

      <View style={styles.matchTopRow}>
        <View style={styles.matchEyebrowPill}>
          <Text style={styles.matchEyebrow}>{eyebrow}</Text>
        </View>
        <View style={styles.matchTimePill}>
          <Text style={styles.matchTime}>{profile.time}</Text>
        </View>
      </View>

      <View style={styles.matchBottomBlock}>
        <Text style={styles.matchName}>
          {profile.firstName}, {profile.age}
        </Text>
        <Text style={styles.matchMeta}>
          {profile.city} • {detail}
        </Text>
        <Text style={styles.matchTagline}>{profile.tagline}</Text>

        <View style={styles.matchInterestRow}>
          {profile.interests.slice(0, compact ? 2 : 3).map((interest) => (
            <View key={`${profile.id}-${interest}`} style={styles.matchInterestPill}>
              <Text style={styles.matchInterestText}>{interest}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function HeroArtwork() {
  return (
    <View style={styles.artFrame}>
      <View style={styles.artGlowLarge} />
      <View style={styles.artGlowMid} />
      <View style={styles.artGlowSmall} />
      <View style={styles.artGlowCenter} />

      <View style={styles.logoStage}>
        <View style={styles.logoImagePlate}>
          <Image source={choiceLogo} fadeDuration={0} style={styles.logoImage} resizeMode="contain" />
        </View>
      </View>

      <View style={styles.introPreviewCard}>
        <Text style={styles.introPreviewLabel}>Morgen um 9:00</Text>
        <Text style={styles.introPreviewTitle}>1 gutes Match. Kein Feed.</Text>
        <Text style={styles.introPreviewText}>Kurz einrichten. Danach kommt dein Match jeden Tag automatisch.</Text>
      </View>
    </View>
  );
}

function SendingMetaIndicator({ right }: { right: boolean }) {
  const pulseOpacity = useRef(new Animated.Value(0.46)).current;
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.46,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [pulseOpacity]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((current) => (current % 3) + 1);
    }, 420);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <View style={[styles.chatBubbleMetaRow, right ? styles.chatBubbleMetaRowRight : styles.chatBubbleMetaRowLeft]}>
      <Animated.View style={[styles.chatBubbleSendingDot, { opacity: pulseOpacity }]} />
      <Animated.Text
        style={[
          styles.chatBubbleMeta,
          styles.chatBubbleMetaSending,
          right ? styles.chatBubbleMetaRight : styles.chatBubbleMetaLeft,
          { opacity: pulseOpacity },
        ]}
      >
        {`Wird gesendet${".".repeat(dotCount)}`}
      </Animated.Text>
    </View>
  );
}

type ChatSurfaceProps = {
  title: string;
  subtitle: string;
  subtitleOnline?: boolean;
  avatarUri?: string;
  avatarFallback: string;
  messages: readonly ChatRenderMessage[];
  emptyStateTitle?: string;
  emptyStateText?: string;
  composerPlaceholder: string;
  composerValue: string;
  composerEditable?: boolean;
  composerBusy?: boolean;
  composerHidden?: boolean;
  composerLockedText?: string | null;
  composerStatusText?: string | null;
  fullScreen?: boolean;
  onBack?: () => void;
  onOpenProfile?: () => void;
  onReportPress?: () => void;
  headerActionState?: "idle" | "keep";
  onHeaderActionPress?: () => void;
  onComposerChangeText: (value: string) => void;
  onSend: () => void;
  topInset?: number;
  bottomInset?: number;
  threadSupplement?: ReactNode;
  threadSupplementPlacement?: "inline" | "docked";
};

function ChatSurface({
  title,
  subtitle,
  subtitleOnline = false,
  avatarUri,
  avatarFallback,
  messages,
  emptyStateTitle,
  emptyStateText,
  composerPlaceholder,
  composerValue,
  composerEditable = true,
  composerBusy = false,
  composerHidden = false,
  composerLockedText = null,
  composerStatusText = null,
  fullScreen = false,
  onBack,
  onOpenProfile,
  onReportPress,
  headerActionState = "idle",
  onHeaderActionPress,
  onComposerChangeText,
  onSend,
  topInset = 0,
  bottomInset = 0,
  threadSupplement,
  threadSupplementPlacement = "docked",
}: ChatSurfaceProps) {
  const threadRef = useRef<ScrollView | null>(null);
  const composerInputRef = useRef<TextInput | null>(null);
  const [threadViewportHeight, setThreadViewportHeight] = useState(0);
  const [threadContentHeight, setThreadContentHeight] = useState(0);
  const canSend = composerEditable && !composerBusy && composerValue.trim().length > 0;
  const composerInteractive = composerEditable;
  const composerBottomPadding = fullScreen ? 4 : 10;
  const canScrollThread = threadContentHeight > threadViewportHeight + 1;
  const shouldDockThreadSupplement = fullScreen && threadSupplementPlacement === "docked";
  const dockedThreadSupplement = threadSupplement && shouldDockThreadSupplement
    ? <View style={[styles.chatThreadSupplement, styles.chatThreadSupplementDock]}>{threadSupplement}</View>
    : null;
  const inlineThreadSupplement = threadSupplement && !shouldDockThreadSupplement
    ? <View style={styles.chatThreadSupplement}>{threadSupplement}</View>
    : null;

  useEffect(() => {
    threadRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  useEffect(() => {
    const eventName = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const subscription = Keyboard.addListener(eventName, () => {
      requestAnimationFrame(() => {
        threadRef.current?.scrollToEnd({ animated: true });
      });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={[styles.chatSurfaceCard, fullScreen && styles.chatSurfaceCardFullScreen]}>
      <View
        style={[
          styles.chatSurfaceHeader,
          fullScreen && styles.chatSurfaceHeaderFullScreen,
          fullScreen && { paddingTop: topInset + 12 },
        ]}
      >
        {onBack ? (
          <Pressable onPress={onBack} style={styles.chatSurfaceBackButton}>
            <Text style={styles.chatSurfaceBackButtonText}>‹</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={onOpenProfile} disabled={!onOpenProfile} style={styles.chatSurfaceProfileButton}>
          <View style={styles.chatSurfaceAvatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.chatSurfaceAvatarImage} />
            ) : (
              <View style={styles.chatSurfaceAvatarFallback}>
                <Text style={styles.chatSurfaceAvatarFallbackText}>{avatarFallback}</Text>
              </View>
            )}
          </View>

          <View style={styles.chatSurfaceHeaderCopy}>
            <Text style={styles.chatSurfaceTitle}>{title}</Text>
            <View style={styles.chatSurfaceSubtitleRow}>
              <View style={[styles.chatSurfaceStatusDot, subtitleOnline ? styles.chatSurfaceStatusDotOnline : styles.chatSurfaceStatusDotOffline]} />
              <Text style={[styles.chatSurfaceSubtitle, subtitleOnline && styles.chatSurfaceSubtitleOnline]}>{subtitle}</Text>
            </View>
          </View>
        </Pressable>

        {onReportPress || onHeaderActionPress ? (
          <View style={styles.chatSurfaceActionRow}>
            {onReportPress ? (
              <Pressable onPress={onReportPress} style={styles.chatSurfaceReportButton}>
                <Text style={styles.chatSurfaceReportButtonText}>Melden</Text>
              </Pressable>
            ) : null}
            {onHeaderActionPress ? (
              <Pressable
                onPress={onHeaderActionPress}
                style={[styles.chatSurfaceActionButton, headerActionState === "keep" && styles.chatSurfaceActionButtonActive]}
              >
                <Text style={[styles.chatSurfaceActionIcon, headerActionState === "keep" && styles.chatSurfaceActionIconActive]}>
                  {headerActionState === "keep" ? "♥" : "♡"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={threadRef}
        style={styles.chatSurfaceThreadScroll}
        contentContainerStyle={[
          styles.chatSurfaceThread,
          fullScreen && styles.chatSurfaceThreadFullScreen,
          { paddingBottom: composerBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        scrollEnabled={canScrollThread}
        onLayout={(event) => {
          setThreadViewportHeight(event.nativeEvent.layout.height);
        }}
        onContentSizeChange={(_, height) => {
          setThreadContentHeight(height);
          threadRef.current?.scrollToEnd({ animated: true });
        }}
      >
        <View
          style={[
            styles.chatThreadContent,
            fullScreen && !canScrollThread && messages.length > 0 && styles.chatThreadContentPinned,
          ]}
        >
          {messages.length ? (
            <>
              <View style={styles.chatHistoryStart}>
                <View style={styles.chatHistoryStartLine} />
                <Text style={styles.chatHistoryStartText}>Beginn eures Chats</Text>
                <View style={styles.chatHistoryStartLine} />
              </View>
              <View
                style={[
                  styles.chatThreadMessages,
                  fullScreen && !canScrollThread && styles.chatThreadMessagesPinned,
                ]}
              >
                {messages.map((message) => {
                  const right = message.side === "right";
                  const emojiOnly = message.kind === "text" && isEmojiOnlyMessage(message.text);

                  return (
                    <View
                      key={message.id}
                      style={[styles.chatBubbleRow, right ? styles.chatBubbleRowRight : styles.chatBubbleRowLeft]}
                    >
                      <View style={[styles.chatBubbleStack, right ? styles.chatBubbleStackRight : styles.chatBubbleStackLeft]}>
                        <View
                          style={[
                            styles.chatBubble,
                            right ? styles.chatBubbleRight : styles.chatBubbleLeft,
                            message.kind === "image" && styles.chatBubbleImageWrap,
                            emojiOnly && styles.chatBubbleEmojiOnly,
                            message.sending && styles.chatBubbleSending,
                          ]}
                        >
                          {message.kind === "image" ? (
                            <Image source={{ uri: message.imageUri }} style={styles.chatBubbleImage} />
                          ) : (
                            <Text
                              style={[
                                styles.chatBubbleText,
                                right ? styles.chatBubbleTextRight : styles.chatBubbleTextLeft,
                                emojiOnly && styles.chatBubbleEmojiText,
                              ]}
                            >
                              {message.text}
                            </Text>
                          )}
                        </View>
                        {message.sending ? (
                          <SendingMetaIndicator right={right} />
                        ) : (
                          <View style={[styles.chatBubbleMetaRow, right ? styles.chatBubbleMetaRowRight : styles.chatBubbleMetaRowLeft]}>
                            <Text style={[styles.chatBubbleMeta, right ? styles.chatBubbleMetaRight : styles.chatBubbleMetaLeft]}>
                              {formatMessageTime(message.createdAt)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : emptyStateTitle || emptyStateText ? (
            <View style={styles.chatEmptyStateCard}>
              {emptyStateTitle ? <Text style={styles.chatEmptyStateTitle}>{emptyStateTitle}</Text> : null}
              {emptyStateText ? <Text style={styles.chatEmptyStateText}>{emptyStateText}</Text> : null}
            </View>
          ) : null}
        </View>
        {inlineThreadSupplement}
      </ScrollView>

      {dockedThreadSupplement}

      {composerStatusText ? (
        <View style={styles.chatComposerStatusCard}>
          <Text style={styles.chatComposerStatusText}>{composerStatusText}</Text>
        </View>
      ) : null}

      {composerHidden ? (
        <View
          style={[
            styles.chatComposerLockedBar,
            fullScreen && styles.chatComposerBarFullScreen,
            fullScreen && { paddingBottom: Math.max(bottomInset, 10) },
          ]}
        >
          <Text style={styles.chatComposerLockedText}>{composerLockedText}</Text>
        </View>
      ) : (
        <View
          style={[
            styles.chatComposerBar,
            fullScreen && styles.chatComposerBarFullScreen,
            fullScreen && { paddingBottom: Math.max(bottomInset, 10) },
          ]}
        >
          <View style={styles.chatComposerField}>
            <TextInput
              ref={composerInputRef}
              value={composerValue}
              onChangeText={onComposerChangeText}
              placeholder={composerPlaceholder}
              placeholderTextColor="#867ea9"
              style={styles.chatComposerInput}
              editable={composerInteractive}
              multiline
              returnKeyType="send"
              blurOnSubmit={false}
              onFocus={() => threadRef.current?.scrollToEnd({ animated: true })}
              onSubmitEditing={canSend ? onSend : undefined}
            />
          </View>
          <Pressable
            onPress={() => {
              onSend();
              requestAnimationFrame(() => {
                composerInputRef.current?.focus();
              });
            }}
            disabled={!canSend}
            style={[styles.chatComposerSendButton, !canSend && styles.chatComposerSendButtonDisabled]}
          >
            <Text style={styles.chatComposerSendButtonText}>{composerBusy ? "…" : "↑"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

type OverviewScreenProps = {
  currentTab: OverviewTabId;
  onSelectTab: (tab: OverviewTabId) => void;
  onOpenAccountSwitcher: () => void;
  onSwitchToMatchedAccount: (partner: { userId: string; phoneNumber: string | null; firstName: string }) => Promise<void> | void;
  onEditProfileField: (screenId: EditableProfileScreenId) => void;
  onPauseAccount: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  onDeleteAccount: () => Promise<void> | void;
  accountActionPending: boolean;
  accountActionMessage?: string | null;
  displayName: string;
  currentUserId: string | null;
  profile: RegistrationProfile;
  photoUris: string[];
  introVideoUri: string | null;
  introVideoDurationMs: number | null;
};

function OverviewScreen({
  currentTab,
  onSelectTab,
  onOpenAccountSwitcher,
  onSwitchToMatchedAccount,
  onEditProfileField,
  onPauseAccount,
  onSignOut,
  onDeleteAccount,
  accountActionPending,
  accountActionMessage,
  displayName,
  currentUserId,
  profile,
  photoUris,
  introVideoUri,
  introVideoDurationMs,
}: OverviewScreenProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [phaseTwoOpen, setPhaseTwoOpen] = useState(false);
  const [phaseTwoRounds, setPhaseTwoRounds] = useState<PhaseTwoRoundConfig[]>([]);
  const [phaseTwoRoundIndex, setPhaseTwoRoundIndex] = useState(0);
  const [phaseTwoStage, setPhaseTwoStage] = useState<"starter" | "partner" | "result">("starter");
  const [phaseTwoResults, setPhaseTwoResults] = useState<PhaseTwoRoundResult[]>([]);
  const [phaseTwoSubmitPending, setPhaseTwoSubmitPending] = useState(false);
  const [phaseTwoStarterUserId, setPhaseTwoStarterUserId] = useState<string | null>(null);
  const [phaseTwoPartnerUserId, setPhaseTwoPartnerUserId] = useState<string | null>(null);
  const [phaseTwoStarterName, setPhaseTwoStarterName] = useState("");
  const [phaseTwoPartnerName, setPhaseTwoPartnerName] = useState("");
  const [phaseOneDecisions, setPhaseOneDecisions] = useState<Record<string, "continue" | "new-match">>({});
  const [phaseThreeDecisions, setPhaseThreeDecisions] = useState<Record<string, "stay" | "new-match">>({});
  const [chatDraft, setChatDraft] = useState("");
  const [chatSendPending, setChatSendPending] = useState(false);
  const [chatSendError, setChatSendError] = useState<string | null>(null);
  const [lastSeenPartnerMessageId, setLastSeenPartnerMessageId] = useState<string | null>(null);
  const [pendingPhaseOneDecision, setPendingPhaseOneDecision] = useState<"continue" | "new-match" | null>(null);
  const [pendingPhaseThreeDecision, setPendingPhaseThreeDecision] = useState<"stay" | "new-match" | null>(null);
  const [showChatDecisionModal, setShowChatDecisionModal] = useState(false);
  const [pendingAccountAction, setPendingAccountAction] = useState<"pause" | "signout" | "delete" | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{ uris: string[]; index: number } | null>(null);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isJourneyHydrated, setIsJourneyHydrated] = useState(false);
  const [isAccountStateHydrated, setIsAccountStateHydrated] = useState(false);
  const [remoteJourney, setRemoteJourney] = useState<RemoteJourneyState | null>(null);
  const [sharedChatMessages, setSharedChatMessages] = useState<SharedChatMessage[]>([]);
  const [journeyReleaseAt, setJourneyReleaseAt] = useState<string | null>(null);
  const [seenMatchReleaseAt, setSeenMatchReleaseAt] = useState<string | null>(null);
  const [scheduledMatchNotificationId, setScheduledMatchNotificationId] = useState<string | null>(null);
  const [scheduledMatchNotificationReleaseAt, setScheduledMatchNotificationReleaseAt] = useState<string | null>(null);
  const [phaseOneStarterPenaltyAppliedAt, setPhaseOneStarterPenaltyAppliedAt] = useState<string | null>(null);
  const [phaseTwoPenaltyAppliedAt, setPhaseTwoPenaltyAppliedAt] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<RemoteAccountState | null>(null);
  const [purchasePending, setPurchasePending] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [matchPackPriceLabel, setMatchPackPriceLabel] = useState("3,99 €");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [reportActionPending, setReportActionPending] = useState<"report" | "block" | null>(null);
  const photoViewerRef = useRef<ScrollView | null>(null);
  const pushRegistrationRef = useRef<string | null>(null);
  const phaseOneDecisionRequestRef = useRef(0);
  const phaseThreeDecisionRequestRef = useRef(0);
  const { width: viewportWidth } = useWindowDimensions();
  const photoViewerPageWidth = Math.max(viewportWidth - 36, 1);
  const insets = useSafeAreaInsets();
  const isServerJourneyMode = Boolean(currentUserId);
  const journeyOwnerUserId = currentUserId;

  function applyJourneyState(state: PersistedJourneyState) {
    setRemoteJourney(null);
    setPhaseTwoSubmitPending(false);
    setPendingPhaseOneDecision(null);
    setPendingPhaseThreeDecision(null);
    setJourneyReleaseAt(state.releaseAt);
    setSharedChatMessages(normalizeSharedChatMessages(state.sharedChatMessages));
    setLastSeenPartnerMessageId(state.lastSeenPartnerMessageId ?? null);
    setSeenMatchReleaseAt(state.seenMatchReleaseAt ?? null);
    setScheduledMatchNotificationId(state.scheduledMatchNotificationId ?? null);
    setScheduledMatchNotificationReleaseAt(state.scheduledMatchNotificationReleaseAt ?? null);
    setPhaseOneStarterPenaltyAppliedAt(state.phaseOneStarterPenaltyAppliedAt ?? null);
    setPhaseTwoPenaltyAppliedAt(state.phaseTwoPenaltyAppliedAt ?? null);
    setPhaseOneDecisions(state.phaseOneDecisions);
    setPhaseThreeDecisions(state.phaseThreeDecisions);
    setPhaseTwoOpen(state.phaseTwoOpen);
    setPhaseTwoRounds(state.phaseTwoRounds);
    setPhaseTwoRoundIndex(state.phaseTwoRoundIndex);
    setPhaseTwoStage(state.phaseTwoStage);
    setPhaseTwoResults(state.phaseTwoResults);
    setPhaseTwoStarterUserId(state.phaseTwoStarterUserId);
    setPhaseTwoPartnerUserId(state.phaseTwoPartnerUserId);
    setPhaseTwoStarterName(state.phaseTwoStarterName);
    setPhaseTwoPartnerName(state.phaseTwoPartnerName);
  }

  function applyStoredJourneyClientState(state: PersistedJourneyState) {
    setLastSeenPartnerMessageId(state.lastSeenPartnerMessageId ?? null);
    setSeenMatchReleaseAt(state.seenMatchReleaseAt ?? null);
    setScheduledMatchNotificationId(state.scheduledMatchNotificationId ?? null);
    setScheduledMatchNotificationReleaseAt(state.scheduledMatchNotificationReleaseAt ?? null);
  }

  function applyRemoteJourneyState(state: RemoteJourneyState) {
    setRemoteJourney(state);
    setPhaseTwoSubmitPending(false);
    setJourneyReleaseAt(state.releaseAt);
    setSharedChatMessages(currentUserId ? mapRemoteJourneyMessages(state.sharedChatMessages, currentUserId) : []);
    setPhaseOneStarterPenaltyAppliedAt(state.phaseOneStarterPenaltyAppliedAt);
    setPhaseTwoPenaltyAppliedAt(state.phaseTwoPenaltyAppliedAt);
    const nextPhaseOneDecisions = { ...state.phaseOneDecisions };
    const nextPhaseThreeDecisions = { ...state.phaseThreeDecisions };
    const journeyIdentityChanged = state.matchId !== remoteJourney?.matchId || state.releaseAt !== journeyReleaseAt;

    if (currentUserId) {
      const confirmedPhaseOneDecision = nextPhaseOneDecisions[currentUserId] ?? null;
      const confirmedPhaseThreeDecision = nextPhaseThreeDecisions[currentUserId] ?? null;

      if (pendingPhaseOneDecision) {
        if (journeyIdentityChanged || confirmedPhaseOneDecision === pendingPhaseOneDecision) {
          setPendingPhaseOneDecision(null);
        } else {
          nextPhaseOneDecisions[currentUserId] = pendingPhaseOneDecision;
        }
      }

      if (pendingPhaseThreeDecision) {
        if (journeyIdentityChanged || confirmedPhaseThreeDecision === pendingPhaseThreeDecision) {
          setPendingPhaseThreeDecision(null);
        } else {
          nextPhaseThreeDecisions[currentUserId] = pendingPhaseThreeDecision;
        }
      }
    }

    setPhaseOneDecisions(nextPhaseOneDecisions);
    setPhaseThreeDecisions(nextPhaseThreeDecisions);
    setPhaseTwoRounds(state.phaseTwoRounds);
    setPhaseTwoRoundIndex(state.phaseTwoRoundIndex);
    setPhaseTwoStage(state.phaseTwoStage);
    setPhaseTwoResults(state.phaseTwoResults);
    setPhaseTwoStarterUserId(state.phaseTwoStarterUserId);
    setPhaseTwoPartnerUserId(state.phaseTwoPartnerUserId);
    setPhaseTwoStarterName(state.phaseTwoStarterName);
    setPhaseTwoPartnerName(state.phaseTwoPartnerName);
  }

  function buildInitialJourneyState(ownerUserId: string, now = new Date()): PersistedJourneyState {
    return {
      ownerUserId,
      releaseAt: createInitialReleaseAt(now).toISOString(),
      sharedChatMessages: [],
      lastSeenPartnerMessageId: null,
      seenMatchReleaseAt: null,
      scheduledMatchNotificationId: null,
      scheduledMatchNotificationReleaseAt: null,
      phaseOneStarterPenaltyAppliedAt: null,
      phaseTwoPenaltyAppliedAt: null,
      phaseOneDecisions: {},
      phaseThreeDecisions: {},
      phaseTwoOpen: false,
      phaseTwoRounds: [],
      phaseTwoRoundIndex: 0,
      phaseTwoStage: "starter",
      phaseTwoResults: [],
      phaseTwoStarterUserId: null,
      phaseTwoPartnerUserId: null,
      phaseTwoStarterName: "",
      phaseTwoPartnerName: "",
    };
  }

  function resetJourneyState(ownerUserId: string, releaseAt = createInitialReleaseAt(new Date()).toISOString()) {
    applyJourneyState({
      ownerUserId,
      releaseAt,
      sharedChatMessages: [],
      lastSeenPartnerMessageId: null,
      seenMatchReleaseAt: null,
      scheduledMatchNotificationId: null,
      scheduledMatchNotificationReleaseAt: null,
      phaseOneStarterPenaltyAppliedAt: null,
      phaseTwoPenaltyAppliedAt: null,
      phaseOneDecisions: {},
      phaseThreeDecisions: {},
      phaseTwoOpen: false,
      phaseTwoRounds: [],
      phaseTwoRoundIndex: 0,
      phaseTwoStage: "starter",
      phaseTwoResults: [],
      phaseTwoStarterUserId: null,
      phaseTwoPartnerUserId: null,
      phaseTwoStarterName: "",
      phaseTwoPartnerName: "",
    });
  }

  async function refreshAccountState(userId: string) {
    const remoteAccount = await fetchRemoteAccountState(userId);
    setAccountState(remoteAccount);
    return remoteAccount;
  }

  async function refreshJourneyState(userId: string) {
    const journey = await fetchRemoteJourney(userId);
    applyRemoteJourneyState(journey);
    return journey;
  }

  async function waitForGrantedMatchPack(userId: string, previousCredits: number) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1500);
      });

      try {
        const updatedAccount = await refreshAccountState(userId);

        if (updatedAccount.paidMatchCredits > previousCredits) {
          return updatedAccount;
        }
      } catch {
        // Keep polling briefly while the webhook is still catching up.
      }
    }

    return null;
  }

  async function handleBuyMatchPack() {
    if (!currentUserId) {
      setPurchaseMessage("Bitte zuerst normal eingeloggt sein.");
      return;
    }

    const activeUserId = currentUserId;

    if (!hasRevenueCatConfig()) {
      setPurchaseMessage("Der Store-Schlüssel fehlt noch. Sobald RevenueCat verbunden ist, kannst du hier direkt testen.");
      return;
    }

    setPurchasePending(true);
    setPurchaseMessage(null);

    try {
      await syncRevenueCatUser(activeUserId);
      const previousCredits = accountState?.paidMatchCredits ?? 0;
      const product = await getMatchPackStoreProduct();

      if (!product) {
        setPurchaseMessage("Das Match-Paket ist im Store noch nicht bereit. Lege zuerst das Produkt `match_pack_8` an.");
        return;
      }

      await purchaseMatchPackProduct(product);

      const updatedAccount = await waitForGrantedMatchPack(activeUserId, previousCredits);

      if (updatedAccount) {
        setAccountState(updatedAccount);
        setPurchaseMessage("8 weitere Matches wurden freigeschaltet.");
      } else {
        setPurchaseMessage("Der Kauf wurde erfasst. Choice schreibt die 8 Matches gleich gut, sobald der Webhook angekommen ist.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const normalizedMessage = message.toLocaleLowerCase("de-DE");

      if (normalizedMessage.includes("cancel")) {
        setPurchaseMessage("Kauf abgebrochen.");
      } else {
        setPurchaseMessage("Der Kauf konnte gerade nicht abgeschlossen werden.");
      }
    } finally {
      setPurchasePending(false);
    }
  }

  const featuredProfile = useMemo<DemoProfile>(() => {
    const remotePartnerProfile = mapRemoteJourneyPartnerToDemoProfile(remoteJourney?.partner ?? null);

    if (remotePartnerProfile) {
      return remotePartnerProfile;
    }

    return demoProfiles[0];
  }, [remoteJourney?.partner]);
  const penaltyPoints = accountState?.penaltyPoints ?? 0;
  const penaltyRecoveryWindowDays = accountState?.penaltyRecoveryWindowDays ?? 3;
  const maxPenaltyPoints = 3;
  const remainingPenaltyPoints = Math.max(maxPenaltyPoints - penaltyPoints, 0);
  const accountPaused = accountState?.accountPaused ?? false;
  const accountBanned = accountState?.accountBanned ?? false;
  const canBuyMatchPack = Boolean(currentUserId && !accountPaused && !accountBanned && hasRevenueCatConfig());
  const activePartnerUserId = remoteJourney?.partner?.userId ?? null;
  const hasActiveChat = Boolean(currentUserId && remoteJourney?.partner);
  const includedMatchLimit = accountState?.includedMatchLimit ?? 8;
  const paidMatchCredits = accountState?.paidMatchCredits ?? 0;
  const frozenPaidMatchCredits = accountState?.frozenPaidMatchCredits ?? 0;
  const forfeitedPaidMatchCredits = accountState?.forfeitedPaidMatchCredits ?? 0;
  const hasPaidMatchAccess = accountState?.hasPaidMatchAccess ?? false;
  const totalMatchCount = accountState?.totalMatchCount ?? 0;
  const consumedIncludedMatchCount = Math.min(totalMatchCount, includedMatchLimit);
  const totalMatchCountLabel = `${totalMatchCount} Match${totalMatchCount === 1 ? "" : "es"}`;
  const recentPenaltyEntries = accountState?.recentPenalties ?? [];
  const activePenaltyEntries = useMemo(() => {
    const latestByReason = new Map<string, { id: string; createdAtMs: number }>();
    const recoveryWindowMs = penaltyRecoveryWindowDays * 24 * 60 * 60 * 1000;

    for (const entry of recentPenaltyEntries) {
      const createdAtMs = new Date(entry.createdAt).getTime();

      if (!Number.isFinite(createdAtMs)) {
        continue;
      }

      const key = buildPenaltyEntryGroupKey(entry);
      const existing = latestByReason.get(key);

      if (!existing || createdAtMs > existing.createdAtMs) {
        latestByReason.set(key, {
          id: entry.id,
          createdAtMs,
        });
      }
    }

    const nextEntries: Array<(typeof recentPenaltyEntries)[number] & { expiresAtMs: number }> = [];

    for (const entry of recentPenaltyEntries) {
      const createdAtMs = new Date(entry.createdAt).getTime();

      if (!Number.isFinite(createdAtMs)) {
        continue;
      }

      const latestEntry = latestByReason.get(buildPenaltyEntryGroupKey(entry));

      if (!latestEntry || latestEntry.id !== entry.id) {
        continue;
      }

      if (currentTime.getTime() - createdAtMs < recoveryWindowMs) {
        nextEntries.push({
          ...entry,
          expiresAtMs: createdAtMs + recoveryWindowMs,
        });
      }
    }

    return nextEntries.sort((entryA, entryB) => {
      const entryATime = new Date(entryA.createdAt).getTime();
      const entryBTime = new Date(entryB.createdAt).getTime();
      return entryBTime - entryATime;
    });
  }, [currentTime, penaltyRecoveryWindowDays, recentPenaltyEntries]);
  const profileAge = calculateAgeFromProfile(profile);
  const profileSelfDescription = profile.selfDescription ? getOptionLabel(selfDescriptionOptions, profile.selfDescription) : "";
  const profileIdentity = profile.identity ? getOptionLabel(identityOptions, profile.identity) : "";
  const profileIntent = profile.datingIntent ? getOptionLabel(datingIntentOptions, profile.datingIntent) : "";
  const profilePronouns =
    profile.pronouns && profile.pronouns !== "keine-angabe" ? getOptionLabel(pronounOptions, profile.pronouns) : "";
  const profileMetaParts = [profile.city || "Berlin", String(profileAge ?? 27), profilePronouns].filter(Boolean);
  const awardViewerPhotoUri =
    photoUris.find((entry) => entry?.trim())
    ?? featuredProfile.imageUri;
  const awardPartnerPhotoUri =
    featuredProfile.photoUris.find((entry) => entry?.trim())
    ?? featuredProfile.imageUri;
  const profileVideoLabel = introVideoDurationMs ? `${formatVideoDurationLabel(introVideoDurationMs)} hinterlegt` : "1 Video hinterlegt";
  const profileFacts = [
    { label: "Vorname", value: displayName, editId: "firstName" as const },
    { label: "Alter", value: profileAge ? `${profileAge}` : "", editId: "birthday" as const },
    { label: "Wohnort", value: profile.city, editId: "city" as const },
    { label: "So bist du eher", value: profileSelfDescription, editId: "selfDescription" as const },
    { label: "Identität", value: profileIdentity, editId: "identity" as const },
    { label: "Suche", value: profile.lookingFor, editId: "lookingFor" as const },
    { label: "Daraus darf werden", value: profileIntent, editId: "datingIntent" as const },
    {
      label: "Wunschalter",
      value: profile.ageRangeMin && profile.ageRangeMax ? `${profile.ageRangeMin}–${profile.ageRangeMax}` : "",
      editId: "ageRange" as const,
    },
    { label: "Pronomen", value: profilePronouns, editId: "pronouns" as const },
  ].filter((entry) => entry.value);
  const featuredProfileSelfDescription = featuredProfile.selfDescription
    ? getOptionLabel(selfDescriptionOptions, featuredProfile.selfDescription)
    : "";
  const featuredProfileIdentity = getOptionLabel(identityOptions, featuredProfile.identity);
  const featuredProfileIntent = getOptionLabel(datingIntentOptions, featuredProfile.datingIntent);
  const featuredProfilePronouns =
    featuredProfile.pronouns && featuredProfile.pronouns !== "keine-angabe"
      ? getOptionLabel(pronounOptions, featuredProfile.pronouns)
      : "";
  const featuredProfileDistanceLabel = formatDistanceLabel(estimateDistanceKm(profile.city || "Berlin", featuredProfile.city));
  const viewerAgeRangeMin = Number(profile.ageRangeMin || 0);
  const viewerAgeRangeMax = Number(profile.ageRangeMax || 0);
  const partnerAgeRangeMin = Number(featuredProfile.ageRangeMin || 0);
  const partnerAgeRangeMax = Number(featuredProfile.ageRangeMax || 0);
  const sharedMatchInterests = profile.interests.filter((interest) => featuredProfile.interests.includes(interest));
  const choiceMatchReasons = getChoiceMatchReasons({
    viewerCity: profile.city || "Berlin",
    partnerCity: featuredProfile.city,
    distanceLabel: featuredProfileDistanceLabel,
    sharedInterests: sharedMatchInterests,
    viewerSelfDescription: profile.selfDescription,
    partnerSelfDescription: featuredProfile.selfDescription,
    viewerDatingIntent: profile.datingIntent,
    partnerDatingIntent: featuredProfile.datingIntent,
    viewerAgeRangeMin,
    viewerAgeRangeMax,
    partnerAgeRangeMin,
    partnerAgeRangeMax,
    viewerAge: profileAge,
    partnerAge: featuredProfile.age,
  });
  const featuredProfileMeta = [featuredProfile.city, featuredProfileDistanceLabel, String(featuredProfile.age), featuredProfilePronouns].filter(Boolean).join(" • ");
  const featuredProfileFacts = [
    { label: "So ist die Person eher", value: featuredProfileSelfDescription },
    { label: "Wohnort", value: [featuredProfile.city, featuredProfileDistanceLabel].filter(Boolean).join(" • ") },
    { label: "Identität", value: featuredProfileIdentity },
    { label: "Suche", value: featuredProfile.lookingFor },
    { label: "Daraus darf werden", value: featuredProfileIntent },
    { label: "Wunschalter", value: `${featuredProfile.ageRangeMin}–${featuredProfile.ageRangeMax}` },
    { label: "Pronomen", value: featuredProfilePronouns },
  ].filter((entry) => entry.value);
  const penaltyReasons = [
    "Bestätigte Meldung wegen beleidigendem, sexualisiertem oder respektlosem Verhalten.",
    "Du schreibst nicht an, obwohl Choice festgelegt hat, dass du den Chat eröffnen sollst.",
    "Du spielst Phase 2 nicht, obwohl du gerade mit der laufenden Runde dran bist.",
  ];
  const phaseOneViewerUserId = currentUserId ?? "choice_primary_demo";
  const phaseOnePartnerUserId = activePartnerUserId ?? "choice_partner_placeholder";
  const phaseOneStarterUserId = remoteJourney?.phaseOneStarterUserId ?? chooseStableStarterUserId(phaseOneViewerUserId, phaseOnePartnerUserId);
  const phaseOneStarterName = phaseOneStarterUserId === phaseOneViewerUserId ? displayName : featuredProfile.firstName;
  const phaseOneViewerStarts = phaseOneStarterUserId === phaseOneViewerUserId;
  const phaseOneChatStarted = sharedChatMessages.length > 0;
  const phaseSchedule = useMemo(
    () => resolveJourneyPhaseSchedule(remoteJourney, journeyReleaseAt ? new Date(journeyReleaseAt) : currentTime),
    [currentTime, journeyReleaseAt, remoteJourney],
  );
  const matchReleaseTime = phaseSchedule.release;
  const remainingIncludedMatches = accountState?.remainingIncludedMatches ?? Math.max(includedMatchLimit - consumedIncludedMatchCount, 0);
  const decisionDeadline = phaseSchedule.decisionDeadline;
  const phaseTwoStartTime = phaseSchedule.phaseTwoStart;
  const phaseThreeStartTime = phaseSchedule.phaseThreeStart;
  const phaseFourStartTime = phaseSchedule.phaseFourStart;
  const phaseFiveStartTime = phaseSchedule.phaseFiveStart;
  const releaseClockLabel = formatClockTime(matchReleaseTime);
  const decisionClockLabel = formatClockTime(decisionDeadline);
  const phaseTwoClockLabel = formatClockTime(phaseTwoStartTime);
  const phaseThreeClockLabel = formatClockTime(phaseThreeStartTime);
  const phaseFourClockLabel = formatClockTime(phaseFourStartTime);
  const phaseFiveClockLabel = formatClockTime(phaseFiveStartTime);
  const phaseOneViewerDecision: "continue" | "new-match" | "undecided" =
    phaseOneDecisions[phaseOneViewerUserId] ?? "undecided";
  const phaseOnePartnerDecision: "continue" | "new-match" | "undecided" =
    phaseOneDecisions[phaseOnePartnerUserId] ?? "undecided";
  const phaseOneViewerKeepsMatch = phaseOneViewerDecision !== "new-match";
  const phaseOnePartnerKeepsMatch = phaseOnePartnerDecision !== "new-match";
  const phaseOneBothContinue = phaseOneViewerKeepsMatch && phaseOnePartnerKeepsMatch;
  const phaseOneCanAdvanceToPhaseTwo = phaseOneBothContinue && phaseOneChatStarted;
  const phaseOneAnyDeclined = phaseOneViewerDecision === "new-match" || phaseOnePartnerDecision === "new-match";
  const phaseOneWindowOpen = currentTime >= matchReleaseTime && currentTime < decisionDeadline;
  const phaseOneBeforeRelease = currentTime < matchReleaseTime;
  const phaseOneClosed = currentTime >= decisionDeadline;
  const phaseOneViewerSelectedContinue = phaseOneViewerDecision === "continue";
  const phaseOneViewerSelectedNewMatch = phaseOneViewerDecision === "new-match";
  const phaseOnePartnerSelectedContinue = phaseOnePartnerDecision === "continue";
  const phaseOnePartnerSelectedNewMatch = phaseOnePartnerDecision === "new-match";
  const phaseOneViewerUndecided = !phaseOneViewerSelectedContinue && !phaseOneViewerSelectedNewMatch;
  const phaseOnePartnerUndecided = !phaseOnePartnerSelectedContinue && !phaseOnePartnerSelectedNewMatch;
  const phaseOneWaitingOnPartner =
    phaseOneWindowOpen
    && phaseOneViewerSelectedContinue
    && phaseOnePartnerUndecided;
  const phaseOnePartnerWaitingOnViewer =
    phaseOneWindowOpen
    && phaseOneViewerUndecided
    && phaseOnePartnerSelectedContinue;
  const currentReleaseKey = journeyReleaseAt ?? matchReleaseTime.toISOString();
  const notificationSyncMinute = Math.floor(currentTime.getTime() / 60_000);
  const showFreshMatchNotice =
    hasActiveChat
    && !phaseOneBeforeRelease
    && seenMatchReleaseAt !== currentReleaseKey;
  const chatTitle = hasActiveChat
    ? phaseOneBeforeRelease
      ? "Dein erstes Match"
      : featuredProfile.firstName
    : "Dein nächstes Match";
  const chatSubtitle = hasActiveChat
    ? phaseOneBeforeRelease
      ? `wird um ${releaseClockLabel} freigegeben`
      : "online"
    : "zuletzt online vor 12 Min.";
  const chatSubtitleOnline = hasActiveChat && !phaseOneBeforeRelease;
  const phaseTwoAvailableByTime = currentTime >= phaseTwoStartTime;
  const remainingDecisionMs = decisionDeadline.getTime() - currentTime.getTime();
  const decisionCountdownLabel = formatDurationLabel(remainingDecisionMs);
  const decisionCountdownText = remainingDecisionMs > 0 ? `Noch ${decisionCountdownLabel} bis ${decisionClockLabel}` : "Entscheidungszeit heute vorbei";
  const nextMatchReleaseLabel = phaseOneBeforeRelease
    ? matchReleaseTime.toDateString() === currentTime.toDateString()
      ? `heute um ${releaseClockLabel}`
      : `morgen um ${releaseClockLabel}`
    : null;
  const nextScheduledMatchReleaseTime = createInitialReleaseAt(currentTime);
  const nextScheduledMatchDecisionDeadline = getDecisionDeadline(nextScheduledMatchReleaseTime);
  const nextScheduledMatchReleaseClockLabel = formatClockTime(nextScheduledMatchReleaseTime);
  const nextScheduledMatchDecisionClockLabel = formatClockTime(nextScheduledMatchDecisionDeadline);
  const nextScheduledMatchCountdownMs = nextScheduledMatchReleaseTime.getTime() - currentTime.getTime();
  const nextScheduledMatchCountdownLabel = formatDurationLabel(nextScheduledMatchCountdownMs);
  const nextScheduledMatchReleaseLabel =
    nextScheduledMatchReleaseTime.toDateString() === currentTime.toDateString()
      ? `heute um ${nextScheduledMatchReleaseClockLabel}`
      : `morgen um ${nextScheduledMatchReleaseClockLabel}`;
  const phaseTwoStartsInLabel = formatDurationLabel(phaseTwoStartTime.getTime() - currentTime.getTime());
  const phaseTwoStartLabel = formatRelativeDateTimeLabel(phaseTwoStartTime, currentTime);
  const phaseThreeStartsInLabel = formatDurationLabel(phaseThreeStartTime.getTime() - currentTime.getTime());
  const phaseThreeStartLabel = formatRelativeDateTimeLabel(phaseThreeStartTime, currentTime);
  const renderedChatMessages = useMemo(
    () => (hasActiveChat ? mapSharedChatMessagesForViewer(sharedChatMessages) : []),
    [hasActiveChat, sharedChatMessages],
  );
  const latestPartnerMessageId = useMemo(() => {
    for (let index = sharedChatMessages.length - 1; index >= 0; index -= 1) {
      const message = sharedChatMessages[index];

      if (message.author === "partner") {
        return message.id;
      }
    }

    return null;
  }, [sharedChatMessages]);
  const unreadPartnerMessageCount = useMemo(() => {
    const partnerMessages = sharedChatMessages.filter((message) => message.author === "partner");

    if (!partnerMessages.length) {
      return 0;
    }

    if (!lastSeenPartnerMessageId) {
      return partnerMessages.length;
    }

    const seenIndex = partnerMessages.findIndex((message) => message.id === lastSeenPartnerMessageId);

    if (seenIndex < 0) {
      return partnerMessages.length;
    }

    return Math.max(partnerMessages.length - seenIndex - 1, 0);
  }, [lastSeenPartnerMessageId, sharedChatMessages]);
  const latestSharedChatMessage = sharedChatMessages[sharedChatMessages.length - 1];
  const latestSharedChatPreview = getSharedChatMessagePreview(latestSharedChatMessage);
  const phaseFiveViewerHasWritten = useMemo(
    () => sharedChatMessages.some((message) => (
      message.author === "primary"
      && new Date(message.createdAt).getTime() >= phaseFiveStartTime.getTime()
    )),
    [phaseFiveStartTime, sharedChatMessages],
  );
  const chatPreviewText = latestSharedChatPreview
    ?? (hasActiveChat
      ? phaseOneBeforeRelease
        ? "Choice zeigt dir vorher noch nicht, wer dein erstes Match wird."
        : `Choice hat ${phaseOneStarterName} ausgewählt, den Chat zu eröffnen.`
      : "Choice hat gerade noch kein Match für dich freigegeben.");
  const remotePhaseThreeSuggestedProfile = useMemo(
    () => mapRemoteJourneyPartnerToDemoProfile(remoteJourney?.phaseThreeSuggestion ?? null),
    [remoteJourney?.phaseThreeSuggestion],
  );
  const phaseThreeSuggestedProfile = useMemo<DemoProfile | null>(() => {
    if (remoteJourney) {
      return remotePhaseThreeSuggestedProfile;
    }

    const excludedIds = new Set<string>([featuredProfile.id, activePartnerUserId ?? ""]);
    const viewerAge = profileAge ?? Number(profile.ageRangeMin || 0);
    const viewerAgeRangeMin = Number(profile.ageRangeMin || 0);
    const viewerAgeRangeMax = Number(profile.ageRangeMax || 0);

    if (!viewerAge || !viewerAgeRangeMin || !viewerAgeRangeMax) {
      return null;
    }

    const viewerProfile = {
      city: profile.city || "Berlin",
      interests: profile.interests,
      pronouns: profile.pronouns || "keine-angabe",
      lookingFor: profile.lookingFor || "Alle",
      datingIntent: profile.datingIntent,
      age: viewerAge,
      ageRangeMin: viewerAgeRangeMin,
      ageRangeMax: viewerAgeRangeMax,
    };

    const compatibleCandidates = demoProfiles
      .filter((entry) => !excludedIds.has(entry.id))
      .filter((entry) => isLocallyCompatible(viewerProfile, entry))
      .map((entry) => ({
        entry,
        score: calculateLocalCandidateScore(viewerProfile, entry),
      }))
      .sort((candidateA, candidateB) => {
        if (candidateB.score !== candidateA.score) {
          return candidateB.score - candidateA.score;
        }

        return candidateA.entry.firstName.localeCompare(candidateB.entry.firstName, "de-DE");
      });

    return compatibleCandidates[0]?.entry ?? null;
  }, [
    activePartnerUserId,
    featuredProfile.id,
    remoteJourney,
    remotePhaseThreeSuggestedProfile,
    profile.ageRangeMax,
    profile.ageRangeMin,
    profile.city,
    profile.datingIntent,
    profile.interests,
    profile.lookingFor,
    profile.pronouns,
    profileAge,
  ]);
  const phaseThreeSuggestedDistanceLabel = phaseThreeSuggestedProfile
    ? formatDistanceLabel(estimateDistanceKm(profile.city || "Berlin", phaseThreeSuggestedProfile.city))
    : "";
  const phaseThreeSuggestedNewMatchLabel = phaseThreeSuggestedProfile?.firstName ?? "ein neues Match";
  const phaseThreeSuggestedWithMatchLabel = phaseThreeSuggestedProfile?.firstName ?? "einem neuen Match";
  const phaseTwoViewerUserId = currentUserId ?? "choice_local_viewer";
  const phaseTwoFallbackPartnerUserId = activePartnerUserId ?? "choice_partner_placeholder";
  const phaseTwoAssignedStarterUserId = remoteJourney?.phaseTwoStarterUserId ?? chooseStableStarterUserId(phaseTwoViewerUserId, phaseTwoFallbackPartnerUserId);
  const phaseTwoAssignedPartnerUserId =
    phaseTwoAssignedStarterUserId === phaseTwoViewerUserId ? phaseTwoFallbackPartnerUserId : phaseTwoViewerUserId;
  const phaseTwoAssignedStarterName =
    phaseTwoAssignedStarterUserId === phaseTwoViewerUserId ? displayName : featuredProfile.firstName;
  const phaseTwoAssignedPartnerName =
    phaseTwoAssignedPartnerUserId === phaseTwoViewerUserId ? displayName : featuredProfile.firstName;
  const phaseTwoCurrentRound = phaseTwoRounds[phaseTwoRoundIndex] ?? null;
  const phaseTwoCurrentResult = phaseTwoResults[phaseTwoRoundIndex] ?? null;
  const phaseTwoTotalRounds = phaseTwoRounds.length;
  const phaseTwoProgressRatio =
    phaseTwoStage === "result"
      ? 1
      : phaseTwoTotalRounds
        ? phaseTwoStage === "starter"
          ? phaseTwoRoundIndex / (phaseTwoTotalRounds * 2)
          : (phaseTwoTotalRounds + phaseTwoRoundIndex) / (phaseTwoTotalRounds * 2)
        : 0;
  const phaseTwoHasStarted = phaseTwoRounds.length > 0;
  const phaseTwoEffectiveStarterUserId = phaseTwoHasStarted
    ? phaseTwoStarterUserId ?? phaseTwoAssignedStarterUserId
    : phaseTwoAssignedStarterUserId;
  const phaseTwoEffectivePartnerUserId = phaseTwoHasStarted
    ? phaseTwoPartnerUserId ?? phaseTwoAssignedPartnerUserId
    : phaseTwoAssignedPartnerUserId;
  const phaseTwoEffectiveStarterName = phaseTwoHasStarted
    ? phaseTwoStarterName || phaseTwoAssignedStarterName
    : phaseTwoAssignedStarterName;
  const phaseTwoEffectivePartnerName = phaseTwoHasStarted
    ? phaseTwoPartnerName || phaseTwoAssignedPartnerName
    : phaseTwoAssignedPartnerName;
  const phaseTwoCurrentResponderUserId = phaseTwoHasStarted
    ? (phaseTwoStage === "starter" ? phaseTwoEffectiveStarterUserId : phaseTwoEffectivePartnerUserId)
    : phaseTwoEffectiveStarterUserId;
  const phaseTwoCurrentResponderName = phaseTwoHasStarted
    ? (phaseTwoStage === "starter" ? phaseTwoEffectiveStarterName : phaseTwoEffectivePartnerName)
    : phaseTwoEffectiveStarterName;
  const phaseTwoDeadlinePassed = currentTime >= phaseThreeStartTime;
  const phaseTwoViewerCanAnswer =
    phaseTwoStage !== "result"
    && Boolean(phaseTwoCurrentResponderUserId)
    && phaseTwoViewerUserId === phaseTwoCurrentResponderUserId
    && !phaseTwoDeadlinePassed
    && (phaseTwoHasStarted || (phaseOneCanAdvanceToPhaseTwo && phaseTwoAvailableByTime));
  const phaseTwoCompletedRounds = phaseTwoResults.filter((entry) => entry.personBLabel).length;
  const phaseTwoCompatibility = phaseTwoCompletedRounds
    ? Math.round(
        phaseTwoResults
          .filter((entry) => entry.personBLabel)
          .reduce((sum, entry) => sum + entry.compatibility, 0) / phaseTwoCompletedRounds,
      )
    : 0;
  const phaseTwoReady = phaseTwoHasStarted && phaseTwoRounds.length > 0 && phaseTwoCompletedRounds === phaseTwoRounds.length;
  const phaseTwoOverdue = phaseOneCanAdvanceToPhaseTwo && !phaseTwoReady && phaseTwoDeadlinePassed;
  const phaseTwoPenaltyJustApplied = phaseTwoPenaltyAppliedAt === currentReleaseKey;
  const phaseThreeQualified = phaseTwoReady && phaseTwoCompatibility > PHASE_THREE_THRESHOLD;
  const phaseThreeUnlocked =
    currentTime >= phaseThreeStartTime
    && phaseThreeQualified;
  const phaseThreeWindowOpen = phaseThreeUnlocked && currentTime < phaseFourStartTime;
  const phaseThreeViewerDecisionRaw = phaseThreeDecisions[phaseOneViewerUserId];
  const phaseThreeViewerDecision: "stay" | "new-match" | "undecided" =
    phaseThreeViewerDecisionRaw ?? "undecided";
  const phaseThreePartnerDecision: "stay" | "new-match" | "undecided" =
    phaseThreeDecisions[phaseOnePartnerUserId] ?? "undecided";
  const phaseThreeViewerStayedExplicitly = phaseThreeViewerDecision === "stay";
  const phaseThreePartnerStayedExplicitly = phaseThreePartnerDecision === "stay";
  const phaseThreeViewerKeepsChat = phaseThreeViewerDecision !== "new-match";
  const phaseThreePartnerKeepsChat = phaseThreePartnerDecision !== "new-match";
  const phaseThreeBothStay = phaseThreeViewerKeepsChat && phaseThreePartnerKeepsChat;
  const phaseThreeBothStayExplicit = phaseThreeViewerStayedExplicitly && phaseThreePartnerStayedExplicitly;
  const phaseThreeAnyLeave = phaseThreeViewerDecision === "new-match" || phaseThreePartnerDecision === "new-match";
  const phaseFourUnlocked = currentTime >= phaseFourStartTime && phaseThreeQualified;
  const phaseFourWindowLocked = phaseFourUnlocked && currentTime < phaseFiveStartTime;
  const phaseFiveUnlocked =
    phaseThreeQualified
    && phaseThreeBothStay
    && currentTime >= phaseFiveStartTime;
  const phaseFiveRestartSelected =
    phaseThreeQualified
    && currentTime >= phaseFiveStartTime
    && phaseThreeAnyLeave;
  const phaseFiveViewerSelectedNewMatch =
    phaseFiveRestartSelected
    && phaseThreeViewerDecision === "new-match";
  const phaseFivePartnerSelectedNewMatch =
    phaseFiveRestartSelected
    && phaseThreePartnerDecision === "new-match";
  const phaseThreeDecisionOpen = phaseThreeUnlocked && currentTime < phaseFiveStartTime;
  const phaseThreeDecisionPending =
    phaseThreeDecisionOpen
    && !phaseThreeAnyLeave
    && (!phaseThreeViewerStayedExplicitly || !phaseThreePartnerStayedExplicitly);
  const phaseThreeStartsLater = phaseThreeQualified && !phaseThreeDecisionOpen && currentTime < phaseThreeStartTime;
  const viewerSelectedNewMatch =
    (phaseOneWindowOpen && phaseOneViewerDecision === "new-match")
    || (phaseThreeUnlocked && phaseThreeViewerDecision === "new-match");
  const phaseFourStartsInLabel = formatDurationLabel(phaseFourStartTime.getTime() - currentTime.getTime());
  const phaseThreeWindowFinished =
    phaseThreeQualified
    && currentTime >= phaseFiveStartTime
    && !phaseFiveUnlocked
    && !phaseFiveRestartSelected;
  const phaseTwoChatUnlocked =
    hasActiveChat
    && (
      (
        phaseTwoReady
        && currentTime >= phaseTwoStartTime
        && currentTime < phaseThreeStartTime
        && (!phaseThreeDecisionOpen || phaseThreeViewerKeepsChat)
      )
      || (phaseThreeWindowOpen && phaseThreeViewerKeepsChat)
    );
  const chatHeaderActionState = hasActiveChat
    && (
      phaseTwoReady
        ? phaseThreeViewerKeepsChat
        : phaseOneViewerDecision === "continue"
    )
    ? "keep"
    : "idle";
  const chatListDeadlinePillText = phaseOneBeforeRelease
    ? nextMatchReleaseLabel === `heute um ${releaseClockLabel}`
      ? `heute ${releaseClockLabel}`
      : `morgen ${releaseClockLabel}`
    : phaseFiveUnlocked
      ? "Phase 5"
      : phaseFiveRestartSelected
        ? "Neustart gewählt"
      : phaseFourWindowLocked
        ? "Phase 4"
      : phaseThreeDecisionOpen
          ? "Phase 3"
      : phaseThreeStartsLater
          ? `P3 ${phaseThreeStartsInLabel}`
        : phaseThreeWindowFinished
          ? phaseThreeAnyLeave
            ? "Neustart gewählt"
            : "Phase 4 vorbei"
        : phaseTwoChatUnlocked || phaseTwoHasStarted || (phaseOneCanAdvanceToPhaseTwo && phaseTwoAvailableByTime)
            ? "Phase 2"
            : remainingDecisionMs > 0
              ? decisionCountdownLabel
              : "Phase 1 vorbei";
  const chatListDeadlinePillEnded =
    !phaseOneBeforeRelease
    && !phaseTwoChatUnlocked
    && !phaseTwoHasStarted
    && !phaseOneCanAdvanceToPhaseTwo
    && remainingDecisionMs <= 0;
  const chatHintText = hasActiveChat
    ? phaseOneBeforeRelease
      ? `Dein erstes Match öffnet ${nextMatchReleaseLabel}.`
      : phaseOneViewerSelectedNewMatch
        ? "Du hast Neues Match gewählt. Für dich bleibt dieser Chat jetzt zu."
      : phaseOnePartnerSelectedNewMatch && !phaseTwoChatUnlocked && !phaseOneClosed
        ? `${featuredProfile.firstName} hat Neues Match gewählt. Du kannst hier noch schreiben, aber ${featuredProfile.firstName} schreibt nicht weiter und dieses Match endet um ${decisionClockLabel}.`
      : phaseOneWaitingOnPartner
        ? `Du hast aktiv Weiter gewählt. Wenn ${featuredProfile.firstName} nichts ändert, startet Phase 2 ${phaseTwoStartLabel}.`
      : phaseOnePartnerWaitingOnViewer
        ? `${featuredProfile.firstName} hat aktiv Weiter gewählt. Wenn du nichts änderst, startet Phase 2 ${phaseTwoStartLabel}.`
      : phaseFiveViewerSelectedNewMatch
        ? "Du hast dieses Match nach Phase 5 losgelassen. Choice sucht dir für morgen wieder ein neues Match."
      : phaseFivePartnerSelectedNewMatch
        ? `${featuredProfile.firstName} hat dieses Match nach Phase 5 losgelassen. Dieses Match endet damit.`
      : phaseFiveUnlocked
        ? "Der Choice Award ist da. Ihr habt alle fünf Phasen geschafft."
      : phaseFourWindowLocked
          ? `Phase 4 läuft gerade. Zwischen ${phaseFourClockLabel} und ${phaseFiveClockLabel} bleibt euer Chat bewusst geschlossen.`
      : phaseTwoChatUnlocked
        ? phaseThreeUnlocked
          ? phaseFourUnlocked
            ? "Die Pause ist vorbei. Jetzt ist der Choice Award da."
            : phaseThreePartnerDecision === "new-match"
              ? `${featuredProfile.firstName} möchte morgen lieber mit dem neuen Vorschlag weitermachen. Du kannst hier noch schreiben, aber ${featuredProfile.firstName} schreibt nicht weiter.`
              : "Ihr habt euch beide gegen das neue Match entschieden. Jetzt könnt ihr in Phase 3 weiterschreiben."
          : "Die Choice-Runde ist abgeschlossen. Jetzt könnt ihr in Phase 2 ganz normal weiterschreiben."
        : phaseThreeStartsLater
          ? `Phase 2 ist ausgewertet. Phase 3 startet ${phaseThreeStartLabel}. Noch ${phaseThreeStartsInLabel}.`
        : phaseThreeViewerDecision === "new-match"
          ? "Du hast dich für ein neues Match entschieden. Für dich bleibt dieser Chat jetzt zu."
        : phaseThreeAnyLeave
          ? "Mindestens eine Person möchte morgen lieber mit dem neuen Vorschlag weitermachen. Dieser Chat bleibt zu."
          : phaseThreeWindowFinished
            ? "Das Zeitfenster für Phase 3 ist vorbei."
        : phaseThreeDecisionPending
            ? `Choice zeigt euch für morgen ${phaseThreeSuggestedNewMatchLabel} als Alternative. Dieses Match bleibt aktuell bestehen, außer jemand wechselt noch bewusst auf ein neues Match.`
        : phaseOneClosed
          ? !phaseOneChatStarted
            ? "Die erste Nachricht ist ausgeblieben. Deshalb endet dieses Match jetzt und danach startet wieder ein neues Match."
            : phaseOneCanAdvanceToPhaseTwo
            ? phaseTwoAvailableByTime
              ? "Niemand hat dieses Match beendet. Erst kommt die Choice-Runde, danach öffnet sich der Chat wieder."
              : `Niemand hat Neues Match gewählt. Phase 2 startet ${phaseTwoStartLabel}.`
            : "Dieses Match endet, weil mindestens eine Person Neues Match gewählt hat."
          : phaseOneChatStarted
            ? decisionCountdownText
            : phaseOneViewerStarts
              ? "Choice hat dich ausgewählt. Du schreibst die erste Nachricht."
              : `Choice hat ${phaseOneStarterName} ausgewählt. Du kannst nach der ersten Nachricht antworten.`
    : "Gerade sind noch nicht genug passende Nutzer da. Mit der Zeit kommen mehr dazu, also hab bitte etwas Geduld.";
  const chatComposerEditable = hasActiveChat && (
    !viewerSelectedNewMatch
      && (
        phaseFiveUnlocked
        || phaseTwoChatUnlocked
        || (phaseOneWindowOpen && (phaseOneChatStarted || phaseOneViewerStarts))
      )
  );
  const chatComposerHidden = hasActiveChat && viewerSelectedNewMatch;
  const chatComposerLockedText = chatComposerHidden
    ? phaseFiveViewerSelectedNewMatch
      ? "Du kannst hier nicht mehr schreiben, weil du dieses Match nach Phase 5 losgelassen hast. Choice sucht dir für morgen wieder ein neues Match."
      : phaseThreeDecisionOpen
      ? `Du kannst hier nicht mehr schreiben, weil du Neues Match gewählt hast. Für dich ist dieser Chat damit vorbei.`
      : `Du kannst hier nicht mehr schreiben, weil du morgen ein neues Match gewählt hast. Wenn du deine Wahl änderst, öffnet sich dieser Chat wieder.`
    : null;
  const chatComposerPlaceholder = hasActiveChat
    ? phaseOneBeforeRelease
      ? `Chat öffnet ${nextMatchReleaseLabel}`
      : phaseFiveUnlocked
        ? `Schreib ${featuredProfile.firstName} jetzt weiter`
      : phaseFiveRestartSelected
        ? phaseFiveViewerSelectedNewMatch
          ? "Neues Match für morgen gewählt"
          : `${featuredProfile.firstName} lässt dieses Match los`
      : phaseFourWindowLocked
          ? `Chat ist heute bis ${phaseFiveClockLabel} gesperrt`
      : phaseTwoChatUnlocked
        ? phaseThreeUnlocked
          ? phaseFourUnlocked
            ? "Choice Award erreicht"
            : phaseThreePartnerDecision === "new-match"
              ? `${featuredProfile.firstName} schreibt nicht weiter`
              : "Jetzt in Phase 3 weiterschreiben"
          : "Jetzt in Phase 2 weiterschreiben"
        : phaseThreeStartsLater
          ? `Phase 3 startet ${phaseThreeStartLabel}`
        : phaseThreeViewerDecision === "new-match"
          ? "Neues Match gewählt"
        : phaseThreeAnyLeave
          ? "Morgen startet ein neues Match"
          : phaseThreeWindowFinished
            ? phaseThreeAnyLeave
              ? "Dieses Match endet hier"
              : "Phase 4 ist vorbei"
        : phaseThreeDecisionPending
            ? "Phase 3 läuft gerade"
        : phaseOneClosed
          ? !phaseOneChatStarted
            ? "Dieses Match ist beendet"
            : phaseOneCanAdvanceToPhaseTwo
            ? phaseTwoAvailableByTime
              ? "Erst die Choice-Runde spielen"
              : `Phase 2 startet ${phaseTwoStartLabel}`
            : "Dieses Match ist beendet"
          : phaseOneChatStarted
            ? "Nachricht schreiben"
            : phaseOneViewerStarts
              ? "Choice hat dich ausgewählt. Schreib die erste Nachricht"
              : `${phaseOneStarterName} schreibt zuerst`
    : "Schreibfeld öffnet sich mit dem nächsten Match";
  const chatEmptyStateTitle = hasActiveChat && !phaseOneChatStarted
    ? phaseOneBeforeRelease
      ? `Dein erstes Match kommt ${nextMatchReleaseLabel}.`
      : phaseOneViewerSelectedNewMatch
        ? "Du hast Neues Match gewählt."
      : phaseOnePartnerSelectedNewMatch && !phaseTwoChatUnlocked && !phaseOneClosed
        ? `${featuredProfile.firstName} möchte dieses Match nicht weiterführen.`
      : phaseOneWaitingOnPartner
        ? "Dieses Match läuft gerade weiter."
      : phaseOnePartnerWaitingOnViewer
        ? `${featuredProfile.firstName} hat aktiv Weiter gewählt.`
      : phaseFiveViewerSelectedNewMatch
        ? "Für morgen ist wieder ein neues Match vorgemerkt."
      : phaseFivePartnerSelectedNewMatch
        ? `${featuredProfile.firstName} hat dieses Match losgelassen.`
      : phaseFiveUnlocked
        ? "Der Choice Award ist da."
      : phaseFourWindowLocked
          ? "Phase 4 läuft."
      : phaseTwoChatUnlocked
        ? phaseThreeUnlocked
          ? phaseFourUnlocked
            ? "Phase 5 ist offen."
            : phaseThreePartnerDecision === "new-match"
              ? `${featuredProfile.firstName} möchte morgen neu starten.`
              : "Phase 3 ist offen."
          : "Phase 2 ist offen."
        : phaseThreeStartsLater
          ? "Phase 2 ist abgeschlossen."
        : phaseThreeViewerDecision === "new-match"
          ? "Du möchtest morgen ein neues Match."
        : phaseThreeAnyLeave
          ? "Morgen geht es nicht weiter."
          : phaseThreeWindowFinished
            ? phaseThreeAnyLeave
              ? "Dieses Match endet hier."
              : "Phase 4 ist vorbei."
        : phaseThreeDecisionPending
            ? "Choice macht euch einen Vorschlag."
        : phaseOneClosed
          ? !phaseOneChatStarted
            ? "Die erste Nachricht ist ausgeblieben."
            : phaseOneCanAdvanceToPhaseTwo
            ? phaseTwoAvailableByTime
              ? "Phase 2 ist freigeschaltet."
              : "Dieses Match läuft weiter."
            : "Phase 1 ist beendet."
          : phaseOneViewerStarts
            ? "Choice hat dich ausgewählt."
            : `Choice hat ${phaseOneStarterName} ausgewählt.`
    : !hasActiveChat
      ? "Noch kein Match gefunden."
      : undefined;
  const chatEmptyStateText = hasActiveChat && !phaseOneChatStarted
    ? phaseOneBeforeRelease
      ? `Bis ${nextMatchReleaseLabel} bleibt dieser Chat noch geschlossen. Choice stellt euch erst dann live vor und legt fest, wer die erste Nachricht schreibt.`
      : phaseOneViewerSelectedNewMatch
        ? "Du hast für morgen ein neues Match gewählt. Für dich bleibt dieser Chat jetzt geschlossen."
      : phaseOnePartnerSelectedNewMatch && !phaseTwoChatUnlocked && !phaseOneClosed
        ? `${featuredProfile.firstName} hat entschieden, morgen lieber ein neues Match zu nehmen. Du kannst bis ${decisionClockLabel} noch schreiben, aber ${featuredProfile.firstName} wird nicht mehr antworten.`
      : phaseOneWaitingOnPartner
        ? `Du hast bereits aktiv Weiter gewählt. Wenn ${featuredProfile.firstName} nichts ändert, startet Phase 2 ${phaseTwoStartLabel}.`
      : phaseOnePartnerWaitingOnViewer
        ? `${featuredProfile.firstName} hat bereits aktiv Weiter gewählt. Wenn du nichts änderst, startet Phase 2 ${phaseTwoStartLabel}.`
      : phaseFiveViewerSelectedNewMatch
        ? "Du hast dieses Match nach dem Award losgelassen. Choice sucht dir für morgen wieder ein neues Match, und dieser Chat endet damit."
      : phaseFivePartnerSelectedNewMatch
        ? `${featuredProfile.firstName} hat dieses Match nach dem Award losgelassen. Deshalb endet dieser Chat jetzt.`
      : phaseFiveUnlocked
        ? "Ihr habt die letzte Phase erreicht. Choice zeigt euch jetzt den Award für das, was zwischen euch geblieben ist."
      : phaseFourWindowLocked
          ? `Zwischen ${phaseFourClockLabel} und ${phaseFiveClockLabel} bleibt euer Chat in Phase 4 bewusst geschlossen. Danach zeigt Choice, was trotz Abstand geblieben ist.`
      : phaseTwoChatUnlocked
        ? phaseThreeUnlocked
          ? phaseFourUnlocked
            ? "Die Pause ist vorbei. Jetzt ist der Choice Award da."
            : phaseThreePartnerDecision === "new-match"
              ? `${featuredProfile.firstName} möchte morgen lieber mit ${phaseThreeSuggestedWithMatchLabel} starten. Du kannst hier noch schreiben, aber ${featuredProfile.firstName} wird nicht mehr antworten.`
              : "Ihr bleibt bei diesem Match. Jetzt könnt ihr hier in Phase 3 weiterschreiben."
          : "Die Choice-Runde ist geschafft. Jetzt könnt ihr hier in Phase 2 weiterschreiben."
        : phaseThreeStartsLater
          ? `Choice hat eure Runde ausgewertet. Phase 3 startet ${phaseThreeStartLabel}. Noch ${phaseThreeStartsInLabel}.`
        : phaseThreeViewerDecision === "new-match"
          ? `Du hast dich für ${phaseThreeSuggestedNewMatchLabel} entschieden. Für dich bleibt dieser Chat jetzt zu, und morgen startet für dich ein neues Match.`
        : phaseThreeAnyLeave
          ? `Mindestens eine Person möchte morgen lieber mit ${phaseThreeSuggestedWithMatchLabel} starten. Deshalb bleibt dieser Chat jetzt zu.`
          : phaseThreeWindowFinished
            ? phaseThreeAnyLeave
              ? `Mindestens eine Person möchte lieber mit ${phaseThreeSuggestedWithMatchLabel} neu starten. Deshalb endet dieses Match nach Phase 4.`
              : "Die Pause ist vorbei. Für dieses Match wurde danach aber kein gemeinsamer nächster Schritt mehr freigeschaltet."
        : phaseThreeDecisionPending
            ? `Choice zeigt euch für morgen ${phaseThreeSuggestedNewMatchLabel} als Alternative. Standardmäßig bleibt ihr bei diesem Match. Wenn jemand lieber wechseln möchte, kann das bis zum Ende von Phase 4 noch geändert werden.`
        : phaseOneClosed
          ? !phaseOneChatStarted
            ? `Bis ${decisionClockLabel} kam keine erste Nachricht. Die Start-Person bekommt dafür einen Strafpunkt, und danach startet wieder ein neues Match.`
            : phaseOneCanAdvanceToPhaseTwo
            ? phaseTwoAvailableByTime
              ? "Niemand hat dieses Match beendet. Jetzt kommt zuerst die Choice-Runde. Direkt danach öffnet sich dieser Chat wieder."
              : `Bis ${decisionClockLabel} hat niemand Neues Match gewählt. Phase 2 beginnt ${phaseTwoStartLabel}.`
            : `Bis ${decisionClockLabel} hat mindestens eine Person Neues Match gewählt. Danach startet wieder ein neues Match.`
          : phaseOneViewerStarts
            ? "In Phase 1 eröffnest du den Chat. Sobald deine erste Nachricht raus ist, kann die andere Person direkt antworten."
            : `${phaseOneStarterName} eröffnet diesen Chat. Sobald die erste Nachricht da ist, kannst du direkt weiterschreiben.`
    : !hasActiveChat
      ? "Im Moment hat Choice noch kein passendes Match für dich gefunden. Gerade am Anfang kann es sein, dass noch zu wenige passende Nutzer da sind. Mit der Zeit kommen mehr dazu, also hab bitte etwas Geduld."
      : undefined;
  const homeTimelineSchedule = useMemo(
    () => buildPhaseSchedule(hasActiveChat ? matchReleaseTime : nextScheduledMatchReleaseTime),
    [hasActiveChat, matchReleaseTime, nextScheduledMatchReleaseTime],
  );
  const homePhaseOneStatus = buildTimelinePhaseStatus({
    now: currentTime,
    start: homeTimelineSchedule.release,
    end: homeTimelineSchedule.decisionDeadline,
    doneLabel: "Phase 1 vorbei",
  });
  const homePhaseTwoStatus = buildTimelinePhaseStatus({
    now: currentTime,
    start: homeTimelineSchedule.phaseTwoStart,
    end: homeTimelineSchedule.phaseThreeStart,
    doneLabel: "Phase 2 vorbei",
  });
  const homePhaseThreeStatus = buildTimelinePhaseStatus({
    now: currentTime,
    start: homeTimelineSchedule.phaseThreeStart,
    end: homeTimelineSchedule.phaseFourStart,
    doneLabel: "Phase 3 vorbei",
  });
  const homePhaseFourStatus = buildTimelinePhaseStatus({
    now: currentTime,
    start: homeTimelineSchedule.phaseFourStart,
    end: homeTimelineSchedule.phaseFiveStart,
    activePrefix: "Pause endet in",
    doneLabel: "Phase 4 vorbei",
  });
  const homePhaseFiveStatus: TimelinePhaseStatus = phaseFiveUnlocked
    ? {
        state: "active",
        label: "Jetzt offen",
      }
    : currentTime >= homeTimelineSchedule.phaseFiveStart
      ? {
          state: "done",
          label: phaseThreeAnyLeave ? "Nicht freigeschaltet" : "Noch nicht freigeschaltet",
        }
      : buildTimelinePhaseStatus({
          now: currentTime,
          start: homeTimelineSchedule.phaseFiveStart,
          activeWithoutEndLabel: "Jetzt offen",
        });
  const homePhases: Array<{
    phase: string;
    icon: string;
    title: string;
    text: string;
    status: TimelinePhaseStatus;
  }> = [
    {
      phase: "Phase 1",
      icon: "✦",
      title: "Ein kuratiertes Match und ein klarer Start",
      text: `Choice stellt euch um ${releaseClockLabel} ein Match vor, bestimmt, wer den ersten Schritt macht, und gibt euch bis ${decisionClockLabel} Zeit, euch kennenzulernen und die Richtung für danach zu wählen.`,
      status: homePhaseOneStatus,
    },
    {
      phase: "Phase 2",
      icon: "≈",
      title: "Die Choice-Runde macht Haltung sichtbar",
      text: "Drei Dilemma-Fragen zeigen, wie ihr denkt und entscheidet. Danach prüft Choice, wie ähnlich ihr geantwortet hättet, und berechnet daraus eure Kompatibilität.",
      status: homePhaseTwoStatus,
    },
    {
      phase: "Phase 3",
      icon: "↻",
      title: "Ein neuer Reiz zeigt, wie stark das Interesse ist",
      text: "Beide bekommen erneut die Chance auf ein neues Match. Genau daran wird sichtbar, ob man bei dieser Person bleiben will oder sich sofort neu orientiert.",
      status: homePhaseThreeStatus,
    },
    {
      phase: "Phase 4",
      icon: "◐",
      title: "Eine bewusste Chat-Pause schafft Abstand",
      text: `In Phase 4 bleibt euer Chat zwischen ${phaseFourClockLabel} und ${phaseFiveClockLabel} geschlossen. Der Abstand soll zeigen, ob auch ohne ständigen Kontakt noch wirklich etwas trägt.`,
      status: homePhaseFourStatus,
    },
    {
      phase: "Phase 5",
      icon: "♡",
      title: "Der Choice Award markiert, was geblieben ist",
      text: "Am Ende zeigt der Choice Award, was zwischen euch geblieben ist: ein gemeinsames Herz mit einer Seite für dich und einer für dein Gegenüber. Im besten Fall braucht ihr Choice danach nicht mehr.",
      status: homePhaseFiveStatus,
    },
  ];

  function resetPhaseTwoRun(
    starterUserId = phaseTwoViewerUserId,
    starterName = displayName,
    partnerUserId = phaseTwoFallbackPartnerUserId,
    partnerName = featuredProfile.firstName,
  ) {
    setPhaseThreeDecisions({});
    setPhaseTwoStarterUserId(starterUserId);
    setPhaseTwoPartnerUserId(partnerUserId);
    setPhaseTwoStarterName(starterName);
    setPhaseTwoPartnerName(partnerName);
    setPhaseTwoRounds(buildPhaseTwoRounds(starterName, partnerName));
    setPhaseTwoResults([]);
    setPhaseTwoRoundIndex(0);
    setPhaseTwoStage("starter");
  }

  function openChatFromOverview() {
    onSelectTab("chats");
    setChatOpen(true);
  }

  async function startPhaseTwo() {
    setChatOpen(false);
    setShowChatDecisionModal(false);

    if (isServerJourneyMode && journeyOwnerUserId) {
      try {
        const journey = await startRemotePhaseTwo(journeyOwnerUserId);
        applyRemoteJourneyState(journey);
        setPhaseTwoOpen(true);
      } catch {
        // Keep the user in chat if the round cannot be opened right now.
      }
      return;
    }

    resetPhaseTwoRun(
      phaseTwoAssignedStarterUserId,
      phaseTwoAssignedStarterName,
      phaseTwoAssignedPartnerUserId,
      phaseTwoAssignedPartnerName,
    );
    setPhaseTwoOpen(true);
  }

  function openOrStartPhaseTwo() {
    if (phaseTwoHasStarted) {
      setChatOpen(false);
      setShowChatDecisionModal(false);
      setPhaseTwoOpen(true);
      return;
    }

    if (!phaseOneCanAdvanceToPhaseTwo || !phaseTwoAvailableByTime) {
      return;
    }

    void startPhaseTwo();
  }

  function applyPhaseTwoAnswerAOptimistically(answer: PhaseTwoAnswerBranch) {
    if (!phaseTwoCurrentRound) {
      return;
    }

    setPhaseTwoResults((current) => {
      const next = [...current];
      next[phaseTwoRoundIndex] = {
        roundId: phaseTwoCurrentRound.id,
        prompt: phaseTwoCurrentRound.prompt,
        personALabel: answer.label,
        personAScore: answer.score,
        followUpPrompt: answer.followUpPrompt,
        followUpOptions: answer.followUpOptions,
        personBLabel: "",
        personBScore: 0,
        compatibility: 0,
      };
      return next;
    });

    if (phaseTwoRoundIndex >= phaseTwoRounds.length - 1) {
      setPhaseTwoRoundIndex(0);
      setPhaseTwoStage("partner");
      return;
    }

    setPhaseTwoRoundIndex((current) => current + 1);
  }

  function applyPhaseTwoAnswerBOptimistically(answer: PhaseTwoResponseOption) {
    if (!phaseTwoCurrentResult) {
      return;
    }

    const compatibility = getCompatibilityPoints(phaseTwoCurrentResult.personAScore, answer.score);

    setPhaseTwoResults((current) => {
      const next = [...current];
      next[phaseTwoRoundIndex] = {
        ...phaseTwoCurrentResult,
        personBLabel: answer.label,
        personBScore: answer.score,
        compatibility,
      };
      return next;
    });

    if (phaseTwoRoundIndex >= phaseTwoRounds.length - 1) {
      setPhaseTwoStage("result");
      return;
    }

    setPhaseTwoRoundIndex((current) => current + 1);
  }

  function setViewerPhaseOneDecision(nextDecision: "continue" | "new-match") {
    if (!phaseOneWindowOpen) {
      return;
    }

    const requestId = phaseOneDecisionRequestRef.current + 1;
    phaseOneDecisionRequestRef.current = requestId;
    const previousDecision = phaseOneDecisions[phaseOneViewerUserId];
    const previousPendingDecision = pendingPhaseOneDecision;
    setPendingPhaseOneDecision(nextDecision);
    setPhaseOneDecisions((current) => ({
      ...current,
      [phaseOneViewerUserId]: nextDecision,
    }));

    if (isServerJourneyMode && journeyOwnerUserId) {
      void (async () => {
        try {
          const journey = await setRemotePhaseOneDecision({
            userId: journeyOwnerUserId,
            decision: nextDecision,
          });

          if (phaseOneDecisionRequestRef.current !== requestId) {
            return;
          }

          applyRemoteJourneyState(journey);
        } catch {
          if (phaseOneDecisionRequestRef.current !== requestId) {
            return;
          }

          setPendingPhaseOneDecision(previousPendingDecision);
          setPhaseOneDecisions((current) => {
            const next = { ...current };

            if (!previousDecision) {
              delete next[phaseOneViewerUserId];
            } else {
              next[phaseOneViewerUserId] = previousDecision;
            }

            return next;
          });
        }
      })();
      return;
    }
  }

  function setViewerPhaseThreeDecision(nextDecision: "stay" | "new-match") {
    if (!phaseThreeDecisionOpen && !phaseFiveUnlocked) {
      return;
    }

    const requestId = phaseThreeDecisionRequestRef.current + 1;
    phaseThreeDecisionRequestRef.current = requestId;
    const previousDecision = phaseThreeDecisions[phaseOneViewerUserId];
    const previousPendingDecision = pendingPhaseThreeDecision;
    setPendingPhaseThreeDecision(nextDecision);
    setPhaseThreeDecisions((current) => ({
      ...current,
      [phaseOneViewerUserId]: nextDecision,
    }));

    if (isServerJourneyMode && journeyOwnerUserId) {
      void (async () => {
        try {
          const journey = await setRemotePhaseThreeDecision({
            userId: journeyOwnerUserId,
            decision: nextDecision,
          });

          if (phaseThreeDecisionRequestRef.current !== requestId) {
            return;
          }

          applyRemoteJourneyState(journey);
        } catch {
          if (phaseThreeDecisionRequestRef.current !== requestId) {
            return;
          }

          setPendingPhaseThreeDecision(previousPendingDecision);
          setPhaseThreeDecisions((current) => {
            const next = { ...current };

            if (!previousDecision) {
              delete next[phaseOneViewerUserId];
            } else {
              next[phaseOneViewerUserId] = previousDecision;
            }

            return next;
          });
        }
      })();
      return;
    }
  }

  function selectPhaseTwoAnswerA(answer: PhaseTwoAnswerBranch) {
    if (!phaseTwoCurrentRound || !phaseTwoViewerCanAnswer || phaseTwoSubmitPending) {
      return;
    }

    if (isServerJourneyMode && journeyOwnerUserId) {
      setPhaseTwoSubmitPending(true);
      applyPhaseTwoAnswerAOptimistically(answer);
      void (async () => {
        try {
          const journey = await submitRemotePhaseTwoAnswer({
            userId: journeyOwnerUserId,
            stage: "starter",
            roundIndex: phaseTwoRoundIndex,
            optionIndex: phaseTwoCurrentRound.answerOptions.findIndex((entry) => entry.label === answer.label),
          });
          applyRemoteJourneyState(journey);
        } catch {
          void refreshJourneyState(journeyOwnerUserId).catch(() => {
            setPhaseTwoSubmitPending(false);
          });
        } finally {
          setPhaseTwoSubmitPending(false);
        }
      })();
      return;
    }

    applyPhaseTwoAnswerAOptimistically(answer);
  }

  function selectPhaseTwoAnswerB(answer: PhaseTwoResponseOption) {
    if (!phaseTwoCurrentRound || !phaseTwoCurrentResult || !phaseTwoViewerCanAnswer || phaseTwoSubmitPending) {
      return;
    }

    if (isServerJourneyMode && journeyOwnerUserId) {
      setPhaseTwoSubmitPending(true);
      applyPhaseTwoAnswerBOptimistically(answer);
      void (async () => {
        try {
          const journey = await submitRemotePhaseTwoAnswer({
            userId: journeyOwnerUserId,
            stage: "partner",
            roundIndex: phaseTwoRoundIndex,
            optionIndex: phaseTwoCurrentResult.followUpOptions.findIndex((entry) => entry.label === answer.label),
          });
          applyRemoteJourneyState(journey);
        } catch {
          void refreshJourneyState(journeyOwnerUserId).catch(() => {
            setPhaseTwoSubmitPending(false);
          });
        } finally {
          setPhaseTwoSubmitPending(false);
        }
      })();
      return;
    }

    applyPhaseTwoAnswerBOptimistically(answer);
  }

  function sendChatMessage() {
    const nextText = chatDraft.trim();

    if (!nextText || !hasActiveChat || !chatComposerEditable || chatSendPending) {
      return;
    }

    if (isServerJourneyMode && journeyOwnerUserId) {
      const previousDraft = nextText;
      const optimisticMessageId = appendSharedChatMessage(
        {
          kind: "text",
          text: previousDraft,
        },
        { sending: true },
      );
      setChatSendError(null);
      setChatDraft("");
      setChatSendPending(true);

      void (async () => {
        try {
          const journey = await sendRemoteJourneyMessage({
            userId: journeyOwnerUserId,
            kind: "text",
            text: previousDraft,
          });
          applyRemoteJourneyState(journey);
          setChatSendError(null);
        } catch (error) {
          removeSharedChatMessage(optimisticMessageId);
          setChatDraft(previousDraft);
          const message = error instanceof Error ? error.message : "REQUEST_FAILED";
          setChatSendError(
            message === "REQUEST_TIMEOUT"
              ? "Nachricht konnte gerade nicht gesendet werden. Sie liegt wieder im Eingabefeld."
              : message === "CONTACT_SHARING_NOT_ALLOWED"
                ? "Kontaktdaten und externe Links kannst du im Choice-Chat nicht verschicken."
                : message === "OBJECTIONABLE_CONTENT"
                  ? "Diese Nachricht wurde aus Sicherheitsgründen nicht freigegeben."
              : message === "CHAT_LOCKED"
                ? "Dieser Chat ist gerade nicht offen. Deine Nachricht liegt wieder im Eingabefeld."
                : "Nachricht konnte gerade nicht gesendet werden. Bitte versuch es gleich nochmal.",
          );
        } finally {
          setChatSendPending(false);
        }
      })();
      return;
    }

    setChatSendError(null);
    appendSharedChatMessage({
      kind: "text",
      text: nextText,
    });
    setChatDraft("");
  }

  function renderSectionHeader(title: string, onEdit?: () => void) {
    return (
      <View style={styles.overviewSectionHeader}>
        <Text style={styles.overviewListTitle}>{title}</Text>
        {onEdit ? (
          <Pressable onPress={onEdit} style={styles.overviewSectionEditButton}>
            <Text style={styles.overviewSectionEditText}>Bearbeiten</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderPhotoSection(title: string, uris: string[], emptyText: string, onEdit?: () => void) {
    return (
      <View style={styles.overviewListCard}>
        {renderSectionHeader(title, onEdit)}
        {uris.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profilePhotoRow}>
            {uris.map((uri, index) => (
              <Pressable
                key={`${uri}-${index}`}
                onPress={() => openPhotoViewer(uris, index)}
                style={styles.profilePhotoButton}
              >
                <Image
                  source={{ uri }}
                  style={[
                    styles.profilePhoto,
                    index === 0 ? styles.profilePhotoPrimary : styles.profilePhotoSecondary,
                  ]}
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.overviewListMeta}>{emptyText}</Text>
        )}
      </View>
    );
  }

  function renderVideoSection(title: string, uri: string | null, emptyText: string, meta?: string, onEdit?: () => void) {
    return (
      <View style={styles.overviewListCard}>
        {renderSectionHeader(title, onEdit)}
        {uri ? (
          <View style={styles.overviewVideoSection}>
            <InlineVideoPreview uri={uri} />
            {meta ? <Text style={styles.overviewListMeta}>{meta}</Text> : null}
          </View>
        ) : (
          <Text style={styles.overviewListMeta}>{emptyText}</Text>
        )}
      </View>
    );
  }

  function renderFactsSection(
    title: string,
    name: string,
    meta: string,
    facts: { label: string; value: string; editId?: EditableProfileScreenId }[],
    tagline?: string,
  ) {
    return (
      <View style={styles.overviewListCard}>
        {renderSectionHeader(title)}
        <Text style={styles.overviewProfileName}>{name}</Text>
        <Text style={styles.overviewProfileMeta}>{meta}</Text>
        {tagline ? <Text style={styles.overviewListMeta}>{tagline}</Text> : null}
        <View style={styles.profileFactList}>
          {facts.map((entry) => (
            <Pressable
              key={entry.label}
              disabled={!entry.editId}
              onPress={entry.editId ? () => onEditProfileField(entry.editId as EditableProfileScreenId) : undefined}
              style={[styles.profileFactRow, entry.editId && styles.profileFactRowEditable]}
            >
              <View style={styles.profileFactCopy}>
                <Text style={styles.profileFactLabel}>{entry.label}</Text>
                <Text style={styles.profileFactValue}>{entry.value}</Text>
              </View>
              {entry.editId ? <Text style={styles.profileFactActionText}>Bearbeiten</Text> : null}
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  function renderPillSection(title: string, items: string[], onEdit?: () => void) {
    if (!items.length) {
      return null;
    }

    return (
      <View style={styles.overviewListCard}>
        {renderSectionHeader(title, onEdit)}
        <View style={styles.overviewStatusPills}>
          {items.map((item) => (
            <View key={`${title}-${item}`} style={styles.overviewPill}>
              <Text style={styles.overviewPillText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderChoiceMatchReasonCard() {
    if (!hasActiveChat || phaseOneBeforeRelease || !choiceMatchReasons.length) {
      return null;
    }

    return (
      <View style={styles.overviewListCard}>
        <Text style={styles.overviewListTitle}>Warum Choice dieses Match gewählt hat</Text>
        <Text style={styles.overviewRuleText}>
          Choice sieht hier nicht nur einen Zufall, sondern mehrere Punkte, die bewusst zusammenpassen.
        </Text>

        <View style={styles.overviewStatusPills}>
          {choiceMatchReasons.map((reason) => (
            <View key={reason.label} style={styles.overviewPill}>
              <Text style={styles.overviewPillText}>{reason.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.matchReasonList}>
          {choiceMatchReasons.map((reason) => (
            <View key={`${reason.label}-${reason.text}`} style={styles.matchReasonItem}>
              <Text style={styles.matchReasonLabel}>{reason.label}</Text>
              <Text style={styles.matchReasonText}>{reason.text}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const pendingAccountActionConfig =
    pendingAccountAction === "pause"
      ? {
          title: "Profil pausieren?",
          text: "Du wirst auf diesem Gerät abgemeldet und kannst später jederzeit wieder per SMS einsteigen.",
          confirmLabel: "Pausieren",
          confirmTone: "warning" as const,
          onConfirm: onPauseAccount,
        }
      : pendingAccountAction === "signout"
        ? {
            title: "Wirklich abmelden?",
            text: "Du wirst nur auf diesem Gerät abgemeldet. Dein Konto bleibt erhalten.",
            confirmLabel: "Abmelden",
            confirmTone: "neutral" as const,
            onConfirm: onSignOut,
          }
        : pendingAccountAction === "delete"
          ? {
              title: "Konto wirklich löschen?",
              text: "Dein Profil, deine Matches und deine Chats werden dauerhaft entfernt. Bereits verbrauchte Match-Freischaltungen bleiben aber an deine Telefonnummer gebunden.",
              confirmLabel: "Konto löschen",
              confirmTone: "danger" as const,
              onConfirm: onDeleteAccount,
            }
          : null;

  async function confirmPendingAccountAction() {
    if (!pendingAccountActionConfig || accountActionPending) {
      return;
    }

    await pendingAccountActionConfig.onConfirm();
    setPendingAccountAction(null);
  }

  function renderChatDecisionCard() {
    if (!hasActiveChat || (!phaseOneWindowOpen && !phaseTwoReady)) {
      return null;
    }

    if (phaseTwoReady && !phaseThreeQualified) {
      return null;
    }

    if (phaseTwoReady && !phaseThreeDecisionOpen) {
      return null;
    }

    const decisionIsAfterGame = phaseThreeDecisionOpen;
    const decisionInPause = decisionIsAfterGame && phaseFourWindowLocked;
    const decisionEyebrow = decisionIsAfterGame
      ? decisionInPause
        ? "Phase 4"
        : "Für morgen"
      : "Vor dem Öffnen";
    const decisionTitle = decisionIsAfterGame
      ? decisionInPause
        ? "Wie möchtest du nach der Pause weitermachen?"
        : "Wie möchtest du morgen weitermachen?"
      : "Wohin tendierst du gerade?";
    const continueTitle = decisionIsAfterGame ? "Bleiben" : "Weiter";
    const continueText = decisionIsAfterGame
      ? decisionInPause
        ? `Nach ${phaseFiveClockLabel} mit dieser Person weitermachen.`
        : "Mit dieser Person würdest du morgen weitermachen."
      : "Mit dieser Person würdest du weitermachen. Solange du nicht Neues Match wählst, bleibt das automatisch so.";
    const viewerContinueVisualSelected = decisionIsAfterGame
      ? phaseThreeViewerDecision !== "new-match"
      : phaseOneViewerDecision !== "new-match";
    const viewerSelectedNewMatchHere = decisionIsAfterGame
      ? phaseThreeViewerDecision === "new-match"
      : phaseOneViewerDecision === "new-match";
    const newMatchConsequenceText = decisionIsAfterGame
      ? decisionInPause
        ? `Nach ${phaseFiveClockLabel} startest du nicht mehr mit ${featuredProfile.firstName}. Für dich bleibt dieser Chat danach zu.`
        : `Du startest morgen nicht mehr mit ${featuredProfile.firstName}. Für dich bleibt dieser Chat ab jetzt zu.`
      : `Für dich bleibt dieser Chat sofort zu. Bis ${decisionClockLabel} kannst du deine Entscheidung noch ändern.`;

    return (
      <View style={styles.chatDecisionInlineCard}>
        <View style={styles.chatDecisionInlineHeader}>
          <Text style={styles.chatDecisionInlineEyebrow}>{decisionEyebrow}</Text>
          <Text style={styles.chatDecisionInlineTitle}>{decisionTitle}</Text>
        </View>

        <View style={styles.chatDecisionInlineRow}>
          <Pressable
            onPress={() => {
              if (decisionIsAfterGame) {
                setViewerPhaseThreeDecision("stay");
                return;
              }

              setViewerPhaseOneDecision("continue");
            }}
            style={({ pressed }) => [
              styles.chatDecisionInlineOption,
              pressed && styles.chatDecisionInlineOptionPressed,
              viewerContinueVisualSelected && styles.chatDecisionInlineOptionActive,
              viewerContinueVisualSelected && pressed && styles.chatDecisionInlineOptionActivePressed,
            ]}
          >
            <Text style={styles.chatDecisionInlineIcon}>♥</Text>
            <View style={styles.chatDecisionInlineCopy}>
              <Text
                style={[
                  styles.chatDecisionInlineOptionTitle,
                  viewerContinueVisualSelected && styles.chatDecisionInlineOptionTitleActive,
                ]}
              >
                {continueTitle}
              </Text>
              <Text style={styles.chatDecisionInlineOptionText}>{continueText}</Text>
            </View>
            {viewerContinueVisualSelected ? (
              <View style={styles.chatDecisionInlineMark}>
                <Text style={styles.chatDecisionInlineMarkText}>✓</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => {
              if (decisionIsAfterGame) {
                setViewerPhaseThreeDecision("new-match");
                return;
              }

              setViewerPhaseOneDecision("new-match");
            }}
            style={({ pressed }) => [
              styles.chatDecisionInlineOption,
              pressed && styles.chatDecisionInlineOptionPressed,
              (decisionIsAfterGame ? phaseThreeViewerDecision === "new-match" : phaseOneViewerDecision === "new-match") && styles.chatDecisionInlineOptionMuted,
              (decisionIsAfterGame ? phaseThreeViewerDecision === "new-match" : phaseOneViewerDecision === "new-match") && pressed && styles.chatDecisionInlineOptionMutedPressed,
            ]}
          >
            <Text style={styles.chatDecisionInlineIcon}>○</Text>
            <View style={styles.chatDecisionInlineCopy}>
              <Text
                style={[
                  styles.chatDecisionInlineOptionTitle,
                  (decisionIsAfterGame ? phaseThreeViewerDecision === "new-match" : phaseOneViewerDecision === "new-match") && styles.chatDecisionInlineOptionTitleMuted,
                ]}
              >
                Neues Match
              </Text>
              <Text style={styles.chatDecisionInlineOptionText}>
                {decisionIsAfterGame
                  ? decisionInPause
                    ? `Nach der Pause lieber mit ${phaseThreeSuggestedWithMatchLabel} neu starten.`
                    : "Du möchtest morgen ein neues Match."
                  : "Du möchtest morgen ein neues Match."}
              </Text>
            </View>
            {viewerSelectedNewMatchHere ? (
              <View style={styles.chatDecisionInlineMarkMuted}>
                <Text style={styles.chatDecisionInlineMarkMutedText}>✓</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {viewerSelectedNewMatchHere ? (
          <View style={styles.chatDecisionInlineNotice}>
            <Text style={styles.chatDecisionInlineNoticeText}>{newMatchConsequenceText}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  function renderPhaseTwoEntryCard() {
    if (phaseThreeUnlocked || phaseFourWindowLocked || phaseFiveUnlocked) {
      return null;
    }

    if (
      !hasActiveChat
      || (!phaseTwoHasStarted && !phaseTwoReady && !phaseOneChatStarted)
    ) {
      return null;
    }

    const viewerIsStarter = phaseTwoViewerUserId === phaseTwoStarterUserId;
    const viewerIsPartner = phaseTwoViewerUserId === phaseTwoPartnerUserId;
    const phaseTwoViewerWaiting = phaseTwoHasStarted && !phaseTwoReady && !phaseTwoViewerCanAnswer;
    const phaseTwoCanOpen = !phaseTwoReady && phaseTwoViewerCanAnswer;
    const phaseTwoCtaLabel = phaseTwoHasStarted
      ? phaseTwoViewerCanAnswer
        ? phaseTwoStage === "starter"
          ? "Deine 3 Fragen öffnen"
          : "Deine Einordnung starten"
        : `Jetzt ist ${phaseTwoCurrentResponderName} dran`
      : phaseOneCanAdvanceToPhaseTwo
        ? "Zum Spiel"
        : "Phase 2 starten";
    let phaseTwoStatusTitle = "Phase 2 startet automatisch, solange niemand Neues Match wählt.";
    let phaseTwoStatusText =
      "Sobald Phase 1 vorbei ist, beantwortet eine Person zuerst alle 3 Fragen komplett. Danach ist die andere Person dran.";

    if (!phaseTwoHasStarted && !phaseTwoReady && phaseOneViewerDecision === "continue" && phaseOnePartnerDecision === "undecided") {
      phaseTwoStatusTitle = "Du hast aktiv Weiter gewählt.";
      phaseTwoStatusText = `Wenn ${featuredProfile.firstName} nichts ändert, startet Phase 2 ${phaseTwoStartLabel}. Bis ${decisionClockLabel} kann diese Entscheidung noch geändert werden.`;
    }

    if (!phaseTwoHasStarted && !phaseTwoReady && phaseOneViewerDecision === "undecided" && phaseOnePartnerDecision === "continue") {
      phaseTwoStatusTitle = `${featuredProfile.firstName} möchte weitermachen.`;
      phaseTwoStatusText = `Wenn du nichts änderst, endet Phase 1 heute um ${decisionClockLabel} und Phase 2 beginnt ${phaseTwoStartLabel}.`;
    }

    if (!phaseTwoHasStarted && !phaseTwoReady && phaseOneAnyDeclined) {
      phaseTwoStatusTitle = "Dieses Match geht nicht in Phase 2 weiter.";
      phaseTwoStatusText =
        phaseOneViewerDecision === "new-match" && phaseOnePartnerDecision !== "new-match"
          ? phaseOneClosed
            ? `Du wolltest danach ein neues Match. Deshalb endet dieses Match heute um ${decisionClockLabel} und direkt danach startet ein neues.`
            : `Du hast gewählt, dass du danach ein neues Match willst. Bis ${decisionClockLabel} kannst du diese Entscheidung noch ändern.`
          : phaseOneViewerDecision !== "new-match" && phaseOnePartnerDecision === "new-match"
            ? phaseOneClosed
              ? `${featuredProfile.firstName} wollte danach ein neues Match. Deshalb endet dieses Match heute um ${decisionClockLabel} und direkt danach startet wieder ein neues.`
              : `${featuredProfile.firstName} möchte danach ein neues Match. Bis ${decisionClockLabel} könnt ihr diese Entscheidung noch ändern.`
            : phaseOneClosed
              ? `Bis ${decisionClockLabel} hat mindestens eine Person Neues Match gewählt. Direkt danach startet wieder ein neues Match.`
              : `Mindestens eine Person möchte danach ein neues Match. Bis ${decisionClockLabel} könnt ihr diese Entscheidung noch ändern.`;
    }

    if (!phaseTwoHasStarted && phaseOneCanAdvanceToPhaseTwo && !phaseTwoAvailableByTime) {
      phaseTwoStatusTitle = "Dieses Match läuft weiter.";
      phaseTwoStatusText = `Solange niemand Neues Match wählt, endet Phase 1 heute um ${decisionClockLabel} und Phase 2 startet ${phaseTwoStartLabel}. Noch ${phaseTwoStartsInLabel}.`;
    }

    if (!phaseTwoHasStarted && phaseOneCanAdvanceToPhaseTwo && phaseTwoAvailableByTime) {
      phaseTwoStatusTitle = phaseTwoCurrentResponderUserId === phaseTwoViewerUserId
        ? "Du beginnst jetzt Phase 2."
        : `${phaseTwoCurrentResponderName} beginnt jetzt Phase 2.`;
      phaseTwoStatusText = phaseTwoCurrentResponderUserId === phaseTwoViewerUserId
        ? `Beantworte jetzt zuerst alle 3 Fragen. Danach ist ${phaseTwoPartnerName} dran.`
        : `${phaseTwoCurrentResponderName} beantwortet jetzt zuerst alle 3 Fragen. Danach bist du dran.`;
    }

    if (phaseTwoOverdue) {
      phaseTwoStatusTitle = "Phase 2 wurde nicht rechtzeitig gespielt.";
      phaseTwoStatusText = phaseTwoPenaltyJustApplied
        ? phaseTwoCurrentResponderUserId === phaseTwoViewerUserId
          ? "Du warst für diese Runde dran. Dafür hast du einen Strafpunkt bekommen, und dieses Match endet jetzt."
          : `${phaseTwoCurrentResponderName} war für diese Runde dran. Dafür wurde ein Strafpunkt vergeben, und dieses Match endet jetzt.`
        : phaseTwoCurrentResponderUserId === phaseTwoViewerUserId
          ? `Bis ${phaseThreeClockLabel} war deine Runde fällig. Dafür endet dieses Match jetzt.`
          : `${phaseTwoCurrentResponderName} war bis ${phaseThreeClockLabel} mit der Runde dran. Deshalb endet dieses Match jetzt.`;
    }

    if (!phaseTwoOverdue && phaseTwoHasStarted && phaseTwoStage === "starter") {
      if (viewerIsStarter) {
        phaseTwoStatusTitle = "Du beginnst diese Runde.";
        phaseTwoStatusText = `Beantworte jetzt zuerst alle 3 Fragen. Danach ist ${phaseTwoPartnerName} dran.`;
      } else {
        phaseTwoStatusTitle = `${phaseTwoStarterName} beginnt diese Runde.`;
        phaseTwoStatusText = `${phaseTwoStarterName} beantwortet gerade die 3 Fragen. Danach bekommst du Bescheid und bist dran.`;
      }
    }

    if (!phaseTwoOverdue && phaseTwoHasStarted && phaseTwoStage === "partner") {
      if (viewerIsPartner) {
        phaseTwoStatusTitle = `${phaseTwoStarterName} hat schon geantwortet.`;
        phaseTwoStatusText = `Die ersten 3 Antworten sind drin. Jetzt bist du dran und beantwortest deine Seite der Runde.`;
      } else {
        phaseTwoStatusTitle = "Dein Teil ist abgeschlossen.";
        phaseTwoStatusText = `${phaseTwoStarterName} hat die ersten 3 Fragen schon beantwortet. Jetzt ist ${phaseTwoPartnerName} dran.`;
      }
    }

    if (phaseTwoReady) {
      phaseTwoStatusTitle = "Die Choice-Runde ist abgeschlossen.";
      phaseTwoStatusText = phaseThreeQualified
        ? phaseThreeDecisionOpen
          ? `Choice hat eure Runde ausgewertet. Für morgen zeigt euch Choice ${phaseThreeSuggestedNewMatchLabel} als Alternative. Dieses Match bleibt erstmal offen, solange niemand bewusst auf ein neues Match wechselt.`
          : `Choice hat eure Runde ausgewertet. Ihr seid über 50%. Phase 3 startet ${phaseThreeStartLabel}. Noch ${phaseThreeStartsInLabel}.`
        : "Choice hat eure Runde ausgewertet. Der Chat ist jetzt in Phase 2 wieder offen, auch wenn es noch nicht für Phase 3 reicht.";
    }

    return (
      <View style={styles.phaseTwoEntryCard}>
        <Text style={styles.phaseTwoEyebrow}>Phase 2</Text>
        <Text style={styles.phaseTwoEntryTitle}>{phaseTwoStatusTitle}</Text>
        <Text style={styles.phaseTwoEntryText}>{phaseTwoStatusText}</Text>

        {phaseTwoReady ? (
          <View
            style={[
              styles.phaseTwoEntryResultPill,
              phaseThreeQualified ? styles.phaseTwoStatusPillSuccess : styles.phaseTwoStatusPillMuted,
            ]}
          >
            <Text style={[styles.phaseTwoEntryResultText, !phaseThreeQualified && styles.phaseTwoStatusPillText]}>
              Letztes Ergebnis: {phaseTwoCompatibility}% •{" "}
              {phaseThreeQualified
                ? phaseThreeDecisionOpen
                  ? "Phase 3 läuft jetzt"
                  : `Phase 3 in ${phaseThreeStartsInLabel}`
                : "nicht genug für Phase 3"}
            </Text>
          </View>
        ) : null}

        {phaseTwoReady ? (
          <Pressable
            onPress={openOrStartPhaseTwo}
            style={styles.phaseTwoEntryButton}
          >
            <Text style={styles.phaseTwoEntryButtonText}>Auswertung öffnen</Text>
          </Pressable>
        ) : null}

        {!phaseTwoReady && phaseTwoCanOpen && !phaseTwoViewerWaiting ? (
          <Pressable
            onPress={openOrStartPhaseTwo}
            style={styles.phaseTwoEntryButton}
          >
            <Text style={styles.phaseTwoEntryButtonText}>
              {phaseTwoCtaLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderPhaseThreeEntryCard() {
    if (!hasActiveChat || !phaseThreeDecisionOpen) {
      return null;
    }

    const decisionWindowInPause = phaseFourWindowLocked;
    const stayVisualSelected = phaseThreeViewerDecision !== "new-match";
    const newMatchVisualSelected = phaseThreeViewerDecision === "new-match";

    let phaseThreeTitle = decisionWindowInPause
      ? "Die Pause läuft. Euer Match bleibt aktuell bestehen."
      : "Choice zeigt euch jetzt eine Alternative.";
    let phaseThreeText = decisionWindowInPause
      ? `Bis ${phaseFiveClockLabel} kannst du noch auf ${phaseThreeSuggestedWithMatchLabel} wechseln, wenn du lieber neu starten willst. Sonst geht euer Chat danach einfach weiter.`
      : `Für morgen schlägt Choice ${phaseThreeSuggestedNewMatchLabel} vor. Dieses Match bleibt erstmal ausgewählt. Wenn du lieber wechseln willst, kannst du das bis ${phaseFourClockLabel} noch anpassen.`;

    if (phaseThreeViewerStayedExplicitly && phaseThreePartnerDecision === "undecided") {
      phaseThreeTitle = "Du bleibst bei diesem Match.";
      phaseThreeText = decisionWindowInPause
        ? `Für dich ist alles gesetzt. ${featuredProfile.firstName} kann bis ${phaseFiveClockLabel} noch auf ${phaseThreeSuggestedWithMatchLabel} wechseln, wenn es sich richtiger anfühlt.`
        : `Für dich ist alles gesetzt. ${featuredProfile.firstName} kann bis ${phaseFourClockLabel} noch auf ${phaseThreeSuggestedWithMatchLabel} wechseln, wenn es sich richtiger anfühlt.`;
    }

    if (phaseThreeViewerDecision !== "stay" && phaseThreePartnerStayedExplicitly) {
      phaseThreeTitle = `${featuredProfile.firstName} bleibt bei euch.`;
      phaseThreeText = decisionWindowInPause
        ? `Wenn du nichts mehr änderst, geht euer Chat nach ${phaseFiveClockLabel} einfach weiter. Bis dahin kannst du trotzdem noch auf ${phaseThreeSuggestedWithMatchLabel} wechseln.`
        : `Wenn du nichts mehr änderst, bleibt ihr bei diesem Match. Bis ${phaseFourClockLabel} kannst du trotzdem noch auf ${phaseThreeSuggestedWithMatchLabel} wechseln.`;
    }

    if (phaseThreeBothStayExplicit) {
      phaseThreeTitle = decisionWindowInPause
        ? "Ihr bleibt nach der Pause bei diesem Match."
        : "Ihr bleibt bei diesem Match.";
      phaseThreeText = decisionWindowInPause
        ? `Choice hält euren Chat noch bis ${phaseFiveClockLabel} geschlossen. Danach könnt ihr weiterschreiben.`
        : `Choice lässt euren Chat offen. Bis ${phaseFourClockLabel} könnt ihr eure Wahl noch ändern, wenn ihr lieber neu starten wollt.`;
    }

    if (phaseThreeAnyLeave) {
      phaseThreeTitle = decisionWindowInPause
        ? "Mindestens eine Person möchte nach der Pause neu starten."
        : "Mindestens eine Person möchte morgen ein neues Match.";
      phaseThreeText = decisionWindowInPause
        ? `Nach ${phaseFiveClockLabel} endet euer aktueller Chat. Danach würde stattdessen ${phaseThreeSuggestedWithMatchLabel} in Phase 1 bereitstehen.`
        : `Damit endet euer aktueller Chat. Morgen würde stattdessen ${phaseThreeSuggestedWithMatchLabel} in Phase 1 bereitstehen.`;
    }

    return (
      <View style={styles.phaseThreeEntryCard}>
        <Text style={styles.phaseTwoEyebrow}>{decisionWindowInPause ? "Phase 4" : "Phase 3"}</Text>
        <Text style={styles.phaseThreeEntryTitle}>{phaseThreeTitle}</Text>
        <Text style={styles.phaseTwoEntryText}>{phaseThreeText}</Text>

        {phaseThreeSuggestedProfile ? (
          <View style={styles.phaseThreePreviewWrap}>
            <Image source={{ uri: phaseThreeSuggestedProfile.imageUri }} style={styles.phaseThreePreviewImage} />
            <View style={styles.phaseThreePreviewCopy}>
              <View style={styles.phaseThreePreviewTopRow}>
                <Text style={styles.phaseThreePreviewName}>
                  {phaseThreeSuggestedProfile.firstName}, {phaseThreeSuggestedProfile.age}
                </Text>
                <View style={styles.phaseThreePreviewPill}>
                  <Text style={styles.phaseThreePreviewPillText}>
                    {decisionWindowInPause ? `offen bis ${phaseFiveClockLabel}` : `heute ${phaseThreeClockLabel}`}
                  </Text>
                </View>
              </View>
              <Text style={styles.phaseThreePreviewMeta}>
                {[phaseThreeSuggestedProfile.city, phaseThreeSuggestedDistanceLabel].filter(Boolean).join(" • ")}
              </Text>
              <Text style={styles.phaseThreePreviewTagline}>{phaseThreeSuggestedProfile.tagline}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.phaseThreePreviewFallback}>
            <Text style={styles.phaseThreePreviewFallbackTitle}>Choice sucht gerade noch den passendsten neuen Vorschlag.</Text>
            <Text style={styles.phaseThreePreviewFallbackText}>
              Sobald ein wirklich passendes neues Match feststeht, siehst du es hier statt eines zufälligen Profils.
            </Text>
          </View>
        )}

        <View style={styles.phaseThreeDecisionRow}>
          <Pressable
            onPress={() => setViewerPhaseThreeDecision("stay")}
            style={({ pressed }) => [
              styles.phaseThreeDecisionOption,
              styles.phaseThreeDecisionOptionStay,
              pressed && styles.phaseThreeDecisionOptionPressed,
              stayVisualSelected && styles.phaseThreeDecisionOptionActive,
              stayVisualSelected && pressed && styles.phaseThreeDecisionOptionActivePressed,
            ]}
          >
            <View style={styles.phaseThreeDecisionHeader}>
              <Text style={styles.phaseThreeDecisionIcon}>♥</Text>
              {stayVisualSelected ? (
                <View style={styles.phaseThreeDecisionMark}>
                  <Text style={styles.phaseThreeDecisionMarkText}>✓</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.phaseThreeDecisionCopy}>
              <Text style={[styles.phaseThreeDecisionTitle, stayVisualSelected && styles.phaseThreeDecisionTitleActive]}>
                Bleiben
              </Text>
              <Text style={styles.phaseThreeDecisionText}>
                {decisionWindowInPause
                  ? `Nach ${phaseFiveClockLabel} mit diesem Match weiterschreiben.`
                  : "Morgen mit diesem Match weiterschreiben."}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setViewerPhaseThreeDecision("new-match")}
            style={({ pressed }) => [
              styles.phaseThreeDecisionOption,
              styles.phaseThreeDecisionOptionNewMatch,
              pressed && styles.phaseThreeDecisionOptionPressed,
              newMatchVisualSelected && styles.phaseThreeDecisionOptionMuted,
              newMatchVisualSelected && pressed && styles.phaseThreeDecisionOptionMutedPressed,
            ]}
          >
            <View style={styles.phaseThreeDecisionHeader}>
              <Text style={styles.phaseThreeDecisionIcon}>○</Text>
              {newMatchVisualSelected ? (
                <View style={styles.phaseThreeDecisionMarkMuted}>
                  <Text style={styles.phaseThreeDecisionMarkMutedText}>✓</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.phaseThreeDecisionCopy}>
              <Text
                style={[
                  styles.phaseThreeDecisionTitle,
                  newMatchVisualSelected && styles.phaseThreeDecisionTitleMuted,
                ]}
              >
                Neu starten
              </Text>
              <Text style={styles.phaseThreeDecisionText}>
                {decisionWindowInPause
                  ? `Nach der Pause lieber mit ${phaseThreeSuggestedWithMatchLabel} neu starten.`
                  : `Morgen lieber mit ${phaseThreeSuggestedWithMatchLabel} chatten.`}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderPhaseFourEntryCard() {
    if (
      !hasActiveChat
      || !phaseFourWindowLocked
      || phaseFiveUnlocked
      || phaseThreeDecisionPending
    ) {
      return null;
    }

    const phaseFourTitle = currentTime < phaseFourStartTime
      ? `Phase 4 startet heute um ${phaseFourClockLabel}.`
      : "Phase 4 hält euren Chat bewusst an.";
    const phaseFourText = currentTime < phaseFourStartTime
      ? `Heute ab ${phaseFourClockLabel} bleibt euer Chat bis ${phaseFiveClockLabel} geschlossen. Noch ${phaseFourStartsInLabel}, dann beginnt die Pause.`
      : `Zwischen ${phaseFourClockLabel} und ${phaseFiveClockLabel} bleibt euer Chat bewusst zu. Erst danach geht es weiter und Choice zeigt, was trotz Abstand geblieben ist.`;

    return (
      <View style={styles.phaseFourEntryCard}>
        <Text style={styles.phaseTwoEyebrow}>Phase 4</Text>
        <Text style={styles.phaseFourEntryTitle}>{phaseFourTitle}</Text>
        <Text style={styles.phaseTwoEntryText}>{phaseFourText}</Text>

        <View style={styles.phaseFourLockCard}>
          <Text style={styles.phaseFourLockIcon}>◐</Text>
          <View style={styles.phaseFourLockCopy}>
            <Text style={styles.phaseFourLockTitle}>{`Chat-Sperre von ${phaseFourClockLabel} bis ${phaseFiveClockLabel}`}</Text>
            <Text style={styles.phaseFourLockText}>
              Choice nimmt euch hier bewusst die Dauerverfügbarkeit. Wenn danach noch etwas da ist, ist es mehr als nur Momentum.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  function renderPhaseFiveAwardCard() {
    if (!hasActiveChat || !phaseFiveUnlocked) {
      return null;
    }

    return (
      <View style={styles.phaseFiveEntryCard}>
        <Text style={styles.phaseTwoEyebrow}>Phase 5</Text>
        <Text style={styles.phaseFiveEntryTitle}>Choice Award</Text>
        <Text style={styles.phaseTwoEntryText}>
          Ihr seid bis hier gekommen. Choice sieht hier keine zufällige Nähe mehr, sondern etwas, das mehrere Phasen überstanden hat.
        </Text>

        <View style={styles.phaseFiveAwardCard}>
          <View style={styles.phaseFiveAwardTopRow}>
            <View style={styles.phaseFiveAwardPersonBadge}>
              <Text style={styles.phaseFiveAwardPersonText}>Du</Text>
            </View>
            <Text style={styles.phaseFiveAwardLink}>♥</Text>
            <View style={styles.phaseFiveAwardPersonBadge}>
              <Text style={styles.phaseFiveAwardPersonText}>{featuredProfile.firstName}</Text>
            </View>
          </View>

          <View style={styles.phaseFiveHeartVisual}>
            <ChoiceAwardHeart leftUri={awardViewerPhotoUri} rightUri={awardPartnerPhotoUri} />
          </View>
          <Image source={choiceWordmark} style={styles.phaseFiveWordmark} resizeMode="contain" />

          <Text style={styles.phaseFiveAwardHeadline}>Was zwischen euch geblieben ist, bekommt einen Namen.</Text>
          <Text style={styles.phaseFiveAwardBody}>
            Der Choice Award gehört nicht dem besseren Profil, sondern zwei Menschen, die sich immer wieder füreinander entschieden haben. Im besten Fall braucht ihr Choice danach nicht mehr.
          </Text>

        </View>
      </View>
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrateJourneyState() {
      if (!journeyOwnerUserId) {
        if (!cancelled) {
          setRemoteJourney(null);
          setJourneyReleaseAt(null);
          setSharedChatMessages([]);
          setLastSeenPartnerMessageId(null);
          setPhaseOneStarterPenaltyAppliedAt(null);
          setPhaseTwoPenaltyAppliedAt(null);
          setPhaseOneDecisions({});
          setPhaseThreeDecisions({});
          setPhaseTwoOpen(false);
          setPhaseTwoRounds([]);
          setPhaseTwoRoundIndex(0);
          setPhaseTwoStage("starter");
          setPhaseTwoResults([]);
          setPhaseTwoStarterUserId(null);
          setPhaseTwoPartnerUserId(null);
          setPhaseTwoStarterName("");
          setPhaseTwoPartnerName("");
          setIsJourneyHydrated(true);
        }
        return;
      }

      if (isServerJourneyMode) {
        let stored: PersistedJourneyState | null = null;

        try {
          stored = await loadTransientState<PersistedJourneyState>();

          if (!cancelled && stored && stored.ownerUserId === journeyOwnerUserId) {
            applyStoredJourneyClientState(stored);
          }

          const journey = await refreshJourneyState(journeyOwnerUserId);

          if (!cancelled) {
            setIsJourneyHydrated(true);
          }
        } catch {
          if (!cancelled) {
            const hasStoredJourneySnapshot =
              stored !== null && stored.ownerUserId === journeyOwnerUserId;

            // Keep the last known local journey snapshot if the live refresh
            // fails temporarily. This prevents the overview from dropping back
            // to an empty state during brief network or server hiccups.
            if (!hasStoredJourneySnapshot) {
              setRemoteJourney(null);
              resetJourneyState(journeyOwnerUserId);
            }
            setIsJourneyHydrated(true);
          }
        }

        return;
      }

      const stored = await loadTransientState<PersistedJourneyState>();
      const nextState =
        stored && stored.ownerUserId === journeyOwnerUserId
          ? stored
          : buildInitialJourneyState(journeyOwnerUserId);

      if (!cancelled) {
        applyJourneyState(nextState);
        setIsJourneyHydrated(true);
      }

      if (!stored || stored.ownerUserId !== journeyOwnerUserId) {
        await saveTransientState(nextState);
      }
    }

    setIsJourneyHydrated(false);
    void hydrateJourneyState();

    const intervalId = isServerJourneyMode
      ? setInterval(() => {
          void hydrateJourneyState();
        }, 15_000)
      : null;

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isServerJourneyMode, journeyOwnerUserId]);

  useEffect(() => {
    if (!isJourneyHydrated || !journeyOwnerUserId || !journeyReleaseAt) {
      return;
    }

    void saveTransientState<PersistedJourneyState>({
      ownerUserId: journeyOwnerUserId,
      releaseAt: journeyReleaseAt,
      sharedChatMessages,
      lastSeenPartnerMessageId,
      seenMatchReleaseAt,
      scheduledMatchNotificationId,
      scheduledMatchNotificationReleaseAt,
      phaseOneStarterPenaltyAppliedAt,
      phaseTwoPenaltyAppliedAt,
      phaseOneDecisions,
      phaseThreeDecisions,
      phaseTwoOpen,
      phaseTwoRounds,
      phaseTwoRoundIndex,
      phaseTwoStage,
      phaseTwoResults,
      phaseTwoStarterUserId,
      phaseTwoPartnerUserId,
      phaseTwoStarterName,
      phaseTwoPartnerName,
    });
  }, [
    isServerJourneyMode,
    isJourneyHydrated,
    journeyOwnerUserId,
    journeyReleaseAt,
    sharedChatMessages,
    lastSeenPartnerMessageId,
    seenMatchReleaseAt,
    scheduledMatchNotificationId,
    scheduledMatchNotificationReleaseAt,
    phaseOneStarterPenaltyAppliedAt,
    phaseTwoPenaltyAppliedAt,
    phaseOneDecisions,
    phaseThreeDecisions,
    phaseTwoOpen,
    phaseTwoRounds,
    phaseTwoRoundIndex,
    phaseTwoStage,
    phaseTwoResults,
    phaseTwoStarterUserId,
    phaseTwoPartnerUserId,
    phaseTwoStarterName,
    phaseTwoPartnerName,
  ]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const activeUserId = currentUserId;
    let cancelled = false;

    async function hydrateRemoteAccountState() {
      try {
        const remoteAccount = await refreshAccountState(activeUserId);

        if (cancelled) {
          return;
        }

        setAccountState(remoteAccount);
      } catch {
        if (!cancelled) {
          setAccountState(null);
        }
      } finally {
        if (!cancelled) {
          setIsAccountStateHydrated(true);
        }
      }
    }

    setIsAccountStateHydrated(false);
    void hydrateRemoteAccountState();

    const intervalId = setInterval(() => {
      void hydrateRemoteAccountState();
    }, 20_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setPurchaseMessage(null);
      setMatchPackPriceLabel("3,99 €");
      void logOutRevenueCat().catch(() => {
        // Ignore logout cleanup errors while leaving the app surface.
      });
      return;
    }

    void syncRevenueCatUser(currentUserId).catch(() => {
      // The purchase layer can reconnect on the next session or app reload.
    });
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !hasRevenueCatConfig()) {
      setMatchPackPriceLabel("3,99 €");
      return;
    }

    const activeUserId = currentUserId;
    let cancelled = false;

    async function loadMatchPackPrice() {
      try {
        await syncRevenueCatUser(activeUserId);
        const product = await getMatchPackStoreProduct();

        if (!cancelled && product?.priceString) {
          setMatchPackPriceLabel(product.priceString);
        }
      } catch {
        if (!cancelled) {
          setMatchPackPriceLabel("3,99 €");
        }
      }
    }

    void loadMatchPackPrice();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      pushRegistrationRef.current = null;
      return;
    }

    const activeUserId = currentUserId;
    let cancelled = false;

    async function syncPushRegistration() {
      const expoPushToken = await getExpoPushToken();

      if (!expoPushToken || cancelled) {
        return;
      }

      const nextRegistrationKey = `${activeUserId}:${expoPushToken}`;

      if (pushRegistrationRef.current === nextRegistrationKey) {
        return;
      }

      try {
        await registerRemotePushToken({
          userId: activeUserId,
          token: expoPushToken,
          platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web",
        });

        if (!cancelled) {
          pushRegistrationRef.current = nextRegistrationKey;
        }
      } catch {
        // Retry on the next app session or when the user reloads the app.
      }
    }

    void syncPushRegistration();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (
      isServerJourneyMode
      || !isJourneyHydrated
      || !isAccountStateHydrated
      || !journeyOwnerUserId
      || !journeyReleaseAt
      || !phaseOneClosed
      || phaseOneChatStarted
      || !phaseOneStarterUserId
      || phaseOneStarterPenaltyAppliedAt === currentReleaseKey
    ) {
      return;
    }

    let cancelled = false;

    async function applyPhaseOnePenalty() {
      try {
        const updatedAccount = await applyRemoteSystemPenalty({
          userId: phaseOneStarterUserId,
          reason: "PHASE_ONE_NOT_STARTED",
          contextKey: `phase-one-starter-missed:${currentReleaseKey}:${phaseOneStarterUserId}`,
          note: "Keine erste Nachricht bis zum Ende von Phase 1.",
        });

        if (!cancelled && updatedAccount.userId === currentUserId) {
          setAccountState(updatedAccount);
        }

        if (!cancelled) {
          setPhaseOneStarterPenaltyAppliedAt(currentReleaseKey);
        }
      } catch {
        // Retry automatically on the next render while the API is unavailable.
      }
    }

    void applyPhaseOnePenalty();

    return () => {
      cancelled = true;
    };
  }, [
    currentReleaseKey,
    currentUserId,
    isJourneyHydrated,
    isAccountStateHydrated,
    isServerJourneyMode,
    journeyOwnerUserId,
    journeyReleaseAt,
    phaseOneChatStarted,
    phaseOneClosed,
    phaseOneStarterPenaltyAppliedAt,
    phaseOneStarterUserId,
  ]);

  useEffect(() => {
    if (
      isServerJourneyMode
      || !isJourneyHydrated
      || !isAccountStateHydrated
      || !journeyOwnerUserId
      || !journeyReleaseAt
      || !hasActiveChat
      || !phaseOneCanAdvanceToPhaseTwo
      || phaseTwoReady
      || currentTime < phaseThreeStartTime
      || phaseTwoPenaltyAppliedAt === currentReleaseKey
      || !phaseTwoCurrentResponderUserId
    ) {
      return;
    }

    let cancelled = false;

    async function applyPhaseTwoPenalty() {
      try {
        const updatedAccount = await applyRemoteSystemPenalty({
          userId: phaseTwoCurrentResponderUserId,
          reason: "PHASE_TWO_NOT_PLAYED",
          contextKey: `phase-two-missed:${currentReleaseKey}:${phaseTwoCurrentResponderUserId}`,
          note: "Phase 2 wurde nicht rechtzeitig gespielt.",
        });

        if (!cancelled && updatedAccount.userId === currentUserId) {
          setAccountState(updatedAccount);
        }

        if (!cancelled) {
          setPhaseTwoPenaltyAppliedAt(currentReleaseKey);
        }
      } catch {
        // Retry automatically on the next render while the API is unavailable.
      }
    }

    void applyPhaseTwoPenalty();

    return () => {
      cancelled = true;
    };
  }, [
    currentReleaseKey,
    currentTime,
    currentUserId,
    hasActiveChat,
    isJourneyHydrated,
    isAccountStateHydrated,
    isServerJourneyMode,
    journeyOwnerUserId,
    journeyReleaseAt,
    phaseOneCanAdvanceToPhaseTwo,
    phaseThreeStartTime,
    phaseTwoCurrentResponderUserId,
    phaseTwoPenaltyAppliedAt,
    phaseTwoReady,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function syncMatchReleaseNotification() {
      if (!journeyOwnerUserId || !journeyReleaseAt || !hasActiveChat || !phaseOneBeforeRelease) {
        await cancelScheduledLocalNotification(scheduledMatchNotificationId);

        if (!cancelled && (scheduledMatchNotificationId || scheduledMatchNotificationReleaseAt)) {
          setScheduledMatchNotificationId(null);
          setScheduledMatchNotificationReleaseAt(null);
        }
        return;
      }

      if (scheduledMatchNotificationReleaseAt === journeyReleaseAt) {
        return;
      }

      await cancelScheduledLocalNotification(scheduledMatchNotificationId);

      const nextNotificationId = await scheduleMatchReleaseNotification(
        matchReleaseTime,
        featuredProfile.firstName,
      );

      if (!cancelled) {
        setScheduledMatchNotificationId(nextNotificationId);
        setScheduledMatchNotificationReleaseAt(journeyReleaseAt);
      }
    }

    void syncMatchReleaseNotification();

    return () => {
      cancelled = true;
    };
  }, [
    featuredProfile.firstName,
    hasActiveChat,
    journeyOwnerUserId,
    journeyReleaseAt,
    matchReleaseTime,
    phaseOneBeforeRelease,
    scheduledMatchNotificationId,
    scheduledMatchNotificationReleaseAt,
  ]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const activeUserId = currentUserId;
    let cancelled = false;

    async function syncPhaseNotifications() {
      if (!journeyOwnerUserId || !journeyReleaseAt || !hasActiveChat) {
        await clearJourneyLocalNotifications(activeUserId);
        return;
      }

      const nowMs = Date.now();
      const plans: JourneyLocalNotificationPlan[] = [];

      if (phaseOneWindowOpen && phaseOneViewerStarts && !phaseOneChatStarted) {
        const warningAt = new Date(decisionDeadline.getTime() - PHASE_WARNING_LEAD_MS);

        if (warningAt.getTime() > nowMs) {
          plans.push({
            ownerUserId: activeUserId,
            key: `${currentReleaseKey}:phase-one-warning`,
            date: warningAt,
            kind: "warning",
            title: "Es droht ein Strafpunkt",
            body: `Choice hat dich ausgewaehlt, den Chat mit ${featuredProfile.firstName} zu eroeffnen. Wenn du bis ${decisionClockLabel} nicht schreibst, droht ein Strafpunkt.`,
            data: {
              type: "phase-one-warning",
              matchId: remoteJourney?.matchId ?? currentReleaseKey,
            },
          });
        }
      }

      if (phaseOneCanAdvanceToPhaseTwo) {
        if (phaseTwoStartTime.getTime() > nowMs) {
          plans.push({
            ownerUserId: activeUserId,
            key: `${currentReleaseKey}:phase-two-start`,
            date: phaseTwoStartTime,
            kind: "phase",
            title: "Ihr seid jetzt in Phase 2",
            body:
              phaseTwoAssignedStarterUserId === activeUserId
                ? "Du beginnst diese Runde. Beantworte zuerst alle 3 Fragen."
                : `${featuredProfile.firstName} beginnt diese Runde. Danach bist du dran.`,
            data: {
              type: "phase-two-start",
              matchId: remoteJourney?.matchId ?? currentReleaseKey,
            },
          });
        }

        if (!phaseTwoReady && phaseTwoCurrentResponderUserId === activeUserId) {
          const warningAt = new Date(phaseThreeStartTime.getTime() - PHASE_WARNING_LEAD_MS);

          if (warningAt.getTime() > nowMs) {
            plans.push({
              ownerUserId: activeUserId,
              key: `${currentReleaseKey}:phase-two-warning`,
              date: warningAt,
              kind: "warning",
              title: "Es droht ein Strafpunkt",
              body: `Du bist gerade mit Phase 2 dran. Wenn du bis ${phaseThreeClockLabel} nicht mitmachst, droht ein Strafpunkt.`,
              data: {
                type: "phase-two-warning",
                matchId: remoteJourney?.matchId ?? currentReleaseKey,
              },
            });
          }
        }
      }

      if (phaseThreeQualified) {
        if (phaseThreeStartTime.getTime() > nowMs) {
          plans.push({
            ownerUserId: activeUserId,
            key: `${currentReleaseKey}:phase-three-start`,
            date: phaseThreeStartTime,
            kind: "phase",
            title: "Ihr seid jetzt in Phase 3",
            body: "Dieses Match bleibt erstmal bestehen. Wenn du lieber morgen neu starten willst, kannst du das jetzt noch ändern.",
            data: {
              type: "phase-three-start",
              matchId: remoteJourney?.matchId ?? currentReleaseKey,
            },
          });
        }

        if (phaseThreeDecisionOpen && phaseThreeViewerDecision === "undecided") {
          const reminderAt = new Date(phaseFourStartTime.getTime() - PHASE_WARNING_LEAD_MS);

          if (reminderAt.getTime() > nowMs) {
            plans.push({
              ownerUserId: activeUserId,
              key: `${currentReleaseKey}:phase-three-reminder`,
              date: reminderAt,
              kind: "warning",
              title: "Neues Match noch möglich",
              body: `Wenn du lieber morgen neu starten willst, kannst du das bis ${phaseFourClockLabel} noch ändern. Sonst bleibt dieses Match bestehen.`,
              data: {
                type: "phase-three-reminder",
                matchId: remoteJourney?.matchId ?? currentReleaseKey,
              },
            });
          }
        }
      }

      if (phaseThreeQualified && phaseFourStartTime.getTime() > nowMs) {
        plans.push({
          ownerUserId: activeUserId,
          key: `${currentReleaseKey}:phase-four-start`,
          date: phaseFourStartTime,
          kind: "phase",
          title: "Ihr seid jetzt in Phase 4",
          body: `Der Chat pausiert jetzt bis ${phaseFiveClockLabel}. Wenn du lieber neu starten willst, kannst du das bis dahin noch ändern.`,
          data: {
            type: "phase-four-start",
            matchId: remoteJourney?.matchId ?? currentReleaseKey,
          },
        });
      }

      if (phaseThreeBothStay) {
        if (phaseFiveStartTime.getTime() > nowMs) {
          plans.push({
            ownerUserId: activeUserId,
            key: `${currentReleaseKey}:phase-five-start`,
            date: phaseFiveStartTime,
            kind: "phase",
            title: "Phase 5 ist jetzt da",
            body: "Euer Choice Award wartet auf euch.",
            data: {
              type: "phase-five-start",
              matchId: remoteJourney?.matchId ?? currentReleaseKey,
            },
          });
        }
      }

      if (!cancelled) {
        await syncJourneyLocalNotifications(activeUserId, plans);
      }
    }

    void syncPhaseNotifications();

    return () => {
      cancelled = true;
    };
  }, [
    currentReleaseKey,
    currentUserId,
    decisionClockLabel,
    decisionDeadline,
    featuredProfile.firstName,
    hasActiveChat,
    journeyOwnerUserId,
    journeyReleaseAt,
    notificationSyncMinute,
    phaseFiveClockLabel,
    phaseFiveStartTime,
    phaseOneCanAdvanceToPhaseTwo,
    phaseOneChatStarted,
    phaseOneViewerStarts,
    phaseOneWindowOpen,
    phaseThreeClockLabel,
    phaseThreeDecisionOpen,
    phaseThreeQualified,
    phaseThreeStartTime,
    phaseThreeViewerDecision,
    phaseThreeBothStay,
    phaseTwoAssignedStarterUserId,
    phaseTwoCurrentResponderUserId,
    phaseTwoReady,
    phaseTwoStartTime,
    phaseFourStartTime,
    remoteJourney?.matchId,
  ]);

  useEffect(() => {
    if (!showFreshMatchNotice) {
      return;
    }

    if (currentTab === "match" || currentTab === "chats") {
      setSeenMatchReleaseAt(currentReleaseKey);
    }
  }, [currentReleaseKey, currentTab, showFreshMatchNotice]);

  function appendSharedChatMessage(
    message: SharedChatMessageInput,
    options?: {
      createdAt?: string;
      sending?: boolean;
      id?: string;
    },
  ) {
    const nextCreatedAt = options?.createdAt ?? new Date().toISOString();
    const nextSending = options?.sending ?? false;
    const nextId = options?.id ?? `shared-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setSharedChatMessages((current) => [
      ...current,
      {
        id: nextId,
        author: "primary",
        createdAt: nextCreatedAt,
        sending: nextSending,
        ...message,
      },
    ]);

    return nextId;
  }

  function removeSharedChatMessage(messageId: string) {
    setSharedChatMessages((current) => current.filter((message) => message.id !== messageId));
  }

  function openReportModal() {
    setReportReason("");
    setReportDetails("");
    setReportFeedback(null);
    setReportActionPending(null);
    setShowReportModal(true);
  }

  async function submitReport() {
    if (!currentUserId || !activePartnerUserId || !reportReason || reportActionPending) {
      return;
    }

    const latestMessagePreview = getSharedChatMessagePreview(sharedChatMessages[sharedChatMessages.length - 1]) ?? null;
    const selectedReasonLabel = getOptionLabel(reportReasonOptions, reportReason);

    setReportActionPending("report");

    try {
      await createRemoteReport({
        reporterUserId: currentUserId,
        reportedUserId: activePartnerUserId,
        matchId: remoteJourney?.matchId ?? undefined,
        reporterName: displayName,
        reportedName: featuredProfile.firstName,
        reason: selectedReasonLabel,
        details: reportDetails.trim(),
        latestMessagePreview,
      });
      setShowReportModal(false);
      setReportReason("");
      setReportDetails("");
      setReportFeedback("Meldung gespeichert. Choice prüft sie jetzt zeitnah.");
    } catch {
      setReportFeedback("Meldung konnte gerade nicht gespeichert werden. Bitte versuch es gleich nochmal.");
    } finally {
      setReportActionPending(null);
    }
  }

  async function blockCurrentPartner() {
    if (!currentUserId || !activePartnerUserId || reportActionPending) {
      return;
    }

    const latestMessagePreview = getSharedChatMessagePreview(sharedChatMessages[sharedChatMessages.length - 1]) ?? null;
    const selectedReasonLabel = reportReason ? getOptionLabel(reportReasonOptions, reportReason) : null;
    const shouldAlsoReport = Boolean(selectedReasonLabel);
    let reportSaved = false;

    setReportActionPending("block");

    try {
      if (shouldAlsoReport && selectedReasonLabel) {
        await createRemoteReport({
          reporterUserId: currentUserId,
          reportedUserId: activePartnerUserId,
          matchId: remoteJourney?.matchId ?? undefined,
          reporterName: displayName,
          reportedName: featuredProfile.firstName,
          reason: selectedReasonLabel,
          details: reportDetails.trim(),
          latestMessagePreview,
        });
        reportSaved = true;
      }

      const journey = await blockRemoteJourneyPartner({
        userId: currentUserId,
        blockedUserId: activePartnerUserId,
      });

      applyRemoteJourneyState(journey);
      setShowReportModal(false);
      setShowChatDecisionModal(false);
      setChatOpen(false);
      onSelectTab("today");
      setReportReason("");
      setReportDetails("");
      setReportFeedback(
        reportSaved
          ? `${featuredProfile.firstName} ist jetzt blockiert. Deine Meldung wurde gespeichert und dieses Match sofort beendet.`
          : `${featuredProfile.firstName} ist jetzt blockiert. Dieses Match wurde sofort beendet und wird dir nicht noch einmal vorgeschlagen.`,
      );
    } catch {
      setReportFeedback(
        reportSaved
          ? "Meldung gespeichert, aber die Blockierung konnte gerade nicht abgeschlossen werden. Bitte versuch es gleich nochmal."
          : "Blockierung konnte gerade nicht gespeichert werden. Bitte versuch es gleich nochmal.",
      );
    } finally {
      setReportActionPending(null);
    }
  }

  useEffect(() => {
    if (currentTab !== "chats") {
      setChatOpen(false);
      setPhaseTwoOpen(false);
      setShowChatDecisionModal(false);
    }
  }, [currentTab]);

  useEffect(() => {
    if (currentTab !== "chats" || !chatOpen || !latestPartnerMessageId) {
      return;
    }

    setLastSeenPartnerMessageId((current) => (
      current === latestPartnerMessageId ? current : latestPartnerMessageId
    ));
  }, [chatOpen, currentTab, latestPartnerMessageId]);

  useEffect(() => {
    if (!phaseTwoOpen || phaseTwoStage === "result") {
      return;
    }

    if (!phaseTwoViewerCanAnswer) {
      setPhaseTwoOpen(false);
    }
  }, [phaseTwoOpen, phaseTwoStage, phaseTwoViewerCanAnswer]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (isServerJourneyMode || !isJourneyHydrated || !journeyOwnerUserId || !journeyReleaseAt) {
      return;
    }

    if (phaseOneClosed && !phaseOneCanAdvanceToPhaseTwo && currentTime >= phaseTwoStartTime) {
      resetJourneyState(journeyOwnerUserId, phaseTwoStartTime.toISOString());
      return;
    }

    if (!phaseTwoReady && phaseOneCanAdvanceToPhaseTwo && currentTime >= phaseThreeStartTime) {
      resetJourneyState(journeyOwnerUserId, phaseThreeStartTime.toISOString());
      return;
    }

    if (phaseTwoReady && phaseTwoCompatibility <= PHASE_THREE_THRESHOLD && currentTime >= phaseThreeStartTime) {
      resetJourneyState(journeyOwnerUserId, phaseThreeStartTime.toISOString());
      return;
    }

    if (phaseThreeUnlocked && !phaseThreeBothStay && currentTime >= phaseFiveStartTime) {
      resetJourneyState(journeyOwnerUserId, phaseFiveStartTime.toISOString());
    }
  }, [
    currentTime,
    isServerJourneyMode,
    isJourneyHydrated,
    journeyOwnerUserId,
    journeyReleaseAt,
    phaseFiveStartTime,
    phaseOneCanAdvanceToPhaseTwo,
    phaseOneClosed,
    phaseThreeBothStay,
    phaseThreeStartTime,
    phaseThreeUnlocked,
    phaseTwoCompatibility,
    phaseTwoReady,
    phaseTwoStartTime,
  ]);

  useEffect(() => {
    if (!photoViewer) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      photoViewerRef.current?.scrollTo({
        x: photoViewerPageWidth * photoViewer.index,
        animated: false,
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [photoViewer, photoViewerPageWidth]);

  function openPhotoViewer(uris: string[], index: number) {
    setPhotoViewer({ uris, index });
    setPhotoViewerIndex(index);
  }

  if (!isJourneyHydrated) {
    return (
      <View style={styles.sessionRestoreShell}>
        <Text style={styles.sessionRestoreText}>CHOICE</Text>
      </View>
    );
  }

  if (accountPaused) {
    return (
      <View
        style={[
          styles.overviewShell,
          {
            paddingBottom: Math.max(insets.bottom > 0 ? insets.bottom - 6 : 8, 6),
          },
        ]}
      >
        <View style={styles.overviewHeaderStatic}>
          <Text style={styles.overviewHeaderEyebrow}>Choice</Text>
        </View>

        <View style={styles.accountPausedWrap}>
          <View style={styles.overviewStatusCard}>
            <Text style={styles.overviewStatusEyebrow}>{accountBanned ? "Konto gesperrt" : "Konto pausiert"}</Text>
            <Text style={styles.overviewStatusTitle}>
              {accountBanned ? "Dein Konto ist dauerhaft gesperrt." : "Dein Konto ist gerade pausiert."}
            </Text>
            <Text style={styles.overviewStatusText}>
              {accountBanned
                ? "Choice hat dein Konto wegen schwerem oder wiederholtem Verstoß dauerhaft gesperrt. Du kannst keine Matches öffnen, keine Chats nutzen und nicht normal weitermachen."
                : `Du hast ${penaltyPoints}/${maxPenaltyPoints} Strafpunkte erreicht. Solange das Konto pausiert ist, kannst du keine Matches öffnen, keine Chats nutzen und nicht normal weitermachen.`}
            </Text>
          </View>

          <View style={styles.overviewRuleCard}>
            <Text style={styles.overviewRuleTitle}>{accountBanned ? "Was das für gekaufte Matches bedeutet" : "Warum das passiert ist"}</Text>
            <Text style={styles.overviewRuleText}>
              {accountBanned
                ? forfeitedPaidMatchCredits > 0
                  ? `${forfeitedPaidMatchCredits} gekaufte Matches sind mit der Sperrung verfallen.`
                  : "Auch zahlende Konten können dauerhaft gesperrt werden."
                : frozenPaidMatchCredits > 0
                  ? `${frozenPaidMatchCredits} gekaufte Matches sind eingefroren und können nach einer Entsperrung wieder freigegeben werden.`
                  : `Choice pausiert Konten bei drei bestätigten Strafpunkten automatisch. Wenn derselbe Verstoß ${penaltyRecoveryWindowDays} Tage lang nicht noch einmal vorkommt, verschwindet der dazugehörige Punkt wieder.`}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              void openExternalUrl(LEGAL_URLS.supportModeration);
            }}
            style={styles.legalSupportButton}
          >
            <Text style={styles.legalSupportButtonText}>Entscheidung prüfen lassen</Text>
            <Text style={styles.legalSupportButtonMeta}>Öffnet direkt den Kontakt für Moderations- und Einspruchsanliegen.</Text>
          </Pressable>

          <View style={styles.accountActionsList}>
            <Pressable onPress={() => { void onSignOut(); }} style={styles.accountActionButton} disabled={accountActionPending}>
              <View style={styles.accountActionCopy}>
                <Text style={styles.accountActionTitle}>Abmelden</Text>
                <Text style={styles.accountActionMeta}>Zu einem anderen Konto wechseln.</Text>
              </View>
              <Text style={styles.accountActionArrow}>›</Text>
            </Pressable>

            <Pressable
              onPress={() => { void onDeleteAccount(); }}
              style={[styles.accountActionButton, styles.accountActionButtonDanger]}
              disabled={accountActionPending}
            >
              <View style={styles.accountActionCopy}>
                <Text style={[styles.accountActionTitle, styles.accountActionTitleDanger]}>Konto löschen</Text>
                <Text style={styles.accountActionMeta}>Profil, Matches und Chats dauerhaft entfernen.</Text>
              </View>
              <Text style={[styles.accountActionArrow, styles.accountActionArrowDanger]}>›</Text>
            </Pressable>
          </View>

          {accountActionMessage ? <Text style={styles.accountActionMessage}>{accountActionMessage}</Text> : null}
        </View>
      </View>
    );
  }

  if (currentTab === "chats" && phaseTwoOpen) {
    return (
      <View
        style={[
          styles.chatFullScreenShell,
          {
            marginTop: -insets.top,
            marginBottom: -insets.bottom,
          },
        ]}
      >
        <View
          style={[
            styles.chatSurfaceHeader,
            styles.chatSurfaceHeaderFullScreen,
            { paddingTop: insets.top + 12 },
          ]}
        >
          <Pressable
            onPress={() => {
              setPhaseTwoOpen(false);
            }}
            style={styles.chatSurfaceBackButton}
          >
            <Text style={styles.chatSurfaceBackButtonText}>‹</Text>
          </Pressable>

          <View style={styles.chatSurfaceProfileButton}>
            <View style={styles.chatSurfaceAvatarWrap}>
              <View style={styles.phaseTwoAvatarFallback}>
                <Text style={styles.phaseTwoAvatarText}>≈</Text>
              </View>
            </View>

            <View style={styles.chatSurfaceHeaderCopy}>
              <Text style={styles.chatSurfaceTitle}>Choice-Runde</Text>
              <Text style={styles.chatSurfaceSubtitle}>Phase 2 • 3 Fragen</Text>
            </View>
          </View>

          <View style={styles.phaseTwoHeaderBadge}>
            <Text style={styles.phaseTwoHeaderBadgeText}>
              {phaseTwoStage === "result"
                ? "Ergebnis"
                : phaseTwoViewerCanAnswer
                  ? `${Math.min(phaseTwoRoundIndex + 1, phaseTwoRounds.length)}/${phaseTwoRounds.length}`
                  : `${phaseTwoCurrentResponderName} dran`}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.phaseTwoScrollContent, { paddingBottom: insets.bottom + 20 }]}>
          {phaseTwoStage === "result" ? (
            <View style={styles.phaseTwoResultCard}>
              <Text style={styles.phaseTwoEyebrow}>Choice-Ergebnis</Text>
              <Text style={styles.phaseTwoResultValue}>{phaseTwoCompatibility}%</Text>
              <View
                style={[
                  styles.phaseTwoStatusPill,
                  phaseThreeQualified ? styles.phaseTwoStatusPillSuccess : styles.phaseTwoStatusPillMuted,
                ]}
              >
                <Text style={styles.phaseTwoStatusPillText}>
                  {phaseThreeQualified
                    ? phaseThreeDecisionOpen
                      ? "Über 50% erreicht • Phase 3 ist jetzt offen"
                      : `Über 50% erreicht • Phase 3 startet in ${phaseThreeStartsInLabel}`
                    : "50% oder weniger • es geht nicht weiter in Phase 3"}
                </Text>
              </View>
              <Text style={styles.phaseTwoResultTitle}>{getPhaseTwoResultHeadline(phaseTwoCompatibility, phaseThreeQualified)}</Text>
              <Text style={styles.phaseTwoResultText}>{getPhaseTwoResultSupportText(phaseTwoCompatibility, phaseThreeQualified)}</Text>
              <View style={styles.phaseTwoResultInsightCard}>
                <Text style={styles.phaseTwoResultInsightLabel}>Choice sagt</Text>
                <Text style={styles.phaseTwoResultInsightText}>
                  {getPhaseTwoOverallComment(phaseTwoResults, phaseTwoCompatibility, phaseThreeQualified)}
                </Text>
              </View>

              <View style={styles.phaseTwoResultList}>
                {phaseTwoResults.map((entry, index) => (
                  <View key={entry.roundId} style={styles.phaseTwoResultRound}>
                    <View style={styles.phaseTwoResultRoundTop}>
                      <Text style={styles.phaseTwoResultRoundLabel}>Runde {index + 1}</Text>
                      <Text style={styles.phaseTwoResultRoundScore}>{entry.compatibility}%</Text>
                    </View>
                    <Text style={styles.phaseTwoResultRoundTopic}>
                      {getPhaseTwoTopicLabel(entry.roundId)} • {getPhaseTwoDifferenceLabel(entry.compatibility)}
                    </Text>
                    <Text style={styles.phaseTwoResultRoundText}>{phaseTwoStarterName}: {entry.personALabel}</Text>
                    <Text style={styles.phaseTwoResultRoundText}>{phaseTwoPartnerName}: {entry.personBLabel}</Text>
                    <Text style={styles.phaseTwoResultRoundComment}>{getPhaseTwoRoundComment(entry)}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  setPhaseTwoOpen(false);
                }}
                style={styles.doneButton}
              >
                <Text style={styles.doneButtonText}>Zum Chat</Text>
              </Pressable>
            </View>
          ) : phaseTwoCurrentRound ? (
            <>
              <View style={styles.phaseTwoProgressCard}>
                <Text style={styles.phaseTwoEyebrow}>Kompatibilität in 3 Runden</Text>
                <Text style={styles.phaseTwoProgressTitle}>
                  {phaseTwoStage === "starter"
                    ? `${phaseTwoStarterName} beantwortet zuerst alle 3 Fragen.`
                    : `${phaseTwoPartnerName} beantwortet jetzt dieselben 3 Themen.`}
                </Text>
                <View style={styles.phaseTwoProgressTrack}>
                  <View
                    style={[
                      styles.phaseTwoProgressFill,
                      { width: `${phaseTwoProgressRatio * 100}%` },
                    ]}
                  />
                </View>
              </View>

              {phaseTwoViewerCanAnswer ? (
                <>
                  {phaseTwoStage === "partner" ? (
                    <View style={styles.phaseTwoContextCard}>
                      <Text style={styles.phaseTwoContextLabel}>Das Thema</Text>
                      <Text style={styles.phaseTwoContextValue}>{getPhaseTwoTopicLabel(phaseTwoCurrentRound.id)}</Text>
                    </View>
                  ) : null}

                  <View style={styles.phaseTwoQuestionCard}>
                    <Text style={styles.phaseTwoQuestionEyebrow}>
                      {phaseTwoStage === "starter"
                        ? `Frage ${phaseTwoRoundIndex + 1} von ${phaseTwoRounds.length} • ${phaseTwoStarterName}`
                        : `Frage ${phaseTwoRoundIndex + 1} von ${phaseTwoRounds.length} • ${phaseTwoPartnerName}`}
                    </Text>
                    <Text style={styles.phaseTwoQuestionText}>
                      {phaseTwoStage === "starter" ? phaseTwoCurrentRound.prompt : phaseTwoCurrentResult?.followUpPrompt}
                    </Text>
                    {phaseTwoSubmitPending ? (
                      <Text style={styles.phaseTwoSavingText}>Choice speichert deine Antwort gerade ...</Text>
                    ) : null}
                  </View>

                  <View style={styles.phaseTwoAnswerList}>
                    {(phaseTwoStage === "starter"
                      ? phaseTwoCurrentRound.answerOptions
                      : phaseTwoCurrentResult?.followUpOptions ?? []
                    ).map((option) => (
                      <Pressable
                        key={`${phaseTwoCurrentRound.id}-${phaseTwoStage}-${option.label}`}
                        onPress={() =>
                          phaseTwoStage === "starter"
                            ? selectPhaseTwoAnswerA(option as PhaseTwoAnswerBranch)
                            : selectPhaseTwoAnswerB(option as PhaseTwoResponseOption)
                        }
                        style={({ pressed }) => [
                          styles.phaseTwoAnswerCard,
                          pressed && styles.phaseTwoAnswerCardPressed,
                        ]}
                      >
                        <View style={styles.phaseTwoAnswerScoreBubble}>
                          <Text style={styles.phaseTwoAnswerScoreText}>{option.score}</Text>
                        </View>
                        <Text style={styles.phaseTwoAnswerText}>{option.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.phaseTwoWaitCard}>
                  <Text style={styles.phaseTwoWaitLabel}>Jetzt ist {phaseTwoCurrentResponderName} dran</Text>
                  <Text style={styles.phaseTwoWaitText}>
                    {phaseTwoStarterName} hat seinen Teil beendet. Diese Seite bleibt jetzt bewusst geschlossen, bis {phaseTwoCurrentResponderName} antwortet.
                  </Text>
                  <Pressable onPress={onOpenAccountSwitcher} style={styles.phaseTwoWaitButton}>
                    <Text style={styles.phaseTwoWaitButtonText}>Zu {phaseTwoCurrentResponderName} wechseln</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  if (currentTab === "chats" && chatOpen) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={[
          styles.chatFullScreenShell,
          {
            marginTop: -insets.top,
            marginBottom: -insets.bottom,
          },
        ]}
      >
        <ChatSurface
          title={chatTitle}
          subtitle={chatSubtitle}
          subtitleOnline={chatSubtitleOnline}
          avatarUri={hasActiveChat ? featuredProfile.imageUri : undefined}
          avatarFallback={hasActiveChat ? featuredProfile.firstName.slice(0, 1) : "C"}
          messages={renderedChatMessages}
          emptyStateTitle={chatEmptyStateTitle}
          emptyStateText={chatEmptyStateText}
          composerPlaceholder={chatComposerPlaceholder}
          composerValue={chatDraft}
          composerEditable={chatComposerEditable}
          composerBusy={chatSendPending}
          composerHidden={chatComposerHidden}
          composerLockedText={chatComposerLockedText}
          composerStatusText={chatSendError}
          fullScreen
          onBack={() => setChatOpen(false)}
          onOpenProfile={hasActiveChat ? () => {
            setChatOpen(false);
            onSelectTab("match");
          } : undefined}
          onReportPress={hasActiveChat && !phaseOneBeforeRelease ? openReportModal : undefined}
          headerActionState={chatHeaderActionState}
          onHeaderActionPress={hasActiveChat && (phaseOneWindowOpen || phaseThreeDecisionOpen) ? () => setShowChatDecisionModal(true) : undefined}
          onComposerChangeText={setChatDraft}
          onSend={sendChatMessage}
          topInset={insets.top}
          bottomInset={insets.bottom}
          threadSupplement={renderPhaseAdvanceNotice()}
          threadSupplementPlacement={phaseFiveUnlocked || phaseFiveRestartSelected ? "inline" : "docked"}
        />
        <Modal transparent visible={showChatDecisionModal} animationType="fade" onRequestClose={() => setShowChatDecisionModal(false)}>
          <Pressable style={styles.chatDecisionOverlay} onPress={() => setShowChatDecisionModal(false)}>
            <Pressable style={styles.chatDecisionCard} onPress={() => {}}>
              <Text style={styles.chatDecisionEyebrow}>
                {phaseThreeUnlocked
                  ? phaseFourWindowLocked
                    ? "Phase 4"
                    : "Für morgen"
                  : "Nach dem Match"}
              </Text>
              <Text style={styles.chatDecisionTitle}>
                {phaseThreeUnlocked
                  ? phaseFourWindowLocked
                    ? "Möchtest du nach der Pause bei diesem Match bleiben?"
                    : "Möchtest du morgen bei diesem Match bleiben?"
                  : "Möchtest du diesen Chat weiterführen?"}
              </Text>
              <Text style={styles.chatDecisionText}>
                {phaseThreeUnlocked
                  ? phaseFourWindowLocked
                    ? `Der Chat pausiert gerade bis ${phaseFiveClockLabel}. Standardmäßig geht es danach mit ${featuredProfile.firstName} weiter. Wenn du lieber mit ${phaseThreeSuggestedWithMatchLabel} neu starten willst, kannst du das bis dahin noch ändern.`
                    : `Choice schlägt dir für morgen ${phaseThreeSuggestedNewMatchLabel} als Alternative vor. Standardmäßig bleibst du bei diesem Match, kannst aber bis ${phaseFourClockLabel} noch wechseln.`
                  : "Wenn es sich gut anfühlt, kannst du Phase 2 vormerken. Sonst gehst du morgen einfach mit einem neuen Match weiter."}
              </Text>

              <View style={styles.chatDecisionButtonColumn}>
              {(() => {
                const viewerContinueVisualSelected = phaseThreeUnlocked
                  ? phaseThreeViewerDecision !== "new-match"
                  : phaseOneViewerDecision !== "new-match";

                return (
                  <>
                <Pressable
                  onPress={() => {
                    if (phaseThreeUnlocked) {
                      setViewerPhaseThreeDecision("stay");
                    } else {
                      setViewerPhaseOneDecision("continue");
                    }
                    setShowChatDecisionModal(false);
                  }}
                  style={({ pressed }) => [
                    styles.chatDecisionOptionButton,
                    pressed && styles.chatDecisionOptionButtonPressed,
                    viewerContinueVisualSelected && styles.chatDecisionOptionButtonActive,
                    viewerContinueVisualSelected && pressed && styles.chatDecisionOptionButtonActivePressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.chatDecisionOptionIcon,
                      viewerContinueVisualSelected && styles.chatDecisionOptionIconActive,
                    ]}
                  >
                    ♥
                  </Text>
                  <View style={styles.chatDecisionOptionCopy}>
                    <Text style={[styles.chatDecisionOptionTitle, viewerContinueVisualSelected && styles.chatDecisionOptionTitleActive]}>
                      {phaseThreeUnlocked ? "Bleiben" : "Phase 2 vormerken"}
                    </Text>
                    <Text style={styles.chatDecisionOptionText}>
                      {phaseThreeUnlocked
                        ? phaseFourWindowLocked
                          ? `Nach ${phaseFiveClockLabel} mit diesem Match weiterschreiben.`
                          : "Morgen mit diesem Match weiterschreiben."
                        : "Diesen Chat würdest du gern weiterführen."}
                    </Text>
                  </View>
                  {viewerContinueVisualSelected ? (
                    <View style={styles.chatDecisionOptionMark}>
                      <Text style={styles.chatDecisionOptionMarkText}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (phaseThreeUnlocked) {
                      setViewerPhaseThreeDecision("new-match");
                    } else {
                      setViewerPhaseOneDecision("new-match");
                    }
                    setShowChatDecisionModal(false);
                  }}
                  style={({ pressed }) => [
                    styles.chatDecisionOptionButton,
                    pressed && styles.chatDecisionOptionButtonPressed,
                    (phaseThreeUnlocked ? phaseThreeViewerDecision === "new-match" : phaseOneViewerDecision === "new-match") && styles.chatDecisionOptionButtonActiveMuted,
                    (phaseThreeUnlocked ? phaseThreeViewerDecision === "new-match" : phaseOneViewerDecision === "new-match") && pressed && styles.chatDecisionOptionButtonActiveMutedPressed,
                  ]}
                >
                  <Text style={styles.chatDecisionOptionIcon}>○</Text>
                  <View style={styles.chatDecisionOptionCopy}>
                    <Text
                      style={[
                        styles.chatDecisionOptionTitle,
                        (phaseThreeUnlocked ? phaseThreeViewerDecision === "new-match" : phaseOneViewerDecision === "new-match") && styles.chatDecisionOptionTitleActiveMuted,
                      ]}
                    >
                      {phaseThreeUnlocked ? "Neu starten" : "Lieber neues Match"}
                    </Text>
                    <Text style={styles.chatDecisionOptionText}>
                      {phaseThreeUnlocked
                        ? phaseFourWindowLocked
                          ? `Nach der Pause lieber mit ${phaseThreeSuggestedWithMatchLabel} neu starten.`
                          : `Morgen lieber mit ${phaseThreeSuggestedWithMatchLabel} chatten.`
                        : "Du möchtest morgen ein neues Match."}
                    </Text>
                  </View>
                  {(phaseThreeUnlocked ? phaseThreeViewerDecision === "new-match" : phaseOneViewerDecision === "new-match") ? (
                    <View style={styles.chatDecisionOptionMarkMuted}>
                      <Text style={styles.chatDecisionOptionMarkMutedText}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>
                  </>
                );
              })()}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        <Modal
          transparent
          visible={showReportModal}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowReportModal(false)}
        >
          <View style={styles.reportModalOverlay}>
            <Pressable style={styles.reportModalBackdrop} onPress={() => setShowReportModal(false)} />
            <ScrollView
              style={styles.reportModalScroll}
              contentContainerStyle={[
                styles.reportModalScrollContent,
                {
                  paddingTop: insets.top + 24,
                  paddingBottom: insets.bottom + 24,
                },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.reportModalCard}>
                <Text style={styles.chatDecisionEyebrow}>Sicherheit</Text>
                <Text style={styles.chatDecisionTitle}>Melden oder blockieren?</Text>
                <Text style={styles.chatDecisionText}>
                  Choice prüft Meldungen zeitnah. Wenn du blockierst, endet dieser Chat sofort und die Person wird dir nicht noch einmal vorgeschlagen.
                </Text>

                <View style={styles.reportReasonList}>
                  {reportReasonOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setReportReason(option.value)}
                      style={[
                        styles.reportReasonOption,
                        reportReason === option.value && styles.reportReasonOptionActive,
                      ]}
                    >
                      <Text style={[styles.reportReasonOptionText, reportReason === option.value && styles.reportReasonOptionTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  placeholder="Optional etwas genauer beschreiben"
                  placeholderTextColor="#8e86ad"
                  multiline
                  style={styles.reportDetailsInput}
                />

                <View style={styles.reportModalActionColumn}>
                  <View style={styles.reportModalActionRow}>
                    <Pressable
                      onPress={() => setShowReportModal(false)}
                      style={styles.reportModalCancelButton}
                      disabled={reportActionPending !== null}
                    >
                      <Text style={styles.reportModalCancelButtonText}>Abbrechen</Text>
                    </Pressable>
                    <Pressable
                      onPress={submitReport}
                      disabled={!reportReason || reportActionPending !== null}
                      style={[
                        styles.reportModalSubmitButton,
                        (!reportReason || reportActionPending !== null) && styles.reportModalSubmitButtonDisabled,
                      ]}
                    >
                      <Text style={styles.reportModalSubmitButtonText}>
                        {reportActionPending === "report" ? "Wird gesendet ..." : "Nur melden"}
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => {
                      void blockCurrentPartner();
                    }}
                    disabled={reportActionPending !== null}
                    style={[
                      styles.reportModalBlockButton,
                      reportActionPending !== null && styles.reportModalBlockButtonDisabled,
                    ]}
                  >
                    <Text style={styles.reportModalBlockButtonText}>
                      {reportActionPending === "block"
                        ? "Wird gesichert ..."
                        : reportReason
                          ? "Melden und blockieren"
                          : "Diese Person blockieren"}
                    </Text>
                  <Text style={styles.reportModalBlockButtonMeta}>
                      {reportReason
                        ? "Die Meldung wird mitgespeichert und das Match sofort beendet."
                        : "Ohne neue Meldung beenden und für künftige Matches ausblenden."}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  function renderPenaltyCard() {
    return (
      <View style={styles.penaltyCard}>
        <View style={styles.penaltyHeaderRow}>
          <View style={styles.penaltyTitleWrap}>
            <Text style={styles.penaltyEyebrow}>Fair Play</Text>
            <Text style={styles.penaltyTitle}>Strafpunkte</Text>
          </View>
          <View style={styles.penaltyBadge}>
            <Text style={styles.penaltyBadgeText}>
              {penaltyPoints}/{maxPenaltyPoints}
            </Text>
          </View>
        </View>

        <Text style={styles.penaltyText}>
          Ein bestätigter Verstoß gibt einen Strafpunkt. Bei drei Punkten wird dein Konto pausiert. So baust du Punkte wieder ab: Wenn derselbe Verstoß {penaltyRecoveryWindowDays} Tage lang nicht noch einmal vorkommt, verschwindet der dazugehörige Strafpunkt wieder. Gekaufte Match-Pakete werden dann eingefroren und nur bei dauerhafter Sperre endgültig verloren.
        </Text>

        <View style={styles.penaltyProgressRow}>
          <ProgressRing current={penaltyPoints} total={maxPenaltyPoints} activeColor="#ff7b9d" label="Punkte" />
          <View style={styles.penaltyProgressCopy}>
            <Text style={styles.penaltyProgressTitle}>
              {penaltyPoints === 0 ? "Konto in gutem Stand" : `${remainingPenaltyPoints} bis zur Pause`}
            </Text>
            <Text style={styles.penaltyFootnote}>
              {penaltyPoints === 0
                ? "Aktuell ist alles sauber. Solange du das Format fair nutzt, bleibt dein Konto problemlos aktiv."
                : `Noch ${remainingPenaltyPoints} Punkt${remainingPenaltyPoints === 1 ? "" : "e"} bis dein Konto pausiert wird. Wenn derselbe Verstoß ${penaltyRecoveryWindowDays} Tage lang nicht noch einmal vorkommt, verschwindet der dazugehörige Punkt wieder.`}
            </Text>
          </View>
        </View>

        <View style={styles.penaltyReasonList}>
          <Text style={styles.penaltyReasonIntro}>Dafür kann es Strafpunkte geben:</Text>
          {penaltyReasons.map((reason) => (
            <View key={reason} style={styles.penaltyReasonItem}>
              <View style={styles.penaltyReasonDot} />
              <Text style={styles.penaltyReasonText}>{reason}</Text>
            </View>
          ))}
        </View>

        <View style={styles.penaltyHistoryBlock}>
          <Text style={styles.penaltyProgressTitle}>Aktive Strafpunkte</Text>
          <Text style={styles.penaltyFootnote}>
            Hier siehst du nur die Punkte, die gerade noch aktiv sind. Nach {penaltyRecoveryWindowDays} Tagen ohne denselben Verstoß baut sich der jeweilige Punkt automatisch wieder ab.
          </Text>
          {activePenaltyEntries.length ? (
            <View style={styles.penaltyHistoryList}>
              {activePenaltyEntries.map((entry) => (
                <View key={entry.id} style={styles.penaltyHistoryItem}>
                  <View style={styles.penaltyHistoryHeader}>
                    <Text style={styles.penaltyHistoryReason}>{entry.reasonLabel}</Text>
                    <View
                      style={[
                        styles.penaltyHistoryStatusBadge,
                        styles.penaltyHistoryStatusBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.penaltyHistoryStatusText,
                          styles.penaltyHistoryStatusTextActive,
                        ]}
                      >
                        Aktiv
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.penaltyHistoryMeta}>
                    {formatDateTime(entry.createdAt)}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </Text>
                  <Text style={styles.penaltyHistoryCountdown}>
                    Noch {formatPenaltyCountdownLabel(entry.expiresAtMs - currentTime.getTime())}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.penaltyFootnote}>Gerade ist kein Strafpunkt mehr aktiv.</Text>
          )}
        </View>

        <Pressable
          onPress={() => {
            void openExternalUrl(LEGAL_URLS.supportModeration);
          }}
          style={styles.legalSupportButton}
        >
          <Text style={styles.legalSupportButtonText}>Moderationsentscheidung prüfen lassen</Text>
          <Text style={styles.legalSupportButtonMeta}>Öffnet direkt den Kontakt für Einspruch, Rückfragen und Support.</Text>
        </Pressable>
      </View>
    );
  }

  function renderFreshMatchNotice() {
    if (!showFreshMatchNotice) {
      return null;
    }

    return (
      <View style={styles.matchReleaseNoticeCard}>
        <Text style={styles.matchReleaseNoticeEyebrow}>Neu für dich</Text>
        <Text style={styles.matchReleaseNoticeTitle}>Dein Match ist jetzt freigeschaltet.</Text>
        <Text style={styles.matchReleaseNoticeText}>
          Choice hat {featuredProfile.firstName} jetzt für dich geöffnet. Schau dir kurz an, warum dieses Match heute passen könnte.
        </Text>

        <View style={styles.matchReleaseProfilePreview}>
          <Image source={{ uri: featuredProfile.imageUri }} style={styles.matchReleaseProfileImage} />
          <View style={styles.matchReleaseProfileCopy}>
            <Text style={styles.matchReleaseProfileName}>
              {featuredProfile.firstName}, {featuredProfile.age}
            </Text>
            <Text style={styles.matchReleaseProfileMeta}>{featuredProfileMeta}</Text>
            <Text style={styles.matchReleaseProfileTagline}>
              {featuredProfile.tagline || `${featuredProfile.firstName} ist jetzt dein Match fuer heute.`}
            </Text>
          </View>
        </View>

        {choiceMatchReasons.length ? (
          <View style={styles.matchReleaseReasonList}>
            {choiceMatchReasons.slice(0, 2).map((reason) => (
              <Text key={reason.label} style={styles.matchReleaseReasonText}>
                • {reason.text}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.matchReleaseNoticeActions}>
          <Pressable onPress={() => onSelectTab("match")} style={styles.matchReleaseNoticeGhostButton}>
            <Text style={styles.matchReleaseNoticeGhostText}>Zum Match</Text>
          </Pressable>
          <Pressable onPress={() => onSelectTab("chats")} style={styles.matchReleaseNoticeSolidButton}>
            <Text style={styles.matchReleaseNoticeSolidText}>Zum Chat</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderPhaseAdvanceNotice() {
    if (!hasActiveChat || phaseOneBeforeRelease) {
      return null;
    }

    if (phaseFiveUnlocked && !phaseFiveViewerHasWritten) {
      return (
        <View style={styles.phaseFiveNoticeCard}>
        <View style={styles.phaseFiveNoticeBadge}>
          <Text style={styles.phaseFiveNoticeBadgeText}>Choice Award</Text>
        </View>
          <Text style={styles.phaseFiveNoticeTitle}>Euer Choice Award ist jetzt verfügbar.</Text>
          <Text style={styles.phaseFiveNoticeText}>
            Ihr habt alle fünf Phasen geschafft. Jetzt zeigt Choice nur noch, was zwischen euch wirklich geblieben ist.
          </Text>
          <View style={styles.phaseFiveNoticeFooter}>
            <Text style={styles.phaseFiveNoticeFooterText}>Der Chat ist wieder offen.</Text>
          </View>
        </View>
      );
    }

    let eyebrow = "";
    let title = "";
    let text = "";
    let buttonLabel: string | null = null;
    let onPress: (() => void) | null = null;

    if (phaseOneClosed && !phaseOneChatStarted) {
      eyebrow = "Phase 1";
      title = "Die erste Nachricht ist ausgeblieben.";
      text = "Dadurch endet dieses Match jetzt. Die Start-Person bekommt dafür einen Strafpunkt, danach folgt wieder ein neues Match.";
    } else if (!phaseTwoReady && phaseOneCanAdvanceToPhaseTwo && currentTime >= phaseTwoStartTime) {
      eyebrow = "Phase 2";

      if (phaseTwoOverdue) {
        title = "Phase 2 wurde nicht rechtzeitig gespielt.";
        text = phaseTwoPenaltyJustApplied
          ? "Die laufende Runde wurde nicht rechtzeitig abgeschlossen. Dafür wurde ein Strafpunkt vergeben, und dieses Match endet jetzt."
          : "Die Frist für Phase 2 ist abgelaufen. Dieses Match endet jetzt.";
      } else if (phaseTwoViewerCanAnswer) {
        title = phaseTwoOverdue ? "Phase 2 wartet jetzt auf dich." : "Du beginnst jetzt Phase 2.";
        text = phaseTwoHasStarted
          ? "Dein Teil der Choice-Runde ist offen. Erst wenn du ihn abschließt, geht es hier weiter."
          : "Beantworte jetzt zuerst alle 3 Fragen.";
        buttonLabel = "Weiter";
        onPress = openOrStartPhaseTwo;
      } else {
        title = phaseTwoHasStarted
          ? `${phaseTwoCurrentResponderName} ist gerade mit der Runde dran.`
          : `${phaseTwoCurrentResponderName} beginnt jetzt mit Phase 2.`;
        text = `Bevor hier etwas weitergeht, muss zuerst die Choice-Runde gespielt werden.`;
      }
    } else if (phaseFourWindowLocked && phaseThreeDecisionPending) {
      eyebrow = "Phase 4";
      title = "Die Pause läuft gerade.";
      text = `Euer Match bleibt aktuell bestehen. Bis ${phaseFiveClockLabel} kannst du noch auf ${phaseThreeSuggestedWithMatchLabel} wechseln, wenn du lieber neu starten willst.`;
      buttonLabel = "Ändern";
      onPress = () => setShowChatDecisionModal(true);
    } else if (phaseThreeDecisionPending) {
      eyebrow = "Phase 3";
      title = "Phase 3 ist jetzt da.";
      text = `Choice zeigt euch ${phaseThreeSuggestedNewMatchLabel} für morgen als Alternative. Aktuell bleibt ihr bei diesem Match. Wenn du lieber wechseln willst, kannst du das bis ${phaseFourClockLabel} ändern.`;
      buttonLabel = "Optionen";
      onPress = () => setShowChatDecisionModal(true);
    } else if (phaseFiveRestartSelected) {
      eyebrow = "Phase 5";
      title = phaseFiveViewerSelectedNewMatch
        ? "Für morgen ist wieder ein neues Match vorgemerkt."
        : `${featuredProfile.firstName} möchte morgen ein neues Match.`;
      text = phaseFiveViewerSelectedNewMatch
        ? "Du gibst dieses Match damit auf. Choice sucht dir für morgen wieder ein neues Match."
        : "Mindestens eine Person gibt dieses Match hier auf. Deshalb endet es jetzt.";
    } else if (phaseFourUnlocked && !phaseFiveUnlocked) {
      eyebrow = "Phase 4";
      title = "Phase 4 läuft jetzt.";
      text = `Zwischen ${phaseFourClockLabel} und ${phaseFiveClockLabel} bleibt euer Chat bewusst geschlossen.`;
    } else {
      return null;
    }

    return (
      <View style={styles.phaseNoticeCard}>
        <View style={styles.phaseNoticeCopy}>
          <Text style={styles.phaseNoticeEyebrow}>{eyebrow}</Text>
          <Text style={styles.phaseNoticeTitle}>{title}</Text>
          <Text style={styles.phaseNoticeText}>{text}</Text>
        </View>

        {buttonLabel && onPress ? (
          <Pressable onPress={onPress} style={styles.phaseNoticeButton}>
            <Text style={styles.phaseNoticeButtonText}>{buttonLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderHomeCurrentPhaseCard() {
    if (!hasActiveChat || phaseOneBeforeRelease) {
      return null;
    }

    if (phaseFiveUnlocked) {
      return (
        <View style={styles.overviewStatusCard}>
          <Text style={styles.overviewStatusEyebrow}>Choice Award</Text>
          <Text style={styles.overviewStatusTitle}>Euer Choice Award ist jetzt verfügbar.</Text>
          <Text style={styles.overviewStatusText}>
            Choice zeigt euch jetzt, was nach allen Phasen zwischen dir und {featuredProfile.firstName} geblieben ist.
          </Text>
          <View style={styles.overviewStatusPills}>
            <View style={styles.overviewPill}>
              <Text style={styles.overviewPillText}>Chat wieder offen</Text>
            </View>
          </View>
          <View style={styles.matchReleaseNoticeActions}>
            <Pressable
              onPress={openChatFromOverview}
              style={({ pressed }) => [
                styles.homePhaseFiveAwardAction,
                pressed && styles.homePhaseFiveAwardActionPressed,
              ]}
            >
              <Text style={styles.homePhaseFiveAwardActionText}>Zum Award</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    let eyebrow = "Aktuelle Phase";
    let title = "";
    let text = "";
    const pills: string[] = [];
    let actionLabel: string | null = null;
    let onActionPress: (() => void) | null = null;

    if (phaseFiveRestartSelected) {
      eyebrow = "Phase 5";
      title = phaseFiveViewerSelectedNewMatch
        ? "Für morgen ist wieder ein neues Match vorgemerkt."
        : `${featuredProfile.firstName} möchte morgen ein neues Match.`;
      text = phaseFiveViewerSelectedNewMatch
        ? "Du gibst dieses Match damit auf. Choice sucht dir für morgen wieder ein neues Match."
        : "Mindestens eine Person gibt dieses Match hier auf. Deshalb endet es jetzt.";
      pills.push("Neues Match morgen");
    } else if (phaseThreeWindowFinished) {
      eyebrow = "Phase 5";
      title = phaseThreeAnyLeave
        ? "Dieses Match endet nach Phase 4."
        : "Die letzte Entscheidung ist abgelaufen.";
      text = phaseThreeAnyLeave
        ? `Mindestens eine Person wollte lieber mit ${phaseThreeSuggestedWithMatchLabel} neu starten. Deshalb öffnet sich der Award für dieses Match nicht.`
        : `Bis ${phaseFiveClockLabel} gab es keine gemeinsame Zusage mehr für dieses Match. Deshalb wird der Award hier nicht freigeschaltet.`;
      pills.push(phaseThreeAnyLeave ? "Neustart gewählt" : "Nicht freigeschaltet");
    } else if (phaseFourWindowLocked) {
      eyebrow = "Phase 4";
      title = "Die bewusste Chat-Pause läuft gerade.";
      text = `Euer Chat bleibt bis ${phaseFiveClockLabel} geschlossen. Danach zeigt sich, ob zwischen dir und ${featuredProfile.firstName} noch wirklich etwas trägt.`;
      pills.push(`Noch ${formatDurationLabel(Math.max(0, phaseFiveStartTime.getTime() - currentTime.getTime()))}`);
      pills.push(`bis ${phaseFiveClockLabel}`);
    } else if (phaseThreeDecisionPending) {
      eyebrow = "Phase 3";
      title = "Phase 3 läuft gerade.";
      text = `Choice zeigt euch ${phaseThreeSuggestedNewMatchLabel} für morgen als Alternative. Aktuell bleibt euer Match bestehen. Wenn jemand lieber wechseln will, geht das noch bis ${phaseFourClockLabel}.`;
      pills.push(`Noch ${formatDurationLabel(Math.max(0, phaseFourStartTime.getTime() - currentTime.getTime()))}`);
      pills.push(`bis ${phaseFourClockLabel}`);
    } else if (phaseThreeStartsLater) {
      eyebrow = "Phase 2";
      title = "Phase 2 ist ausgewertet.";
      text = `Ihr seid über 50 %. Phase 3 startet ${phaseThreeStartLabel}.`;
      pills.push(`Noch ${phaseThreeStartsInLabel}`);
      pills.push(`Start ${phaseThreeStartLabel}`);
    } else if (phaseTwoReady) {
      eyebrow = "Phase 2";
      title = phaseThreeQualified
        ? "Phase 3 startet als Nächstes."
        : "Dieses Match bleibt in Phase 2 stehen.";
      text = phaseThreeQualified
        ? `Die Choice-Runde ist abgeschlossen. Bis ${phaseThreeStartLabel} bleibt euer normales Chatfenster noch offen.`
        : "Choice hat eure Runde ausgewertet. Für Phase 3 reicht es dieses Mal nicht, deshalb bleibt es bei diesem Stand.";
      if (phaseThreeQualified) {
        pills.push(`Noch ${phaseThreeStartsInLabel}`);
        pills.push(`Start ${phaseThreeStartLabel}`);
      }
    } else if (phaseOneClosed && !phaseOneChatStarted) {
      eyebrow = "Phase 1";
      title = "Die erste Nachricht ist ausgeblieben.";
      text = "Dadurch endet dieses Match jetzt. Die Start-Person bekommt dafür einen Strafpunkt, danach startet wieder ein neues Match.";
      pills.push("Strafpunkt vergeben");
      pills.push("Neues Match danach");
    } else if (phaseTwoHasStarted || (phaseOneCanAdvanceToPhaseTwo && phaseTwoAvailableByTime)) {
      eyebrow = "Phase 2";
      title = phaseTwoViewerCanAnswer
        ? "Phase 2 ist jetzt offen."
        : `${phaseTwoCurrentResponderName} ist gerade mit der Runde dran.`;
      text = phaseTwoViewerCanAnswer
        ? "Dein Teil der Choice-Runde wartet auf dich. Erst wenn die Antworten drin sind, geht es in die nächste Phase."
        : `Bevor es weitergeht, muss zuerst ${phaseTwoCurrentResponderName} die laufende Runde abschließen.`;
      pills.push(`Noch ${formatDurationLabel(Math.max(0, phaseThreeStartTime.getTime() - currentTime.getTime()))}`);
      pills.push(`bis ${phaseThreeClockLabel}`);
    } else if (phaseOneCanAdvanceToPhaseTwo) {
      eyebrow = "Phase 1";
      title = "Dieses Match läuft weiter.";
      text = `Solange niemand Neues Match wählt, endet Phase 1 heute um ${decisionClockLabel}. Danach startet eure Choice-Runde ${phaseTwoStartLabel}.`;
      pills.push(`Noch ${phaseTwoStartsInLabel}`);
      pills.push(`Start ${phaseTwoStartLabel}`);
    } else {
      eyebrow = "Phase 1";
      title = "Phase 1 läuft gerade.";
      text = `Bis ${decisionClockLabel} könnt ihr dieses Match noch bewusst loslassen. Solange niemand Neues Match wählt, geht es danach automatisch in die Choice-Runde weiter. In dieser ersten Phase geht es bewusst noch nicht um alles, sondern nur darum, ob ihr diesem Kontakt heute weiter Raum geben möchtet.`;
      pills.push(remainingDecisionMs > 0 ? decisionCountdownLabel : "Phase 1 vorbei");
      pills.push(`bis ${decisionClockLabel}`);
    }

    return (
      <View style={styles.matchReleaseNoticeCard}>
        <Text style={styles.matchReleaseNoticeEyebrow}>{eyebrow}</Text>
        <Text style={styles.matchReleaseNoticeTitle}>{title}</Text>
        <Text style={styles.matchReleaseNoticeText}>{text}</Text>
        {pills.length ? (
          <View style={styles.overviewStatusPills}>
            {pills.map((pill) => (
              <View key={pill} style={styles.overviewPill}>
                <Text style={styles.overviewPillText}>{pill}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {actionLabel && onActionPress ? (
          <View style={styles.matchReleaseNoticeActions}>
            <Pressable
              onPress={onActionPress}
              style={styles.matchReleaseNoticeGhostButton}
            >
              <Text style={styles.matchReleaseNoticeGhostText}>
                {actionLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  function renderHomePhaseFiveRestartCard() {
    if (!hasActiveChat || !phaseFiveUnlocked || phaseFiveRestartSelected) {
      return null;
    }

    return (
      <View style={styles.matchReleaseNoticeCard}>
        <Text style={styles.matchReleaseNoticeEyebrow}>Für morgen</Text>
        <Text style={styles.matchReleaseNoticeTitle}>Wenn du dieses Match aufgeben möchtest</Text>
        <Text style={styles.matchReleaseNoticeText}>
          Dann endet dieses Match hier. Choice sucht dir stattdessen für morgen wieder ein neues Match.
        </Text>
        <View style={styles.matchReleaseNoticeActions}>
          <Pressable
            onPress={() => setViewerPhaseThreeDecision("new-match")}
            style={({ pressed }) => [
              styles.homePhaseFiveRestartAction,
              pressed && styles.homePhaseFiveRestartActionPressed,
            ]}
          >
            <Text style={styles.homePhaseFiveRestartActionText}>Für morgen neues Match</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderOverviewContent() {
    if (currentTab === "today") {
      const homeCurrentPhaseCard = renderHomeCurrentPhaseCard();
      const homePhaseFiveRestartCard = renderHomePhaseFiveRestartCard();

      return (
        <>
          {renderFreshMatchNotice()}
          {!hasActiveChat || phaseOneBeforeRelease ? (
            <View style={styles.matchReleaseNoticeCard}>
              <Text style={styles.matchReleaseNoticeEyebrow}>Nächstes Match</Text>
              <Text style={styles.matchReleaseNoticeTitle}>Noch {nextScheduledMatchCountdownLabel} bis zu deinem nächsten Match.</Text>
              <Text style={styles.matchReleaseNoticeText}>
                Choice gibt neue Matches gesammelt um {nextScheduledMatchReleaseClockLabel} frei. Deine nächste Freigabe ist {nextScheduledMatchReleaseLabel}. Bis dahin zeigt dir Home nur das, was gerade wirklich wichtig ist.
              </Text>
              <View style={styles.overviewStatusPills}>
                <View style={styles.overviewPill}>
                  <Text style={styles.overviewPillText}>Freigabe {nextScheduledMatchReleaseLabel}</Text>
                </View>
                <View style={styles.overviewPill}>
                  <Text style={styles.overviewPillText}>Phase 1 bis {nextScheduledMatchDecisionClockLabel}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {homeCurrentPhaseCard ?? (
            <View style={styles.overviewStatusCard}>
              <Text style={styles.overviewStatusEyebrow}>Home</Text>
              <Text style={styles.overviewStatusTitle}>Choice sucht bewusst nach echter Passung.</Text>
              <Text style={styles.overviewStatusText}>
                Choice übernimmt die guten Züge von jemandem, der dich ehrlich und aufmerksam verkuppeln würde: selektiv, klar und mit echtem Blick darauf, wer wirklich zu dir passen könnte. Statt dir ständig neue Reize zu geben, versucht Choice lieber, den einen Kontakt sichtbar zu machen, bei dem es sich heute wirklich lohnt genauer hinzusehen.
              </Text>
              <View style={styles.overviewStatusPills}>
                <View style={styles.overviewPill}>
                  <Text style={styles.overviewPillText}>aufmerksam</Text>
                </View>
                <View style={styles.overviewPill}>
                  <Text style={styles.overviewPillText}>selektiv</Text>
                </View>
                <View style={styles.overviewPill}>
                  <Text style={styles.overviewPillText}>klar</Text>
                </View>
              </View>
            </View>
          )}
          {homePhaseFiveRestartCard}

          <View style={styles.overviewRuleCard}>
            <Text style={styles.overviewRuleTitle}>Wofür Choice da ist</Text>
            <Text style={styles.overviewRuleText}>
              Choice versucht nicht, dir möglichst viele Optionen zu zeigen. Es versucht die eine Person herauszufinden, bei der es heute wirklich passen könnte und bei der es sich lohnt, genauer hinzusehen.
            </Text>
          </View>

          <View style={styles.overviewListCard}>
            <Text style={styles.overviewListTitle}>Die 5 Phasen</Text>
            {homePhases.map((phase) => (
              <View key={phase.phase} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineBadge,
                    phase.status.state === "active" && styles.timelineBadgeActive,
                    phase.status.state === "done" && styles.timelineBadgeMuted,
                  ]}
                >
                  <Text style={styles.timelineBadgeIcon}>{phase.icon}</Text>
                </View>
                <View style={styles.timelineCopy}>
                  <Text
                    style={[
                      styles.timelineStepLabel,
                      phase.status.state === "active" && styles.timelineStepLabelActive,
                      phase.status.state === "done" && styles.timelineStepLabelMuted,
                    ]}
                  >
                    {phase.phase}
                  </Text>
                  <Text style={styles.timelineTitle}>{phase.title}</Text>
                  <View
                    style={[
                      styles.timelineStatusPill,
                      phase.status.state === "active" && styles.timelineStatusPillActive,
                      phase.status.state === "done" && styles.timelineStatusPillDone,
                    ]}
                  >
                    <Text style={styles.timelineStatusText}>{phase.status.label}</Text>
                  </View>
                  <Text style={styles.timelineText}>{phase.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      );
    }

    if (currentTab === "match") {
      if (!hasActiveChat) {
        return (
          <>
            <View style={styles.overviewStatusCard}>
              <Text style={styles.overviewStatusEyebrow}>Noch kein Match</Text>
              <Text style={styles.overviewStatusTitle}>Choice hat gerade noch niemanden für dich freigegeben.</Text>
              <Text style={styles.overviewStatusText}>
                Gerade am Anfang kann es sein, dass noch nicht genug passende Nutzer da sind. Mit der Zeit kommen mehr dazu, also hab bitte etwas Geduld.
              </Text>
            </View>

            <View style={styles.overviewRuleCard}>
              <Text style={styles.overviewRuleTitle}>Sobald jemand passt</Text>
              <Text style={styles.overviewRuleText}>
                Sobald Choice ein passendes Match für dich hat, erscheint die Person hier und euer erster gemeinsamer Tag startet wie gewohnt um {releaseClockLabel}.
              </Text>
            </View>
          </>
        );
      }

      if (hasActiveChat && phaseOneBeforeRelease) {
        return (
          <>
            <View style={styles.overviewStatusCard}>
              <Text style={styles.overviewStatusEyebrow}>Dein erstes Match</Text>
              <Text style={styles.overviewStatusTitle}>Choice zeigt dir dein Match erst {nextMatchReleaseLabel}.</Text>
              <Text style={styles.overviewStatusText}>
                Du hast dein Profil gerade fertig gemacht. Die Matches werden für diesen Test gesammelt um {releaseClockLabel} freigegeben, damit alle mit demselben Start in Phase 1 gehen.
              </Text>
              <View style={styles.overviewStatusPills}>
                <View style={styles.overviewPill}>
                  <Text style={styles.overviewPillText}>Freigabe {nextMatchReleaseLabel}</Text>
                </View>
                <View style={styles.overviewPill}>
                  <Text style={styles.overviewPillText}>Phase 1 bis {decisionClockLabel}</Text>
                </View>
              </View>
            </View>

            <View style={styles.overviewRuleCard}>
              <Text style={styles.overviewRuleTitle}>Was dann passiert</Text>
              <Text style={styles.overviewRuleText}>
                Um {releaseClockLabel} bekommst du dein erstes Match, Choice legt fest, wer die erste Nachricht schreibt, und ab dann läuft euer erster Tag bis {decisionClockLabel}.
              </Text>
            </View>
          </>
        );
      }

      return (
        <>
          {renderFreshMatchNotice()}
          {renderPhotoSection("Bilder", featuredProfile.photoUris, "Sobald Choice ein Match zeigt, erscheinen hier die Bilder.")}
          {featuredProfile.introVideoUrl
            ? renderVideoSection("Video", featuredProfile.introVideoUrl, "Noch kein Video hinterlegt.")
            : null}
          {renderFactsSection(
            "Dein Match",
            `${featuredProfile.firstName}, ${featuredProfile.age}`,
            featuredProfileMeta,
            featuredProfileFacts,
            featuredProfile.tagline,
          )}
          {renderPillSection(`Interessen von ${featuredProfile.firstName}`, featuredProfile.interests)}
          {renderPillSection(`Was ${featuredProfile.firstName} bei jemandem mag`, featuredProfile.greenFlags)}
          {renderPillSection(`${featuredProfile.firstName}s No-Gos`, featuredProfile.dealbreakers)}
          <View style={styles.overviewRuleCard}>
            <Text style={styles.overviewRuleTitle}>Dieses Match öffnet genau einen echten Chat</Text>
            <Text style={styles.overviewRuleText}>
              Kein zweiter Thread, kein Ablenken. Wenn du öffnest, gehört dieser Chat nur zu diesem einen Match und endet auch mit ihm.
            </Text>
          </View>
          <View style={styles.overviewDecisionRow}>
            {activePartnerUserId ? (
              <Pressable
                onPress={() =>
                  void onSwitchToMatchedAccount({
                    userId: activePartnerUserId,
                    phoneNumber: remoteJourney?.partner?.phoneNumber ?? null,
                    firstName: featuredProfile.firstName,
                  })
                }
                style={styles.decisionGhostButton}
              >
                <Text style={styles.decisionGhostText}>Zu {featuredProfile.firstName} wechseln</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={openChatFromOverview} style={styles.decisionSolidButton}>
              <Text style={styles.decisionSolidText}>Chat öffnen</Text>
            </Pressable>
          </View>

        </>
      );
    }

    if (currentTab === "chats") {
      const phaseTwoEntryCard = renderPhaseTwoEntryCard();
      const phaseThreeEntryCard = renderPhaseThreeEntryCard();
      const phaseFourEntryCard = renderPhaseFourEntryCard();
      const phaseFiveAwardCard = renderPhaseFiveAwardCard();
      const phaseStatusCardVisible = Boolean(
        phaseTwoEntryCard || phaseThreeEntryCard || phaseFourEntryCard || phaseFiveAwardCard,
      );

      return (
        <>
          <Pressable onPress={() => setChatOpen(true)} style={styles.chatListCard}>
            <View style={styles.chatListAvatarWrap}>
              {hasActiveChat && !phaseOneBeforeRelease ? (
                <Image source={{ uri: featuredProfile.imageUri }} style={styles.chatListAvatarImage} />
              ) : (
                <View style={styles.chatListAvatarFallback}>
                  <Text style={styles.chatListAvatarFallbackText}>C</Text>
                </View>
              )}
              {unreadPartnerMessageCount > 0 ? (
                <View style={styles.chatListUnreadBadge}>
                  <Text style={styles.chatListUnreadBadgeText}>
                    {unreadPartnerMessageCount > 9 ? "9+" : unreadPartnerMessageCount}
                  </Text>
                </View>
              ) : null}
            </View>

              <View style={styles.chatListBody}>
                <View style={styles.chatListTopRow}>
                  <Text style={styles.chatListName}>{chatTitle}</Text>
                  {hasActiveChat ? (
                    <View style={[styles.chatListDeadlinePill, chatListDeadlinePillEnded && styles.chatListDeadlinePillEnded]}>
                      <Text style={[styles.chatListDeadlineText, chatListDeadlinePillEnded && styles.chatListDeadlineTextEnded]}>
                        {chatListDeadlinePillText}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.chatListTime}>morgen</Text>
                  )}
                </View>
                <Text style={styles.chatListPreview}>{chatPreviewText}</Text>
                {!phaseStatusCardVisible ? <Text style={styles.chatListHint}>{chatHintText}</Text> : null}
              </View>
          </Pressable>

          {renderFreshMatchNotice()}
          {activePartnerUserId ? (
            <Pressable
              onPress={() =>
                void onSwitchToMatchedAccount({
                  userId: activePartnerUserId,
                  phoneNumber: remoteJourney?.partner?.phoneNumber ?? null,
                  firstName: featuredProfile.firstName,
                })
              }
              style={styles.accountSwitchMatchCard}
            >
              <View style={styles.accountSwitchMatchCardAvatar}>
                <Text style={styles.accountSwitchMatchCardAvatarText}>
                  {featuredProfile.firstName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.accountSwitchMatchCardCopy}>
                <Text style={styles.accountSwitchMatchCardEyebrow}>Gegenaccount</Text>
                <Text style={styles.accountSwitchMatchCardTitle}>Direkt zu {featuredProfile.firstName} wechseln</Text>
                <Text style={styles.accountSwitchMatchCardText}>
                  Praktisch für den Test: öffnet sofort den anderen Account zu diesem Match.
                </Text>
              </View>
              <Text style={styles.accountSwitchMatchCardArrow}>›</Text>
            </Pressable>
          ) : null}
          {renderChatDecisionCard()}
          {phaseThreeEntryCard}
          {phaseTwoEntryCard}
          {phaseFourEntryCard}
          {phaseFiveAwardCard}
          {reportFeedback ? (
            <View style={styles.reportFeedbackCard}>
              <Text style={styles.reportFeedbackText}>{reportFeedback}</Text>
            </View>
          ) : null}

          {renderChoiceMatchReasonCard()}
        </>
      );
    }

    if (currentTab === "activity") {
      return (
        <>
          <View style={styles.unlockCard}>
            <View style={styles.unlockHeaderRow}>
              <View style={styles.unlockTitleWrap}>
                <Text style={styles.unlockEyebrow}>Freischaltung</Text>
                <Text style={styles.unlockTitle}>8 Matches inklusive</Text>
              </View>
              <View style={styles.unlockBadge}>
                <Text style={styles.unlockBadgeText}>
                  {hasPaidMatchAccess ? `+${paidMatchCredits} übrig` : `${consumedIncludedMatchCount} genutzt`}
                </Text>
              </View>
            </View>

            <Text style={styles.unlockText}>
              Nach deinen ersten 8 Matches kannst du dir einmalig 8 weitere Matches für 3,99 € freischalten. Kein Abo, keine automatische Verlängerung.
            </Text>

            <View style={styles.unlockProgressRow}>
              <ProgressRing
                current={consumedIncludedMatchCount}
                total={includedMatchLimit}
                activeColor="#ffb65f"
                label="genutzt"
                displayValue={`${consumedIncludedMatchCount}`}
                unlocked={hasPaidMatchAccess}
              />
              <View style={styles.unlockProgressCopy}>
                <Text style={styles.unlockProgressTitle}>
                  {hasPaidMatchAccess
                    ? `${paidMatchCredits} gekaufte Matches übrig`
                    : `${remainingIncludedMatches} von ${includedMatchLimit} übrig`}
                </Text>
                <Text style={styles.unlockFootnote}>
                  {accountBanned
                    ? forfeitedPaidMatchCredits > 0
                      ? `${forfeitedPaidMatchCredits} gekaufte Matches sind mit der Sperrung verfallen.`
                      : "Dauerhafte Sperren können auch zahlende Konten betreffen."
                    : accountPaused && frozenPaidMatchCredits > 0
                      ? `${frozenPaidMatchCredits} gekaufte Matches sind aktuell eingefroren.`
                      : hasPaidMatchAccess
                        ? "Wenn dein Konto pausiert wird, friert Choice das restliche Paket ein."
                        : remainingIncludedMatches <= 0
                          ? `Die 8 inklusiven Matches für diese Telefonnummer sind genutzt. Bisher wurden insgesamt ${totalMatchCountLabel} freigeschaltet.`
                          : totalMatchCount > 0
                            ? `Mit dieser Telefonnummer wurden bisher ${totalMatchCountLabel} freigeschaltet. Danach kannst du dir für 3,99 € 8 weitere Matches kaufen.`
                            : "Nach den 8 inklusiven Matches kannst du dir für 3,99 € 8 weitere Matches kaufen."}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                void handleBuyMatchPack();
              }}
              disabled={!canBuyMatchPack || purchasePending}
              style={({ pressed }) => [
                styles.unlockPurchaseButton,
                (!canBuyMatchPack || purchasePending) && styles.unlockPurchaseButtonDisabled,
                pressed && canBuyMatchPack && !purchasePending && styles.unlockPurchaseButtonPressed,
              ]}
            >
              <View style={styles.unlockPurchaseButtonContent}>
                <View style={styles.unlockPurchaseButtonLabelRow}>
                  <Text style={styles.unlockPurchaseButtonTitle}>
                    {purchasePending ? "Wird vorbereitet ..." : "8 Matches kaufen"}
                  </Text>
                </View>
                <View style={styles.unlockPurchasePricePill}>
                  <Text style={styles.unlockPurchasePriceText}>{matchPackPriceLabel}</Text>
                </View>
              </View>
            </Pressable>

            <Text style={styles.unlockPurchaseHint}>
              {canBuyMatchPack
                ? "Die Abrechnung und eventuelle Rückerstattungen laufen über den jeweiligen Store. Das Paket bleibt an dein Choice-Konto gebunden und wird danach serverseitig gutgeschrieben."
                : "Sobald RevenueCat und die Store-Keys gesetzt sind, kannst du den Kauf hier direkt testen."}
            </Text>

            {purchaseMessage ? (
              <View style={styles.unlockPurchaseFeedbackCard}>
                <Text style={styles.unlockPurchaseFeedbackText}>{purchaseMessage}</Text>
              </View>
            ) : null}
          </View>

          {renderPenaltyCard()}

          <View style={styles.overviewListCard}>
            <Text style={styles.overviewListTitle}>Dein Status</Text>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineTitle}>Ein echter Chat gleichzeitig</Text>
                <Text style={styles.timelineText}>
                  Du bist immer nur mit einer Person parallel im Gespräch. Es gibt keinen zweiten offenen Thread daneben.
                </Text>
              </View>
            </View>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineTitle}>Kein Zugriff nach Match-Ende</Text>
                <Text style={styles.timelineText}>
                  Sobald ein Match vorbei ist und ein neues beginnt, ist die vorherige Person und der alte Chat weg.
                </Text>
              </View>
            </View>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineTitle}>Fair Play wird sichtbar</Text>
                <Text style={styles.timelineText}>
                  Bestätigte Meldungen werden als Strafpunkte im Konto hinterlegt.
                </Text>
              </View>
            </View>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineTitle}>Limit bei drei Punkten</Text>
                <Text style={styles.timelineText}>
                  Wer das Limit erreicht, dessen Konto wird pausiert.
                </Text>
              </View>
            </View>
          </View>
        </>
      );
    }

    return (
      <>
        {renderPhotoSection("Deine Bilder", photoUris, "Hier landen deine hochgeladenen Bilder, sobald du dein Profil fertig hast.", () => onEditProfileField("photos"))}
        {renderVideoSection("Dein Video", introVideoUri, "Wenn du ein Video hinzufügst, kannst du es hier direkt anschauen.", profileVideoLabel, () => onEditProfileField("photos"))}
        {renderFactsSection("Dein Profil", displayName, profileMetaParts.join(" • "), profileFacts)}
        {renderPillSection("Interessen", (profile.interests.length ? profile.interests : ["Kunst", "Flohmärkte", "Reisen"]).slice(0, 5), () => onEditProfileField("interests"))}
        {renderPillSection("Eher pro", profile.greenFlags, () => onEditProfileField("preferences"))}
        {renderPillSection("No-Gos", profile.dealbreakers, () => onEditProfileField("preferences"))}

        <View style={styles.overviewRuleCard}>
          <Text style={styles.overviewRuleTitle}>Kontostatus</Text>
          <Text style={styles.overviewRuleText}>
            Aktuell {penaltyPoints} von {maxPenaltyPoints} Strafpunkten. Wer respektvoll bleibt, bleibt problemlos im
            Konto aktiv. Wenn derselbe Verstoß {penaltyRecoveryWindowDays} Tage lang nicht noch einmal vorkommt,
            verschwindet der dazugehörige Punkt wieder.
          </Text>
        </View>

        <View style={styles.accountActionsCard}>
          <Text style={styles.overviewListTitle}>Konto</Text>
          <Text style={styles.accountActionsText}>Hier kannst du dein Profil pausieren oder dein Konto verlassen.</Text>

          <View style={styles.accountActionsList}>
            <Pressable onPress={() => setPendingAccountAction("pause")} style={[styles.accountActionButton, styles.accountActionButtonWarning]}>
              <View style={styles.accountActionCopy}>
                <Text style={styles.accountActionTitle}>Profil pausieren</Text>
                <Text style={styles.accountActionMeta}>Kurz raus und später wieder einsteigen.</Text>
              </View>
              <Text style={styles.accountActionArrow}>›</Text>
            </Pressable>

            <Pressable onPress={() => setPendingAccountAction("signout")} style={styles.accountActionButton}>
              <View style={styles.accountActionCopy}>
                <Text style={styles.accountActionTitle}>Abmelden</Text>
                <Text style={styles.accountActionMeta}>Nur auf diesem Gerät abmelden.</Text>
              </View>
              <Text style={styles.accountActionArrow}>›</Text>
            </Pressable>

            <Pressable onPress={() => setPendingAccountAction("delete")} style={[styles.accountActionButton, styles.accountActionButtonDanger]}>
              <View style={styles.accountActionCopy}>
                <Text style={[styles.accountActionTitle, styles.accountActionTitleDanger]}>Konto löschen</Text>
                <Text style={styles.accountActionMeta}>Profil, Matches und Chats dauerhaft entfernen.</Text>
              </View>
              <Text style={[styles.accountActionArrow, styles.accountActionArrowDanger]}>›</Text>
            </Pressable>
          </View>

          {accountActionMessage ? <Text style={styles.accountActionMessage}>{accountActionMessage}</Text> : null}
        </View>

      </>
    );
  }

  return (
    <View
      style={[
        styles.overviewShell,
        {
          paddingBottom: Math.max(insets.bottom > 0 ? insets.bottom - 6 : 8, 6),
        },
      ]}
      >
      <View style={styles.overviewHeaderStatic}>
        <Text style={styles.overviewHeaderEyebrow}>Choice</Text>
      </View>

      <ScrollView
        style={styles.overviewScroll}
        contentContainerStyle={styles.overviewScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        alwaysBounceVertical={false}
      >
        {renderOverviewContent()}
      </ScrollView>

      <View style={styles.overviewTabBar}>
        {overviewTabs.map((tab) => {
          const active = currentTab === tab.id;
          const showTabBadge = showFreshMatchNotice && (tab.id === "match" || tab.id === "chats");

          return (
            <Pressable key={tab.id} onPress={() => onSelectTab(tab.id)} style={styles.overviewTabButton}>
              <View style={[styles.overviewTabIndicator, active && styles.overviewTabIndicatorActive]} />
              {showTabBadge ? <View style={styles.overviewTabBadge} /> : null}
              <Text style={[styles.overviewTabText, active && styles.overviewTabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={Boolean(photoViewer)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPhotoViewer(null)}
      >
        <View style={styles.photoViewerOverlay}>
          <Pressable style={styles.photoViewerBackdrop} onPress={() => setPhotoViewer(null)} />
          <View style={styles.photoViewerChrome}>
            <Pressable style={styles.photoViewerCloseButton} onPress={() => setPhotoViewer(null)}>
              <Text style={styles.photoViewerCloseButtonText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.photoViewerFrame}>
            {photoViewer ? (
              <>
                <ScrollView
                  ref={photoViewerRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  directionalLockEnabled
                  bounces={false}
                  overScrollMode="never"
                  onMomentumScrollEnd={(event) => {
                    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / photoViewerPageWidth);
                    setPhotoViewerIndex(nextIndex);
                  }}
                >
                  {photoViewer.uris.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={[styles.photoViewerPage, { width: photoViewerPageWidth }]}>
                      <Image source={{ uri }} style={styles.photoViewerImage} resizeMode="contain" />
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.photoViewerFooter}>
                  <View style={styles.photoViewerDots}>
                    {photoViewer.uris.map((uri, index) => (
                      <View
                        key={`${uri}-dot-${index}`}
                        style={[styles.photoViewerDot, index === photoViewerIndex && styles.photoViewerDotActive]}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={Boolean(pendingAccountActionConfig)}
        animationType="fade"
        onRequestClose={() => setPendingAccountAction(null)}
      >
        <Pressable style={styles.accountModalOverlay} onPress={() => setPendingAccountAction(null)}>
          <Pressable style={styles.accountModalCard} onPress={() => {}}>
            <Text style={styles.accountModalEyebrow}>Konto</Text>
            <Text style={styles.accountModalTitle}>{pendingAccountActionConfig?.title}</Text>
            <Text style={styles.accountModalText}>{pendingAccountActionConfig?.text}</Text>

            <View style={styles.accountModalActions}>
              <Pressable onPress={() => setPendingAccountAction(null)} style={styles.accountModalCancelButton}>
                <Text style={styles.accountModalCancelButtonText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmPendingAccountAction()}
                disabled={accountActionPending}
                style={[
                  styles.accountModalConfirmButton,
                  pendingAccountActionConfig?.confirmTone === "warning" && styles.accountModalConfirmButtonWarning,
                  pendingAccountActionConfig?.confirmTone === "danger" && styles.accountModalConfirmButtonDanger,
                  accountActionPending && styles.accountModalConfirmButtonDisabled,
                ]}
              >
                <Text style={styles.accountModalConfirmButtonText}>
                  {accountActionPending ? "Einen Moment ..." : pendingAccountActionConfig?.confirmLabel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ChoiceOnboarding() {
  const firstProfileScreenIndex = screens.findIndex((screen) => screen.id === "firstName");
  const insets = useSafeAreaInsets();
  const [currentSurface, setCurrentSurface] = useState<AppSurface>("onboarding");
  const [overviewTab, setOverviewTab] = useState<OverviewTabId>("today");
  const [screenIndex, setScreenIndex] = useState(0);
  const [entryMode, setEntryMode] = useState<EntryMode>("signup");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingProfileScreenId, setEditingProfileScreenId] = useState<EditableProfileScreenId | null>(null);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [profile, setProfile] = useState<RegistrationProfile>(initialRegistrationProfile);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [introVideoUri, setIntroVideoUri] = useState<string | null>(null);
  const [introVideoDurationMs, setIntroVideoDurationMs] = useState<number | null>(null);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [verifiedAccessToken, setVerifiedAccessToken] = useState<string | null>(null);
  const [signedInReturningUser, setSignedInReturningUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ profileId: string; summary: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountActionPending, setAccountActionPending] = useState(false);
  const [accountActionMessage, setAccountActionMessage] = useState<string | null>(null);
  const [rememberedSessions, setRememberedSessions] = useState<PersistedSession[]>([]);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [rememberedSessionMatchStates, setRememberedSessionMatchStates] = useState<Record<string, RememberedSessionMatchState>>({});

  const currentScreen = screens[screenIndex];
  const editingProfileScreenIndex =
    editingProfileScreenId == null ? null : screens.findIndex((screen) => screen.id === editingProfileScreenId);
  const formScreensCount = screens.filter((screen) => screen.kind !== "intro" && screen.kind !== "done").length;
  const currentFormIndex = screens
    .slice(0, screenIndex + 1)
    .filter((screen) => screen.kind !== "intro" && screen.kind !== "done").length;
  const previewProfile = demoProfiles[screenIndex % demoProfiles.length];
  const overviewDisplayName = profile.firstName.trim() || "Alex";
  const phoneLocalValue = useMemo(() => getLocalPhonePart(phoneNumber), [phoneNumber]);
  const birthdayPickerDate = useMemo(() => getBirthdayPickerDate(profile), [profile]);
  const calculatedProfileAge = useMemo(() => calculateAgeFromProfile(profile), [profile]);
  const hasBirthdaySelection = Boolean(profile.birthDay && profile.birthMonth && profile.birthYear);
  const birthdayBounds = useMemo(() => createBirthdayBounds(), []);
  const citySuggestions = useMemo(() => {
    if (currentScreen.id !== "city") {
      return [] as GermanCityOption[];
    }

    const query = normalizeLookup(profile.city);

    if (query.length < 2) {
      return [] as GermanCityOption[];
    }

    const exactSelectedMatch = germanCities.some((entry) => normalizeLookup(formatCityFieldValue(entry)) === query);

    if (exactSelectedMatch) {
      return [] as GermanCityOption[];
    }

    const startsWithMatches: GermanCityOption[] = [];
    const containsMatches: GermanCityOption[] = [];

    for (const entry of germanCities) {
      if (entry.cityKey.startsWith(query)) {
        startsWithMatches.push(entry);
      } else if (entry.searchKey.includes(query)) {
        containsMatches.push(entry);
      }

      if (startsWithMatches.length + containsMatches.length >= 8) {
        break;
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 8);
  }, [currentScreen.id, profile.city]);
  const citySelectionResolved = useMemo(() => {
    if (currentScreen.id !== "city") {
      return false;
    }

    const query = normalizeLookup(profile.city);

    if (!query) {
      return false;
    }

    return germanCities.some((entry) => normalizeLookup(formatCityFieldValue(entry)) === query);
  }, [currentScreen.id, profile.city]);
  const compactPreview = useMemo(() => {
    if (verifiedPhone) {
      return verifiedPhone;
    }

    const parts = [profile.firstName, profile.city].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Choice";
  }, [profile.city, profile.firstName, verifiedPhone]);
  const selfDescriptionLabel = useMemo(
    () => (profile.selfDescription.trim() ? getOptionLabel(selfDescriptionOptions, profile.selfDescription.trim()) : ""),
    [profile.selfDescription],
  );
  const identityLabel = useMemo(
    () => (profile.identity.trim() ? getOptionLabel(identityOptions, profile.identity.trim()) : ""),
    [profile.identity],
  );
  const intentLabel = useMemo(
    () => (profile.datingIntent.trim() ? getOptionLabel(datingIntentOptions, profile.datingIntent.trim()) : ""),
    [profile.datingIntent],
  );
  const pronounLabel = useMemo(() => {
    if (!profile.pronouns.trim() || profile.pronouns === "keine-angabe") {
      return "";
    }

    return getOptionLabel(pronounOptions, profile.pronouns.trim());
  }, [profile.pronouns]);
  const completionPreviewProfile = useMemo<DemoProfile>(() => {
    const primaryPhoto = photoUris.find((entry) => entry?.trim()) ?? previewProfile.imageUri;
    const greenFlagTagline = profile.greenFlags.slice(0, 2).join(" • ");
    const interestTagline = profile.interests.slice(0, 2).join(" • ");

    return {
      ...previewProfile,
      id: success?.profileId ?? previewProfile.id,
      firstName: profile.firstName.trim() || previewProfile.firstName,
      age: calculatedProfileAge ?? previewProfile.age,
      city: profile.city.trim() || previewProfile.city,
      time: "Neu",
      tagline: greenFlagTagline || interestTagline || previewProfile.tagline,
      interests: profile.interests.length ? profile.interests : previewProfile.interests,
      imageUri: primaryPhoto,
    };
  }, [calculatedProfileAge, photoUris, previewProfile, profile.firstName, profile.city, profile.greenFlags, profile.interests, success]);
  const completionDetail = useMemo(() => {
    return [profile.lookingFor, intentLabel].filter(Boolean).join(" • ") || "Dein Profil";
  }, [intentLabel, profile.lookingFor]);
  const completionFacts = useMemo(
    () =>
      [
        { label: "So bist du eher", value: selfDescriptionLabel },
        { label: "Wohnort", value: profile.city.trim() },
        { label: "Identität", value: identityLabel },
        { label: "Suche", value: profile.lookingFor.trim() },
        { label: "Daraus darf werden", value: intentLabel },
        { label: "Wunschalter", value: profile.ageRangeMin && profile.ageRangeMax ? `${profile.ageRangeMin}–${profile.ageRangeMax}` : "" },
        { label: "Pronomen", value: pronounLabel },
      ].filter((entry) => entry.value),
    [identityLabel, intentLabel, profile.ageRangeMax, profile.ageRangeMin, profile.city, profile.lookingFor, pronounLabel, selfDescriptionLabel],
  );
  const alternateRememberedSessions = useMemo(() => {
    const filtered = rememberedSessions.filter((entry) => entry.userId !== verifiedUserId);

    return [...filtered].sort((sessionA, sessionB) => {
      const matchStateA = rememberedSessionMatchStates[sessionA.userId];
      const matchStateB = rememberedSessionMatchStates[sessionB.userId];
      const rankA = matchStateA?.hasMatch ? 1 : 0;
      const rankB = matchStateB?.hasMatch ? 1 : 0;

      if (rankA !== rankB) {
        return rankB - rankA;
      }

      const timeA = matchStateA?.sortTime ?? Number.MAX_SAFE_INTEGER;
      const timeB = matchStateB?.sortTime ?? Number.MAX_SAFE_INTEGER;

      if (timeA !== timeB) {
        return timeA - timeB;
      }

      return new Date(sessionB.savedAt).getTime() - new Date(sessionA.savedAt).getTime();
    });
  }, [rememberedSessionMatchStates, rememberedSessions, verifiedUserId]);

  const displayScreenTitle = useMemo(() => {
    if (currentScreen.kind === "phone" && entryMode === "signin") {
      return "Anmelden?";
    }

    if (currentScreen.kind === "otp" && entryMode === "signin") {
      return "Code eingeben";
    }

    if (currentScreen.kind === "done" && signedInReturningUser) {
      return "Willkommen zurück.";
    }

    return currentScreen.title;
  }, [currentScreen, entryMode, signedInReturningUser]);

  const displayScreenHint = useMemo(() => {
    if (currentScreen.kind === "phone" && entryMode === "signin") {
      return "Mit deiner Nummer";
    }

    if (currentScreen.kind === "otp" && entryMode === "signin") {
      return "Login-Code";
    }

    if (currentScreen.kind === "done" && signedInReturningUser) {
      return "Dein Konto wurde erkannt";
    }

    return "hint" in currentScreen ? currentScreen.hint : undefined;
  }, [currentScreen, entryMode, signedInReturningUser]);

  useEffect(() => {
    setApiAccessToken(verifiedAccessToken);
  }, [verifiedAccessToken]);

  function setSessionState(session: Omit<PersistedSession, "savedAt">, preferredTab: OverviewTabId = "today") {
    setProfile(session.profile);
    setPhotoUris(session.photoUris);
    setIntroVideoUri(session.introVideoUri);
    setIntroVideoDurationMs(session.introVideoDurationMs);
    setVerifiedUserId(session.userId);
    setVerifiedAccessToken(session.accessToken);
    setVerifiedPhone(session.phoneNumber);
    setCurrentSurface("overview");
    setOverviewTab(preferredTab);
    setSignedInReturningUser(true);
  }

  async function persistLocalSession(session: Omit<PersistedSession, "savedAt">) {
    const savedSession = await savePersistedSession(session);
    setRememberedSessions((current) => {
      const deduped = current.filter((entry) => entry.userId !== savedSession.userId);
      return [savedSession, ...deduped].slice(0, 6);
    });
    return savedSession;
  }

  async function loadIsAccountPaused(userId: string, accessTokenOverride?: string | null) {
    try {
      const remoteAccount = await fetchRemoteAccountState(userId, accessTokenOverride);
      return remoteAccount.accountPaused;
    } catch (error) {
      if (isAuthRequestError(error)) {
        throw error;
      }

      return false;
    }
  }

  async function ensureSessionAccessToken(
    session: Omit<PersistedSession, "savedAt"> | PersistedSession,
    options?: { forceRefresh?: boolean },
  ) {
    if (!options?.forceRefresh && session.accessToken) {
      return session;
    }

    if (!session.phoneNumber?.trim()) {
      throw new Error("SESSION_REAUTH_REQUIRED");
    }

    const result = await bootstrapDevSession(session.userId, session.phoneNumber);

    return {
      ...session,
      accessToken: result.accessToken.trim() || null,
      phoneNumber: result.target,
    };
  }

  async function restoreLiveSession(
    session: Omit<PersistedSession, "savedAt"> | PersistedSession,
    options?: { forceTokenRefresh?: boolean },
  ): Promise<
    | { ok: true; session: PersistedSession }
    | { ok: false; reason: "account-paused" | "profile-not-found" | "reauth-required" | "request-failed" }
  > {
    try {
      const authenticatedSession = await ensureSessionAccessToken(session, {
        forceRefresh: options?.forceTokenRefresh,
      });

      if (await loadIsAccountPaused(authenticatedSession.userId, authenticatedSession.accessToken)) {
        return {
          ok: false,
          reason: "account-paused",
        };
      }

      const restoredProfile = await fetchRemoteProfile(
        authenticatedSession.userId,
        authenticatedSession.accessToken,
      );
      const hydratedSession = await persistLocalSession({
        userId: authenticatedSession.userId,
        accessToken: authenticatedSession.accessToken,
        phoneNumber: authenticatedSession.phoneNumber,
        profile: restoredProfile.profile,
        photoUris: restoredProfile.photoUrls,
        introVideoUri: restoredProfile.videoUrl,
        introVideoDurationMs: null,
      });

      return {
        ok: true,
        session: hydratedSession,
      };
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";

      if (isAuthRequestError(requestError) && !options?.forceTokenRefresh) {
        return restoreLiveSession({
          ...session,
          accessToken: null,
        }, {
          forceTokenRefresh: true,
        });
      }

      if (message === "PROFILE_NOT_FOUND") {
        return {
          ok: false,
          reason: "profile-not-found",
        };
      }

      if (
        isAuthRequestError(requestError)
        || message === "DEV_AUTH_DISABLED"
        || message === "DEV_SESSION_NOT_FOUND"
        || message === "SESSION_REAUTH_REQUIRED"
      ) {
        return {
          ok: false,
          reason: "reauth-required",
        };
      }

      return {
        ok: false,
        reason: "request-failed",
      };
    }
  }

  function startSignInForSession(
    session: Pick<PersistedSession, "phoneNumber">,
    message = "Bitte melde dich mit diesem Konto kurz neu an.",
  ) {
    setShowAccountSwitcher(false);
    setEditingProfile(false);
    setEditingProfileScreenId(null);
    setSignedInReturningUser(false);
    setSuccess(null);
    setAccountActionMessage(null);
    setProfile(initialRegistrationProfile);
    setPhoneNumber(session.phoneNumber?.trim() || phonePrefix);
    setOtpCode("");
    setPhotoUris([]);
    setIntroVideoUri(null);
    setIntroVideoDurationMs(null);
    setShowBirthdayPicker(false);
    setVerifiedPhone(null);
    setVerifiedUserId(null);
    setVerifiedAccessToken(null);
    setEntryMode("signin");
    setScreenIndex(1);
    setCurrentSurface("onboarding");
    setOverviewTab("today");
    setError(message);
  }

  function resetToPausedSignIn(message = "Dieses Konto ist pausiert.") {
    setShowAccountSwitcher(false);
    setEditingProfile(false);
    setEditingProfileScreenId(null);
    setSignedInReturningUser(false);
    setSuccess(null);
    setAccountActionMessage(null);
    setProfile(initialRegistrationProfile);
    setPhoneNumber(phonePrefix);
    setOtpCode("");
    setPhotoUris([]);
    setIntroVideoUri(null);
    setIntroVideoDurationMs(null);
    setShowBirthdayPicker(false);
    setVerifiedPhone(null);
    setVerifiedUserId(null);
    setVerifiedAccessToken(null);
    setEntryMode("signin");
    setScreenIndex(1);
    setCurrentSurface("onboarding");
    setOverviewTab("today");
    setError(message);
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      try {
        const remembered = await loadRememberedSessions();

        if (!cancelled) {
          setRememberedSessions(remembered);
        }

        const persistedSession = await loadPersistedSession();

        if (!persistedSession) {
          if (!cancelled) {
            setIsSessionHydrated(true);
          }
          return;
        }

        const restoredSessionResult = await restoreLiveSession(persistedSession);

        if (restoredSessionResult.ok) {
          if (!cancelled) {
            setSessionState(restoredSessionResult.session);
          }
          return;
        }

        if (restoredSessionResult.reason === "account-paused") {
          await clearTransientState();
          await clearPersistedSession();
          await removeRememberedSession(persistedSession.userId);

          if (!cancelled) {
            setRememberedSessions((current) => current.filter((entry) => entry.userId !== persistedSession.userId));
            resetToPausedSignIn();
          }
          return;
        }

        if (restoredSessionResult.reason === "profile-not-found") {
          await clearTransientState();
          await clearPersistedSession();
          await removeRememberedSession(persistedSession.userId);

          if (cancelled) {
            return;
          }

          setRememberedSessions((current) => current.filter((entry) => entry.userId !== persistedSession.userId));
          setProfile(initialRegistrationProfile);
          setPhotoUris([]);
          setIntroVideoUri(null);
          setIntroVideoDurationMs(null);
          setVerifiedUserId(null);
          setVerifiedAccessToken(null);
          setVerifiedPhone(null);
          setCurrentSurface("onboarding");
          setOverviewTab("today");
          setScreenIndex(0);
          return;
        }

        if (restoredSessionResult.reason === "request-failed") {
          if (!cancelled) {
            setSessionState(persistedSession);
          }
          return;
        }

        await clearTransientState();
        await clearPersistedSession();

        if (cancelled) {
          return;
        }

        startSignInForSession(persistedSession);
      } finally {
        if (!cancelled) {
          setIsSessionHydrated(true);
        }
      }
    }

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sessionsToInspect = rememberedSessions.filter((entry) => entry.userId !== verifiedUserId);

    if (!showAccountSwitcher || !sessionsToInspect.length) {
      return;
    }

    let cancelled = false;

    async function loadRememberedSessionMatches() {
      const nextEntries = await Promise.all(
        sessionsToInspect.map(async (session) => {
          try {
            const journey = await fetchRemoteJourney(session.userId, session.accessToken);
            return [session.userId, summarizeRememberedSessionMatch(journey)] as const;
          } catch {
            return [session.userId, {
              hasMatch: false,
              badgeLabel: null,
              detailLabel: null,
              partnerName: null,
              sortTime: Number.MAX_SAFE_INTEGER,
            }] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setRememberedSessionMatchStates(Object.fromEntries(nextEntries));
    }

    void loadRememberedSessionMatches();

    return () => {
      cancelled = true;
    };
  }, [rememberedSessions, showAccountSwitcher, verifiedUserId]);

  useEffect(() => {
    if (!isSessionHydrated || currentSurface !== "overview" || !verifiedUserId || !profile.firstName.trim()) {
      return;
    }

    void persistLocalSession({
      userId: verifiedUserId,
      accessToken: verifiedAccessToken,
      phoneNumber: verifiedPhone,
      profile,
      photoUris,
      introVideoUri,
      introVideoDurationMs,
    });
  }, [currentSurface, introVideoDurationMs, introVideoUri, isSessionHydrated, photoUris, profile, verifiedAccessToken, verifiedPhone, verifiedUserId]);

  function updateProfile<Key extends keyof RegistrationProfile>(field: Key, value: RegistrationProfile[Key]) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function applyBirthdayDate(date: Date) {
    setProfile((current) => ({
      ...current,
      birthDay: padDatePart(date.getDate()),
      birthMonth: padDatePart(date.getMonth() + 1),
      birthYear: String(date.getFullYear()),
    }));
  }

  function handleBirthdayChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowBirthdayPicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    applyBirthdayDate(selectedDate);
    setError(null);
  }

  function toggleInterest(interest: string) {
    setProfile((current) => {
      const exists = current.interests.includes(interest);

      if (exists) {
        return {
          ...current,
          interests: current.interests.filter((entry) => entry !== interest),
        };
      }

      if (current.interests.length >= 5) {
        return current;
      }

      return {
        ...current,
        interests: [...current.interests, interest],
      };
    });
  }

  function togglePreference(field: "greenFlags" | "dealbreakers", value: string) {
    setProfile((current) => {
      const currentValues = current[field];
      const exists = currentValues.includes(value);

      if (exists) {
        return {
          ...current,
          [field]: currentValues.filter((entry) => entry !== value),
        };
      }

      if (currentValues.length >= 4) {
        return current;
      }

      return {
        ...current,
        [field]: [...currentValues, value],
      };
    });
  }

  async function pickPhoto(slotIndex: number) {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError("Bitte erlaube den Fotozugriff.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const nextUri = result.assets[0]?.uri;

      if (!nextUri) {
        return;
      }

      setError(null);
      setPhotoUris((current) => {
        const next = [...current];
        next[slotIndex] = nextUri;
        return next;
      });
    } catch {
      setError("Bild konnte nicht geladen werden.");
    }
  }

  async function pickVideo() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError("Bitte erlaube den Fotozugriff.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const nextVideo = result.assets[0];
      const nextUri = nextVideo?.uri;
      const nextDuration = typeof nextVideo?.duration === "number" ? nextVideo.duration : null;

      if (!nextUri) {
        return;
      }

      if (nextDuration && nextDuration > 30_000) {
        setError("Video max. 30 Sekunden.");
        return;
      }

      setError(null);
      setIntroVideoUri(nextUri);
      setIntroVideoDurationMs(nextDuration);
    } catch {
      setError("Video konnte nicht geladen werden.");
    }
  }

  function removePhoto(slotIndex: number) {
    setPhotoUris((current) => {
      const next = [...current];
      next.splice(slotIndex, 1);
      return next;
    });
  }

  function removeVideo() {
    setIntroVideoUri(null);
    setIntroVideoDurationMs(null);
  }

  function validateCurrentScreen() {
    switch (currentScreen.id) {
      case "intro":
        return null;
      case "done":
        return signedInReturningUser || profile.consent
          ? null
          : "Bitte stimme Impressum, Datenschutz, Rechtlichem und AGB zu.";
      case "phone":
        return phoneLocalValue.length >= 8 ? null : "Nummer fehlt.";
      case "otp":
        return otpCode.trim().length === 6 ? null : "6 Stellen.";
      case "firstName":
        return profile.firstName.trim() ? null : "Vorname fehlt.";
      case "birthday": {
        const age = calculateAgeFromProfile(profile);

        if (!profile.birthDay.trim() || !profile.birthMonth.trim() || !profile.birthYear.trim()) {
          return "Geburtstag fehlt.";
        }

        return age === null || age < 18 || age > 99 ? "18 bis 99." : null;
      }
      case "city":
        return profile.city.trim() ? null : "Stadt fehlt.";
      case "selfDescription":
        return profile.selfDescription.trim() ? null : "Bitte wählen.";
      case "pronouns":
        return profile.pronouns.trim() ? null : "Bitte wählen.";
      case "identity":
        return profile.identity.trim() ? null : "Bitte ausfüllen.";
      case "lookingFor":
        return profile.lookingFor ? null : "Bitte wählen.";
      case "datingIntent":
        return profile.datingIntent ? null : "Bitte wählen.";
      case "ageRange": {
        const ageRangeMin = Number(profile.ageRangeMin);
        const ageRangeMax = Number(profile.ageRangeMax);

        if (!profile.ageRangeMin.trim() || !profile.ageRangeMax.trim()) {
          return "Bitte beide Werte angeben.";
        }

        if (Number.isNaN(ageRangeMin) || Number.isNaN(ageRangeMax)) {
          return "Bitte nur Zahlen.";
        }

        if (ageRangeMin < 18 || ageRangeMax > 99) {
          return "18 bis 99.";
        }

        return ageRangeMin > ageRangeMax ? "Von darf nicht größer als bis sein." : null;
      }
      case "interests":
        return profile.interests.length >= 3 ? null : "Mind. 3.";
      case "preferences":
        return null;
      case "photos":
        return photoUris.filter(Boolean).length >= minimumPhotoCount ? null : "Mind. 2 Bilder.";
      default:
        return null;
    }
  }

  function goBack() {
    setError(null);
    setSuccess(null);
    setShowBirthdayPicker(false);

    if (editingProfile && screenIndex === (editingProfileScreenIndex ?? firstProfileScreenIndex)) {
      setEditingProfile(false);
      setEditingProfileScreenId(null);
      setCurrentSurface("overview");
      setOverviewTab("profile");
      return;
    }

    if (screenIndex === 0) {
      setCurrentSurface("overview");
      setOverviewTab("today");
      return;
    }

    setScreenIndex((current) => Math.max(current - 1, 0));
  }

  function startEntry(mode: EntryMode) {
    setEditingProfile(false);
    setEditingProfileScreenId(null);
    setEntryMode(mode);
    setSignedInReturningUser(false);
    setError(null);
    setSuccess(null);
    setAccountActionMessage(null);
    setProfile(initialRegistrationProfile);
    setPhoneNumber(phonePrefix);
    setOtpCode("");
    setPhotoUris([]);
    setIntroVideoUri(null);
    setIntroVideoDurationMs(null);
    setShowBirthdayPicker(false);
    setVerifiedPhone(null);
    setVerifiedUserId(null);
    setVerifiedAccessToken(null);
    setScreenIndex(1);
  }

  function startProfileEditing() {
    setEditingProfile(true);
    setEditingProfileScreenId(null);
    setSignedInReturningUser(false);
    setCurrentSurface("onboarding");
    setOverviewTab("profile");
    setError(null);
    setSuccess(null);
    setShowBirthdayPicker(false);
    setScreenIndex(Math.max(firstProfileScreenIndex, 0));
  }

  function startProfileFieldEditing(screenId: EditableProfileScreenId) {
    const targetIndex = screens.findIndex((screen) => screen.id === screenId);

    if (targetIndex === -1) {
      return;
    }

    setEditingProfile(true);
    setEditingProfileScreenId(screenId);
    setSignedInReturningUser(false);
    setCurrentSurface("onboarding");
    setOverviewTab("profile");
    setError(null);
    setSuccess(null);
    setShowBirthdayPicker(false);
    setScreenIndex(targetIndex);
  }

  function resetToIntroSurface() {
    setShowAccountSwitcher(false);
    setEditingProfile(false);
    setEditingProfileScreenId(null);
    setSignedInReturningUser(false);
    setError(null);
    setSuccess(null);
    setAccountActionMessage(null);
    setProfile(initialRegistrationProfile);
    setPhoneNumber(phonePrefix);
    setOtpCode("");
    setPhotoUris([]);
    setIntroVideoUri(null);
    setIntroVideoDurationMs(null);
    setShowBirthdayPicker(false);
    setVerifiedPhone(null);
    setVerifiedUserId(null);
    setVerifiedAccessToken(null);
    setScreenIndex(0);
    setCurrentSurface("onboarding");
    setOverviewTab("today");
  }

  async function switchToRememberedSession(
    session: Omit<PersistedSession, "savedAt"> | PersistedSession,
    options?: { preferredTab?: OverviewTabId },
  ) {
    setShowAccountSwitcher(false);
    setAccountActionMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const restoredSessionResult = await restoreLiveSession(session);

      if (restoredSessionResult.ok) {
        setSessionState(restoredSessionResult.session, options?.preferredTab ?? "today");
        return;
      }

      if (restoredSessionResult.reason === "account-paused") {
        await removeRememberedSession(session.userId);
        setRememberedSessions((current) => current.filter((entry) => entry.userId !== session.userId));
        setAccountActionMessage("Dieses Konto ist pausiert.");
        return;
      }

      if (restoredSessionResult.reason === "profile-not-found") {
        await removeRememberedSession(session.userId);
        setRememberedSessions((current) => current.filter((entry) => entry.userId !== session.userId));

        if (verifiedUserId === session.userId) {
          await clearPersistedSession();
          resetToIntroSurface();
          return;
        }

        setAccountActionMessage("Dieses Konto gibt es nicht mehr.");
        return;
      }

      if (restoredSessionResult.reason === "request-failed") {
        setAccountActionMessage("Dieses Konto konnte gerade nicht geladen werden.");
        return;
      }

      startSignInForSession(session);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function switchToMatchedAccount(partner: { userId: string; phoneNumber: string | null; firstName: string }) {
    const rememberedPartnerSession = rememberedSessions.find((entry) => entry.userId === partner.userId) ?? null;

    if (rememberedPartnerSession) {
      await switchToRememberedSession(rememberedPartnerSession, { preferredTab: "match" });
      return;
    }

    setShowAccountSwitcher(false);
    setAccountActionMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      if (!partner.phoneNumber) {
        setAccountActionMessage(
          `Zu ${partner.firstName} kannst du wechseln, sobald du dich einmal mit dieser Nummer angemeldet hast.`,
        );
        return;
      }

      const restoredPartnerSession = await restoreLiveSession({
        userId: partner.userId,
        accessToken: null,
        phoneNumber: partner.phoneNumber,
        profile: initialRegistrationProfile,
        photoUris: [],
        introVideoUri: null,
        introVideoDurationMs: null,
      });

      if (restoredPartnerSession.ok) {
        setSessionState(restoredPartnerSession.session, "match");
        return;
      }

      if (restoredPartnerSession.reason === "account-paused") {
        setAccountActionMessage("Dieses Konto ist pausiert.");
        return;
      }

      if (restoredPartnerSession.reason === "request-failed") {
        setAccountActionMessage(`Zu ${partner.firstName} konnte gerade nicht gewechselt werden.`);
        return;
      }

      setAccountActionMessage(
        restoredPartnerSession.reason === "profile-not-found"
          ? `Zu ${partner.firstName} konnte gerade nicht gewechselt werden.`
          : `Zu ${partner.firstName} kannst du wechseln, sobald du dich einmal mit dieser Nummer angemeldet hast.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function startAccountSwitchSignIn() {
    setShowAccountSwitcher(false);
    startEntry("signin");
  }

  async function handlePauseAccount() {
    setAccountActionPending(true);

    try {
      await logOutRevenueCat().catch(() => {
        // Ignore RevenueCat cleanup errors while pausing locally.
      });
      await clearPersistedSession();
      resetToIntroSurface();
    } finally {
      setAccountActionPending(false);
    }
  }

  async function handleSignOut() {
    setAccountActionPending(true);

    try {
      await logOutRevenueCat().catch(() => {
        // Ignore RevenueCat cleanup errors while signing out locally.
      });
      await clearPersistedSession();
      resetToIntroSurface();
    } finally {
      setAccountActionPending(false);
    }
  }

  async function handleDeleteAccount() {
    setAccountActionPending(true);
    setAccountActionMessage(null);

    try {
      if (verifiedUserId) {
        await deleteRemoteAccount(verifiedUserId);
        await removeRememberedSession(verifiedUserId);
        setRememberedSessions((current) => current.filter((entry) => entry.userId !== verifiedUserId));
      }

      await logOutRevenueCat().catch(() => {
        // Ignore RevenueCat cleanup errors while deleting the account.
      });
      await clearTransientState();
      await clearPersistedSession();
      resetToIntroSurface();
    } catch {
      setAccountActionMessage("Konto konnte gerade nicht gelöscht werden.");
    } finally {
      setAccountActionPending(false);
    }
  }

  async function handlePhoneStart() {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await startPhoneVerification(phoneNumber);
      Keyboard.dismiss();
      setPhoneNumber(result.target);
      setVerifiedUserId(result.userId);
      setScreenIndex((current) => Math.min(current + 1, screens.length - 1));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "SMS konnte nicht gesendet werden.";

      if (message === "CHALLENGE_COOLDOWN_ACTIVE") {
        setError("Bitte kurz warten, bevor du einen neuen Code anforderst.");
        return;
      }

      setError(message === "API_URL_MISSING" ? "API fehlt." : "SMS konnte nicht gesendet werden.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePhoneVerify() {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await verifyPhoneVerification(phoneNumber, otpCode);
      const nextAccessToken = typeof result.accessToken === "string" ? result.accessToken.trim() || null : null;
      Keyboard.dismiss();
      setVerifiedUserId(result.userId);
      setVerifiedAccessToken(nextAccessToken);
      setVerifiedPhone(phoneNumber.trim());

      if (result.profileCompleted) {
        if (await loadIsAccountPaused(result.userId, nextAccessToken)) {
          setVerifiedAccessToken(null);
          setError("Dieses Konto ist pausiert.");
          return;
        }

        const restoredProfile = await fetchRemoteProfile(result.userId, nextAccessToken);
        setSessionState({
          userId: result.userId,
          accessToken: nextAccessToken,
          phoneNumber: phoneNumber.trim(),
          profile: restoredProfile.profile,
          photoUris: restoredProfile.photoUrls,
          introVideoUri: restoredProfile.videoUrl,
          introVideoDurationMs: null,
        });
        await persistLocalSession({
          userId: result.userId,
          accessToken: nextAccessToken,
          phoneNumber: phoneNumber.trim(),
          profile: restoredProfile.profile,
          photoUris: restoredProfile.photoUrls,
          introVideoUri: restoredProfile.videoUrl,
          introVideoDurationMs: null,
        });
        return;
      }

      setScreenIndex((current) => Math.min(current + 1, screens.length - 1));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "VERIFY_FAILED";

      if (message === "INVALID_CODE" || message === "NOT_FOUND" || message === "REQUEST_FAILED") {
        setError("Code falsch.");
        return;
      }

      if (message === "TOO_MANY_ATTEMPTS") {
        setError("Zu viele falsche Versuche. Bitte fordere einen neuen Code an.");
        return;
      }

      if (message === "PROFILE_NOT_FOUND") {
        setError("Profil konnte nicht geladen werden.");
        return;
      }

      if (message === "AUTH_REQUIRED" || message === "AUTH_INVALID" || message === "AUTH_FORBIDDEN") {
        setError("Bitte fordere den Code noch einmal neu an.");
        return;
      }

      setError("Anmeldung gerade nicht möglich.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function persistProfileSnapshot() {
    if (!verifiedUserId) {
      throw new Error("MISSING_VERIFICATION");
    }

    const nextProfile = {
      ...profile,
    };
    const uploadedPhotoUrls = await uploadProfilePhotos(photoUris, verifiedAccessToken);
    const uploadedVideoUrl = await uploadProfileVideo(introVideoUri, verifiedAccessToken);
    const result = await createRemoteProfile(
      verifiedUserId,
      nextProfile,
      uploadedPhotoUrls,
      uploadedVideoUrl,
      verifiedAccessToken,
    );

    setProfile(nextProfile);
    setPhotoUris(uploadedPhotoUrls);
    setIntroVideoUri(uploadedVideoUrl);
    await persistLocalSession({
      userId: verifiedUserId,
      accessToken: verifiedAccessToken,
      phoneNumber: verifiedPhone,
      profile: nextProfile,
      photoUris: uploadedPhotoUrls,
      introVideoUri: uploadedVideoUrl,
      introVideoDurationMs,
    });
    setSuccess({
      profileId: result.profileId,
      summary: result.summary,
    });
  }

  function handleProfileSaveError(requestError: unknown) {
    const message = requestError instanceof Error ? requestError.message : "PROFILE_SAVE_FAILED";

    if (message === "MISSING_VERIFICATION") {
      setError("Verifizierung fehlt.");
    } else if (message === "UPLOADS_NOT_CONFIGURED") {
      setError("Cloudinary ist noch nicht eingerichtet.");
    } else if (message === "UPLOAD_FAILED") {
      setError("Bilder oder Video konnten nicht hochgeladen werden.");
    } else if (message === "INVALID_BIRTHDAY") {
      setError("Bitte gib einen gültigen Geburtstag an.");
    } else {
      setError("Profil konnte nicht gespeichert werden.");
    }
  }

  function exitProfileEditingToOverview() {
    setEditingProfile(false);
    setEditingProfileScreenId(null);
    setCurrentSurface("overview");
    setOverviewTab("profile");
    setShowBirthdayPicker(false);
  }

  async function completeProfile() {
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingProfile) {
        await persistProfileSnapshot();
        exitProfileEditingToOverview();
        return;
      }

      setShowBirthdayPicker(false);
      setScreenIndex((current) => Math.min(current + 1, screens.length - 1));
    } catch (requestError) {
      handleProfileSaveError(requestError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveProfileEditAndReturnToOverview() {
    setIsSubmitting(true);
    setError(null);

    try {
      await persistProfileSnapshot();
      exitProfileEditingToOverview();
    } catch (requestError) {
      handleProfileSaveError(requestError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmOnboardingAndFinish() {
    const validationError = validateCurrentScreen();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await persistProfileSnapshot();
      finishOnboardingToOverview();
    } catch (requestError) {
      handleProfileSaveError(requestError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openLegalDocument(url: string) {
    try {
      await openExternalUrl(url);
    } catch {
      setError("Rechtliche Seite konnte gerade nicht geöffnet werden.");
    }
  }

  async function goForward() {
    const validationError = validateCurrentScreen();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    if (currentScreen.kind === "phone") {
      await handlePhoneStart();
      return;
    }

    if (currentScreen.kind === "otp") {
      await handlePhoneVerify();
      return;
    }

    if (currentScreen.kind === "photos") {
      await completeProfile();
      return;
    }

    if (currentScreen.kind !== "done") {
      if (editingProfile && editingProfileScreenId && currentScreen.id === editingProfileScreenId) {
        await saveProfileEditAndReturnToOverview();
        return;
      }

      setShowBirthdayPicker(false);
      setScreenIndex((current) => Math.min(current + 1, screens.length - 1));
    }
  }

  function finishOnboardingToOverview() {
    setShowBirthdayPicker(false);
    setCurrentSurface("overview");
    setOverviewTab("today");
  }

  function renderStagePreview() {
    if (currentScreen.kind === "phone") {
      return (
        <View style={styles.authStageCard}>
          <Text style={styles.authStageEyebrow}>Konto</Text>
          <Text style={styles.authStageTitle}>Nur deine Nummer. Kein Bild, kein Umweg.</Text>
          <Text style={styles.authStageText}>Wir starten hier bewusst schlicht, damit du bei der Erstellung deines Kontos schnell durchkommst.</Text>
        </View>
      );
    }

    if (currentScreen.kind === "otp") {
      return (
        <View style={styles.authStageCard}>
          <Text style={styles.authStageEyebrow}>Code</Text>
          <Text style={styles.authStageTitle}>Ein kurzer Check, dann geht es weiter.</Text>
          <Text style={styles.authStageText}>Den Login-Code schicken wir an deine Nummer und halten den Schritt bewusst kompakt.</Text>
        </View>
      );
    }

    if (currentScreen.kind === "done") {
      return null;
    }

    return null;
  }

  function renderField() {
    if (currentScreen.kind === "intro") {
      return (
        <View style={styles.introCard}>
          <HeroArtwork />
          <View style={styles.introCopyWrap}>
            <Text style={styles.introTitle}>{currentScreen.title}</Text>
            <Text style={styles.introSubtitle}>{currentScreen.subtitle}</Text>
            <View style={styles.introHighlightRow}>
              {introHighlights.map((item) => (
                <View key={item} style={styles.introHighlightPill}>
                  <Text style={styles.introHighlightText}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.introFootnote}>Neu hier oder schon mal da gewesen: beides geht in wenigen Sekunden.</Text>
          </View>
        </View>
      );
    }

    if (currentScreen.kind === "done") {
      if (signedInReturningUser) {
        return (
          <View style={styles.doneCard}>
            <MatchPreviewCard profile={previewProfile} eyebrow="Willkommen zurück" detail="Dein Konto ist aktiv" />
            <Text style={styles.doneTitle}>Du bist wieder drin.</Text>
            <Text style={styles.doneText}>{success?.summary ?? "Dein Konto wurde erkannt und ist bereit für dein nächstes Match."}</Text>
            <Text style={styles.doneText}>Wenn du weitermachst, landest du direkt wieder in deinem Choice-Flow.</Text>
          </View>
        );
      }

      return (
        <View style={styles.doneCard}>
          <Text style={styles.doneTitle}>Du bist startklar.</Text>
          <Text style={styles.doneText}>Schau dein Profil einmal komplett durch. Wenn alles passt, geht es direkt weiter in deine Hauptseite.</Text>

          <View style={styles.overviewListCard}>
            <Text style={styles.overviewListTitle}>Deine Bilder</Text>
            {photoUris.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profilePhotoRow}>
                {photoUris.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.profilePhotoButton}>
                    <Image
                      source={{ uri }}
                      style={[
                        styles.profilePhoto,
                        index === 0 ? styles.profilePhotoPrimary : styles.profilePhotoSecondary,
                      ]}
                    />
                  </View>
                ))}
              </ScrollView>
            ) : (
            <Text style={styles.overviewListMeta}>Hier erscheinen alle Bilder, die du ausgewählt hast, bis zu 8.</Text>
            )}
          </View>

          <View style={styles.overviewListCard}>
            <Text style={styles.overviewListTitle}>Dein Video</Text>
            {introVideoUri ? (
              <View style={styles.overviewVideoSection}>
                <InlineVideoPreview uri={introVideoUri} />
                <Text style={styles.overviewListMeta}>
                  {introVideoDurationMs ? `${formatVideoDurationLabel(introVideoDurationMs)} hinterlegt` : "Video hinterlegt"}
                </Text>
              </View>
            ) : (
              <Text style={styles.overviewListMeta}>Du hast aktuell kein Video hinzugefügt.</Text>
            )}
          </View>

          <View style={styles.overviewListCard}>
            <Text style={styles.overviewListTitle}>Deine Angaben</Text>
            <View style={styles.doneFactsWrap}>
              {completionFacts.map((entry) => (
                <View key={entry.label} style={styles.doneFactRow}>
                  <Text style={styles.doneFactLabel}>{entry.label}</Text>
                  <Text style={styles.doneFactValue}>{entry.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.overviewListCard}>
            <Text style={styles.overviewListTitle}>Interessen</Text>
            <View style={styles.overviewStatusPills}>
              {completionPreviewProfile.interests.slice(0, 5).map((interest) => (
                <View key={interest} style={styles.overviewPill}>
                  <Text style={styles.overviewPillText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>

          {profile.greenFlags.length || profile.dealbreakers.length ? (
            <View style={styles.overviewListCard}>
              {profile.greenFlags.length ? (
                <View style={styles.donePreferenceGroup}>
                  <Text style={styles.donePreferenceTitle}>Eher pro</Text>
                  <View style={styles.overviewStatusPills}>
                    {profile.greenFlags.slice(0, 4).map((item) => (
                      <View key={`green-${item}`} style={styles.overviewPill}>
                        <Text style={styles.overviewPillText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {profile.dealbreakers.length ? (
                <View style={styles.donePreferenceGroup}>
                  <Text style={styles.donePreferenceTitle}>No-Gos</Text>
                  <View style={styles.overviewStatusPills}>
                    {profile.dealbreakers.slice(0, 4).map((item) => (
                      <View key={`dealbreaker-${item}`} style={styles.overviewPill}>
                        <Text style={styles.overviewPillText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.doneStatusCard}>
            <Text style={styles.doneStatusText}>Dein Profil ist fast fertig.</Text>
            <Text style={styles.doneStatusSubtext}>Nummer verifiziert. Bilder und Angaben geprüft. Jetzt fehlt nur noch deine Zustimmung.</Text>
          </View>

          <View style={styles.legalConsentCard}>
            <Text style={styles.legalConsentTitle}>Rechtliches</Text>
            <Text style={styles.legalConsentText}>
              Bevor du dein Konto bestätigst, musst du Impressum, Datenschutz, Rechtliches und AGB gelesen haben. Mit deiner Zustimmung willigst du außerdem ausdrücklich in die Verarbeitung deiner Profilangaben für Matching, Moderation und Kontosicherheit ein.
            </Text>

            <View style={styles.legalLinksRow}>
              <Pressable onPress={() => void openLegalDocument(LEGAL_URLS.impressum)} style={styles.legalLinkPill}>
                <Text style={styles.legalLinkPillText}>Impressum</Text>
              </Pressable>
              <Pressable onPress={() => void openLegalDocument(LEGAL_URLS.datenschutz)} style={styles.legalLinkPill}>
                <Text style={styles.legalLinkPillText}>Datenschutz</Text>
              </Pressable>
              <Pressable onPress={() => void openLegalDocument(LEGAL_URLS.rechtliches)} style={styles.legalLinkPill}>
                <Text style={styles.legalLinkPillText}>Rechtliches</Text>
              </Pressable>
              <Pressable onPress={() => void openLegalDocument(LEGAL_URLS.agb)} style={styles.legalLinkPill}>
                <Text style={styles.legalLinkPillText}>AGB</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => updateProfile("consent", !profile.consent)}
              style={[styles.legalConsentToggle, profile.consent && styles.legalConsentToggleActive]}
            >
              <View style={[styles.legalConsentCheckbox, profile.consent && styles.legalConsentCheckboxActive]}>
                {profile.consent ? <Text style={styles.legalConsentCheckmark}>✓</Text> : null}
              </View>
              <Text style={styles.legalConsentLabel}>
                Ich habe Impressum, Datenschutz, Rechtliches und AGB gelesen, stimme ihnen zu und willige ausdrücklich ein, dass Choice meine Profilangaben verarbeitet, auch wenn daraus Rückschlüsse auf Dating-Präferenzen oder sexuelle Orientierung möglich sind.
              </Text>
            </Pressable>
          </View>

          <View style={styles.decisionPreviewRow}>
            <Pressable onPress={startProfileEditing} style={styles.decisionGhostButton}>
              <Text style={styles.decisionGhostText}>Bearbeiten</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void confirmOnboardingAndFinish();
              }}
              disabled={isSubmitting || !profile.consent}
              style={[styles.decisionSolidButton, (!profile.consent || isSubmitting) && styles.decisionSolidButtonDisabled]}
            >
              <Text style={styles.decisionSolidText}>{isSubmitting ? "..." : "Zustimmen & fertig"}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (currentScreen.kind === "phone") {
      return (
        <View style={styles.fieldWrap}>
          <View style={styles.phoneInputRow}>
            <View style={styles.phonePrefixChip}>
              <Text style={styles.phonePrefixText}>{phonePrefix}</Text>
            </View>
            <TextInput
              key="phone-input"
              value={phoneLocalValue}
              onChangeText={(value) => {
                setPhoneNumber(formatPhoneForStorage(value));
              }}
              placeholder="151 23456789"
              placeholderTextColor="#7d73aa"
              keyboardAppearance="dark"
              keyboardType="phone-pad"
              autoFocus
              autoCapitalize="none"
              maxLength={13}
              style={[styles.input, styles.phoneLocalInput]}
            />
          </View>
          <Text style={styles.inlineHint}>Die Vorwahl ist schon gesetzt. Du gibst nur noch deine Nummer ein.</Text>
        </View>
      );
    }

    if (currentScreen.kind === "otp") {
      return (
        <View style={styles.fieldWrap}>
          <TextInput
            key="otp-input"
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder={currentScreen.placeholder}
            placeholderTextColor="#7d73aa"
            keyboardAppearance="dark"
            keyboardType="number-pad"
            autoFocus
            style={styles.input}
          />
          <Text style={styles.inlineHint}>{phoneNumber}</Text>
        </View>
      );
    }

    if (currentScreen.kind === "text" || currentScreen.kind === "textarea") {
      if (currentScreen.id === "city") {
        return (
          <View style={styles.fieldWrap}>
            <TextInput
              key="city-input"
              value={String(profile.city ?? "")}
              onChangeText={(value) => updateProfile("city", value)}
              placeholder={currentScreen.placeholder}
              placeholderTextColor="#7d73aa"
              keyboardAppearance="dark"
              autoCapitalize="words"
              autoFocus
              style={styles.input}
            />

            {citySuggestions.length ? (
              <View style={styles.citySuggestionsCard}>
                {citySuggestions.map((entry) => {
                  const postalCodePreview =
                    entry.postalCodes.length > 2
                      ? `${entry.postalCodes.slice(0, 2).join(", ")} +${entry.postalCodes.length - 2}`
                      : entry.postalCodes.join(", ");

                  return (
                    <Pressable
                      key={`${entry.city}-${entry.state}`}
                      onPress={() => updateProfile("city", formatCityFieldValue(entry))}
                      style={styles.citySuggestionItem}
                    >
                      <Text style={styles.citySuggestionTitle}>{entry.city}</Text>
                      <Text style={styles.citySuggestionMeta}>
                        {entry.state} • {postalCodePreview}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : profile.city.trim().length >= 2 && !citySelectionResolved ? (
              <View style={styles.citySuggestionsCard}>
                <Text style={styles.citySuggestionEmpty}>Keine passende Stadt gefunden.</Text>
              </View>
            ) : null}
          </View>
        );
      }

      return (
        <View style={styles.fieldWrap}>
          <TextInput
            key={`${currentScreen.id}-input`}
            value={String(profile[currentScreen.id] ?? "")}
            onChangeText={(value) =>
              updateProfile(currentScreen.id, value as RegistrationProfile[typeof currentScreen.id])
            }
            placeholder={currentScreen.placeholder}
            placeholderTextColor="#7d73aa"
            keyboardAppearance="dark"
            keyboardType={currentScreen.keyboardType}
            autoFocus
            multiline={currentScreen.kind === "textarea"}
            style={[styles.input, currentScreen.kind === "textarea" && styles.textarea]}
          />
        </View>
      );
    }

    if (currentScreen.kind === "ageRange") {
      return (
        <View style={styles.fieldWrap}>
          <View style={styles.rangeInputRow}>
            <View style={styles.rangeInputColumn}>
              <Text style={styles.rangeInputLabel}>Von</Text>
              <TextInput
                value={profile.ageRangeMin}
                onChangeText={(value) => updateProfile("ageRangeMin", value.replace(/\D/g, ""))}
                placeholder="25"
                placeholderTextColor="#7d73aa"
                keyboardAppearance="dark"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.input}
              />
            </View>
            <View style={styles.rangeInputColumn}>
              <Text style={styles.rangeInputLabel}>Bis</Text>
              <TextInput
                value={profile.ageRangeMax}
                onChangeText={(value) => updateProfile("ageRangeMax", value.replace(/\D/g, ""))}
                placeholder="31"
                placeholderTextColor="#7d73aa"
                keyboardAppearance="dark"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.input}
              />
            </View>
          </View>
        </View>
      );
    }

    if (currentScreen.kind === "birthday") {
      return (
        <View style={styles.fieldWrap}>
          <Pressable onPress={() => setShowBirthdayPicker(true)} style={styles.birthdayTrigger}>
            <Text style={styles.birthdayTriggerLabel}>Geburtstag</Text>
            <Text style={styles.birthdayTriggerValue}>
              {hasBirthdaySelection
                ? `${padDatePart(birthdayPickerDate.getDate())}.${padDatePart(birthdayPickerDate.getMonth() + 1)}.${birthdayPickerDate.getFullYear()}`
                : "Geburtstag auswählen"}
            </Text>
            <Text style={styles.birthdayTriggerHint}>
              {calculatedProfileAge ? `${calculatedProfileAge} Jahre` : "Mindestens 18 Jahre"}
            </Text>
          </Pressable>

          {showBirthdayPicker && Platform.OS === "android" ? (
            <DateTimePicker
              value={birthdayPickerDate}
              mode="date"
              display="default"
              maximumDate={birthdayBounds.latest}
              minimumDate={birthdayBounds.earliest}
              onChange={handleBirthdayChange}
            />
          ) : null}

          {Platform.OS === "ios" ? (
            <Modal transparent visible={showBirthdayPicker} animationType="slide" onRequestClose={() => setShowBirthdayPicker(false)}>
              <Pressable style={styles.birthdayModalOverlay} onPress={() => setShowBirthdayPicker(false)}>
                <Pressable
                  style={[
                    styles.birthdayModalSheet,
                    {
                      paddingBottom: Math.max(insets.bottom, 14),
                    },
                  ]}
                  onPress={() => {}}
                >
                  <View style={styles.birthdayModalHeader}>
                    <Text style={styles.birthdayModalTitle}>Geburtstag</Text>
                    <Pressable onPress={() => setShowBirthdayPicker(false)} style={styles.birthdayModalDoneButton}>
                      <Text style={styles.birthdayModalDoneButtonText}>Fertig</Text>
                    </Pressable>
                  </View>

                  <DateTimePicker
                    value={birthdayPickerDate}
                    mode="date"
                    display="spinner"
                    maximumDate={birthdayBounds.latest}
                    minimumDate={birthdayBounds.earliest}
                    themeVariant="light"
                    accentColor="#2d6cdf"
                    textColor="#1a1d23"
                    style={styles.birthdayModalPicker}
                    onChange={handleBirthdayChange}
                  />
                </Pressable>
              </Pressable>
            </Modal>
          ) : null}
        </View>
      );
    }

    if (currentScreen.kind === "single") {
      if (currentScreen.id === "selfDescription") {
        return (
          <View style={styles.statementOptionList}>
            {currentScreen.options.map((option) => (
              <StatementOptionCard
                key={option.value}
                label={option.label}
                active={profile[currentScreen.id] === option.value}
                onPress={() =>
                  updateProfile(currentScreen.id, option.value as RegistrationProfile[typeof currentScreen.id])
                }
              />
            ))}
          </View>
        );
      }

      return (
        <View style={styles.optionsWrap}>
          {currentScreen.options.map((option) => (
            <SelectionChip
              key={option.value}
              label={option.label}
              active={profile[currentScreen.id] === option.value}
              onPress={() =>
                updateProfile(currentScreen.id, option.value as RegistrationProfile[typeof currentScreen.id])
              }
            />
          ))}
        </View>
      );
    }

    if (currentScreen.kind === "multi") {
      return (
        <View style={styles.optionsWrap}>
          {currentScreen.options.map((option) => (
            <SelectionChip
              key={option.value}
              label={option.label}
              active={profile.interests.includes(option.value)}
              onPress={() => toggleInterest(option.value)}
            />
          ))}
        </View>
      );
    }

    if (currentScreen.kind === "preferences") {
      return (
        <View style={styles.fieldWrap}>
          <View style={styles.preferenceSection}>
            <Text style={styles.preferenceSectionTitle}>Eher pro</Text>
            <Text style={styles.preferenceSectionHint}>Was findest du beim Schreiben oder Daten attraktiv?</Text>
            <Text style={styles.preferenceSectionHint}>Bis zu 4 auswählen.</Text>
            <View style={styles.optionsWrap}>
              {currentScreen.greenFlagOptions.map((option) => (
                <SelectionChip
                  key={`green-${option.value}`}
                  label={option.label}
                  active={profile.greenFlags.includes(option.value)}
                  onPress={() => togglePreference("greenFlags", option.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.preferenceSection}>
            <Text style={styles.preferenceSectionTitle}>No-Gos</Text>
            <Text style={styles.preferenceSectionHint}>Was macht es für dich schnell schwierig?</Text>
            <Text style={styles.preferenceSectionHint}>Bis zu 4 auswählen.</Text>
            <View style={styles.optionsWrap}>
              {currentScreen.dealbreakerOptions.map((option) => (
                <SelectionChip
                  key={`dealbreaker-${option.value}`}
                  label={option.label}
                  active={profile.dealbreakers.includes(option.value)}
                  onPress={() => togglePreference("dealbreakers", option.value)}
                />
              ))}
            </View>
          </View>
        </View>
      );
    }

    if (currentScreen.kind === "photos") {
      return (
        <View style={styles.fieldWrap}>
          <Text style={styles.inlineHint}>Dein erstes Bild wird im Profil zuerst gezeigt. Du kannst bis zu 8 Bilder und optional 1 Video bis 30 Sekunden hinzufügen.</Text>
          <View style={styles.photoGrid}>
            {Array.from({ length: maximumPhotoCount }, (_, slotIndex) => {
              const uri = photoUris[slotIndex];
              const isFilled = Boolean(uri);

              return (
                <View key={`photo-slot-${slotIndex}`} style={styles.photoSlotColumn}>
                  <Pressable onPress={() => void pickPhoto(slotIndex)} style={styles.photoSlot}>
                    {isFilled ? (
                      <Image source={{ uri }} style={styles.photoSlotImage} />
                    ) : (
                      <View style={styles.photoSlotPlaceholder}>
                        <Text style={styles.photoSlotPlus}>+</Text>
                        <Text style={styles.photoSlotText}>Bild {slotIndex + 1}</Text>
                      </View>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={isFilled ? () => removePhoto(slotIndex) : () => void pickPhoto(slotIndex)}
                    style={styles.photoSlotAction}
                  >
                    <Text style={styles.photoSlotActionText}>{isFilled ? "Entfernen" : "Hinzufügen"}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.videoSlotCard}>
            <View style={styles.videoSlotHeader}>
              <Text style={styles.videoSlotTitle}>Optional: 1 Video</Text>
              <Text style={styles.videoSlotMeta}>{formatVideoDurationLabel(introVideoDurationMs)}</Text>
            </View>

            {introVideoUri ? (
              <View style={styles.videoSlotPreviewWrap}>
                <InlineVideoPreview uri={introVideoUri} height={236} />
                <Text style={styles.videoSlotFilledText}>So erscheint dein Video im Profil.</Text>
              </View>
            ) : (
              <Pressable onPress={() => void pickVideo()} style={styles.videoSlot}>
                <View style={styles.videoSlotEmpty}>
                  <Text style={styles.videoSlotPlayIcon}>▶</Text>
                  <View style={styles.videoSlotCopy}>
                    <Text style={styles.videoSlotFilledTitle}>Video hinzufügen</Text>
                    <Text style={styles.videoSlotFilledText}>Ein kurzer Eindruck von dir. Maximal 30 Sekunden.</Text>
                  </View>
                </View>
              </Pressable>
            )}

            <View style={styles.videoSlotActionRow}>
              <Pressable onPress={() => void pickVideo()} style={styles.photoSlotAction}>
                <Text style={styles.photoSlotActionText}>{introVideoUri ? "Anderes Video" : "Hinzufügen"}</Text>
              </Pressable>
              {introVideoUri ? (
                <Pressable onPress={removeVideo} style={styles.videoSlotSecondaryAction}>
                  <Text style={styles.videoSlotSecondaryActionText}>Entfernen</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      );
    }

    return null;
  }

  const showBackButton = screenIndex > 0 && currentScreen.kind !== "done";
  const showOnboardingProgress = !editingProfile && currentScreen.kind !== "done";

  const primaryLabel = (() => {
    if (isSubmitting) {
      return "...";
    }

    if (editingProfile && editingProfileScreenId && currentScreen.kind !== "photos") {
      return "Speichern";
    }

    if (currentScreen.kind === "phone") {
      return "Code senden";
    }

    if (currentScreen.kind === "otp") {
      return "Prüfen";
    }

    if (currentScreen.kind === "photos") {
      return editingProfile ? "Änderungen speichern" : "Profil abschließen";
    }

    if (currentScreen.kind === "done") {
      return "Neu";
    }

    return "Weiter";
  })();

  if (!isSessionHydrated) {
    return (
      <View style={styles.sessionRestoreShell}>
        <Text style={styles.sessionRestoreText}>CHOICE</Text>
      </View>
    );
  }

  if (currentSurface === "overview") {
    return (
      <>
        <OverviewScreen
          currentTab={overviewTab}
          onSelectTab={setOverviewTab}
          onOpenAccountSwitcher={() => setShowAccountSwitcher(true)}
          onSwitchToMatchedAccount={switchToMatchedAccount}
          onEditProfileField={startProfileFieldEditing}
          onPauseAccount={handlePauseAccount}
          onSignOut={handleSignOut}
          onDeleteAccount={handleDeleteAccount}
          accountActionPending={accountActionPending}
          accountActionMessage={accountActionMessage}
          displayName={overviewDisplayName}
          currentUserId={verifiedUserId}
          profile={profile}
          photoUris={photoUris}
          introVideoUri={introVideoUri}
          introVideoDurationMs={introVideoDurationMs}
        />
        <Modal
          visible={showAccountSwitcher}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowAccountSwitcher(false)}
        >
          <Pressable style={styles.accountSwitchOverlay} onPress={() => setShowAccountSwitcher(false)}>
            <Pressable style={styles.accountSwitchCard} onPress={() => {}}>
              <Text style={styles.accountSwitchEyebrow}>Kontowechsel</Text>
              <Text style={styles.accountSwitchTitle}>Zwischen Accounts springen</Text>
              <Text style={styles.accountSwitchText}>
                Wähl einen gespeicherten Account oder geh mit einer anderen Nummer neu rein.
              </Text>

              <View style={styles.accountSwitchList}>
                {alternateRememberedSessions.length ? (
                  alternateRememberedSessions.map((session) => {
                    const sessionName = session.profile.firstName.trim() || "Choice";
                    const sessionMatchState = rememberedSessionMatchStates[session.userId];
                    const sessionMeta = [
                      session.phoneNumber ?? "",
                      session.profile.city.trim(),
                    ].filter(Boolean).join(" • ");

                    return (
                      <Pressable
                        key={session.userId}
                        onPress={() => void switchToRememberedSession(session)}
                        style={({ pressed }) => [
                          styles.accountSwitchOption,
                          pressed && styles.accountSwitchOptionPressed,
                        ]}
                      >
                        <View style={styles.accountSwitchOptionAvatar}>
                          <Text style={styles.accountSwitchOptionAvatarText}>{sessionName.slice(0, 1).toUpperCase()}</Text>
                        </View>
                        <View style={styles.accountSwitchOptionCopy}>
                          <View style={styles.accountSwitchOptionHeader}>
                            <Text style={styles.accountSwitchOptionName}>{sessionName}</Text>
                            {sessionMatchState?.badgeLabel ? (
                              <View style={styles.accountSwitchMatchBadge}>
                                <Text style={styles.accountSwitchMatchBadgeText}>{sessionMatchState.badgeLabel}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.accountSwitchOptionMeta}>
                            {sessionMatchState?.detailLabel || sessionMeta || "Gespeicherter Account"}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.accountSwitchEmpty}>
                    <Text style={styles.accountSwitchEmptyText}>
                      Sobald du dich mit einer zweiten Nummer anmeldest, erscheint sie hier zum schnellen Wechseln.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.decisionPreviewRow}>
                <Pressable onPress={() => setShowAccountSwitcher(false)} style={styles.decisionGhostButton}>
                  <Text style={styles.decisionGhostText}>Schließen</Text>
                </Pressable>
                <Pressable onPress={startAccountSwitchSignIn} style={styles.decisionSolidButton}>
                  <Text style={styles.decisionSolidText}>Andere Nummer</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {currentScreen.kind === "intro" ? (
          <>
            {renderField()}
            <View style={styles.introActionWrap}>
              <Pressable
                onPress={() => {
                  startEntry("signup");
                }}
                style={styles.introButton}
              >
                <Text style={styles.introButtonText}>Konto erstellen</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  startEntry("signin");
                }}
                style={styles.introSecondaryButton}
              >
                <Text style={styles.introSecondaryButtonText}>Anmelden</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.formShell}>
            {showOnboardingProgress ? (
              <View style={styles.topRow}>
                <Text style={styles.topTag}>{compactPreview}</Text>
                <Text style={styles.topCount}>
                  {currentFormIndex}/{formScreensCount}
                </Text>
              </View>
            ) : null}

            {showOnboardingProgress ? (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(currentFormIndex / formScreensCount) * 100}%` }]} />
              </View>
            ) : null}

            <View style={styles.card}>
              {renderStagePreview()}
              <Text style={styles.screenTitle}>{displayScreenTitle}</Text>
              {displayScreenHint ? <Text style={styles.screenHint}>{displayScreenHint}</Text> : null}

              {renderField()}

              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {currentScreen.kind !== "done" ? (
                <View style={styles.actionStack}>
                  <View style={styles.actionRow}>
                    {showBackButton ? (
                      <Pressable onPress={goBack} style={styles.secondaryButton} disabled={isSubmitting}>
                        <Text style={styles.secondaryButtonText}>Zurück</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        void goForward();
                      }}
                      disabled={isSubmitting}
                      style={[styles.primaryButton, !showBackButton && styles.primaryButtonSolo]}
                    >
                      <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sessionRestoreShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionRestoreText: {
    color: "#fff6ff",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 4,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "stretch",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 18,
  },
  introCard: {
    width: "100%",
    overflow: "hidden",
    alignSelf: "center",
    maxWidth: 520,
    borderRadius: 32,
    backgroundColor: "rgba(20, 14, 24, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.18)",
  },
  introCopyWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 14,
  },
  introTitle: {
    color: "#fff5ff",
    fontSize: 44,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -1.3,
  },
  introSubtitle: {
    color: "#d6c8e9",
    fontSize: 17,
    lineHeight: 24,
  },
  introHighlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  introHighlightPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.16)",
  },
  introHighlightText: {
    color: "#ecf7ff",
    fontSize: 13,
    fontWeight: "700",
  },
  introFootnote: {
    color: "#9c90bb",
    fontSize: 14,
    lineHeight: 20,
  },
  introActionWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 520,
    gap: 8,
  },
  introButton: {
    width: "100%",
    alignSelf: "center",
    maxWidth: 520,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#e55d87",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#e55d87",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 20,
    elevation: 6,
  },
  introButtonText: {
    color: "#fff8fc",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  introSecondaryButton: {
    alignSelf: "center",
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  introSecondaryButtonText: {
    color: "#abdfff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.15,
    textDecorationLine: "underline",
  },
  introDevButton: {
    alignSelf: "center",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
  },
  introDevButtonText: {
    color: "#d6f3ff",
    fontSize: 13,
    fontWeight: "700",
  },
  artFrame: {
    height: 292,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: "#18121d",
    gap: 10,
  },
  artGlowLarge: {
    position: "absolute",
    top: -22,
    left: 10,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(52, 207, 255, 0.24)",
  },
  artGlowMid: {
    position: "absolute",
    top: 26,
    right: -28,
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: "rgba(255, 56, 98, 0.24)",
  },
  artGlowSmall: {
    position: "absolute",
    bottom: -36,
    left: -20,
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: "rgba(255, 56, 98, 0.18)",
  },
  artGlowCenter: {
    position: "absolute",
    bottom: 40,
    right: 28,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(160, 96, 255, 0.16)",
  },
  logoStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    paddingBottom: 6,
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.16)",
  },
  logoImagePlate: {
    width: "100%",
    height: 162,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  introPreviewCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(9, 12, 24, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 70, 118, 0.16)",
    gap: 6,
  },
  introPreviewLabel: {
    color: "#98dfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  introPreviewTitle: {
    color: "#fff7ff",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  introPreviewText: {
    color: "#bdb1d8",
    fontSize: 11,
    lineHeight: 16,
  },
  overviewShell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 16,
  },
  overviewHeaderStatic: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingBottom: 0,
    gap: 12,
  },
  accountPausedWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  overviewHeaderSwitchButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  overviewHeaderSwitchButtonText: {
    color: "#f2eaff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  chatFullScreenShell: {
    flex: 1,
    backgroundColor: "#0d0a11",
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  overviewHeaderEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  overviewHeaderTitle: {
    marginTop: 4,
    color: "#fff7ff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  overviewScroll: {
    flex: 1,
  },
  overviewScrollContent: {
    gap: 14,
    paddingBottom: 8,
  },
  overviewStatusCard: {
    padding: 18,
    borderRadius: 26,
    backgroundColor: "rgba(17, 12, 24, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.14)",
    gap: 10,
  },
  overviewStatusEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  overviewStatusTitle: {
    color: "#fff7ff",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  overviewStatusText: {
    color: "#c0b2d8",
    fontSize: 14,
    lineHeight: 20,
  },
  overviewStatusPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  matchReleaseNoticeCard: {
    padding: 18,
    borderRadius: 26,
    backgroundColor: "rgba(255, 66, 124, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 116, 165, 0.24)",
    gap: 10,
  },
  matchReleaseNoticeEyebrow: {
    color: "#ffd8e7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  matchReleaseNoticeTitle: {
    color: "#fff7ff",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  matchReleaseNoticeText: {
    color: "#f0dbe5",
    fontSize: 14,
    lineHeight: 20,
  },
  homePhaseFiveAwardAction: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(152, 223, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(152, 223, 255, 0.18)",
  },
  homePhaseFiveAwardActionPressed: {
    opacity: 0.92,
  },
  homePhaseFiveAwardActionText: {
    color: "#def5ff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  homePhaseFiveRestartAction: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#c2386d",
    shadowColor: "#120b16",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },
  homePhaseFiveRestartActionPressed: {
    opacity: 0.94,
  },
  homePhaseFiveRestartActionText: {
    color: "#fff8fb",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  matchReleaseProfilePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  matchReleaseProfileImage: {
    width: 66,
    height: 66,
    borderRadius: 22,
  },
  matchReleaseProfileCopy: {
    flex: 1,
    gap: 3,
  },
  matchReleaseProfileName: {
    color: "#fff7ff",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
  },
  matchReleaseProfileMeta: {
    color: "#d8cbe4",
    fontSize: 12,
    lineHeight: 17,
  },
  matchReleaseProfileTagline: {
    color: "#f2dfe8",
    fontSize: 13,
    lineHeight: 18,
  },
  matchReleaseReasonList: {
    gap: 6,
  },
  matchReleaseReasonText: {
    color: "#f3e0ea",
    fontSize: 13,
    lineHeight: 19,
  },
  matchReleaseNoticeActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  matchReleaseNoticeGhostButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  matchReleaseNoticeGhostText: {
    color: "#fff4fb",
    fontSize: 14,
    fontWeight: "700",
  },
  matchReleaseNoticeSolidButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#c2386d",
  },
  matchReleaseNoticeSolidText: {
    color: "#fff8fb",
    fontSize: 14,
    fontWeight: "700",
  },
  matchReleaseNoticeSubtleButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(17, 12, 24, 0.52)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  matchReleaseNoticeSubtleText: {
    color: "#f8edf4",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  overviewPill: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  overviewPillText: {
    color: "#edf7ff",
    fontSize: 12,
    fontWeight: "700",
  },
  overviewMetricRow: {
    flexDirection: "row",
    gap: 10,
  },
  overviewMetricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
    gap: 8,
  },
  overviewMetricLabel: {
    color: "#a99fcf",
    fontSize: 12,
    fontWeight: "700",
  },
  overviewMetricValue: {
    color: "#fff7ff",
    fontSize: 24,
    fontWeight: "800",
  },
  penaltyCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(36, 16, 28, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(229, 93, 135, 0.24)",
    gap: 12,
  },
  penaltyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  penaltyTitleWrap: {
    flex: 1,
    gap: 4,
  },
  penaltyEyebrow: {
    color: "#ff9ac0",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  penaltyTitle: {
    color: "#fff7ff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  penaltyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 154, 192, 0.26)",
  },
  penaltyBadgeText: {
    color: "#fff0f6",
    fontSize: 12,
    fontWeight: "800",
  },
  penaltyText: {
    color: "#d4b9c8",
    fontSize: 14,
    lineHeight: 20,
  },
  penaltyProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  penaltyProgressCopy: {
    flex: 1,
    gap: 6,
  },
  penaltyProgressTitle: {
    color: "#fff2f6",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  penaltyFootnote: {
    color: "#b798aa",
    fontSize: 12,
    lineHeight: 18,
  },
  penaltyReasonList: {
    gap: 10,
  },
  penaltyReasonIntro: {
    color: "#f1d3df",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  penaltyReasonItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  penaltyReasonDot: {
    marginTop: 7,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#ff7b9d",
  },
  penaltyReasonText: {
    flex: 1,
    color: "#d8bcc8",
    fontSize: 13,
    lineHeight: 19,
  },
  penaltyHistoryBlock: {
    gap: 10,
    marginTop: 4,
  },
  legalSupportButton: {
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "rgba(152, 223, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(152, 223, 255, 0.18)",
  },
  legalSupportButtonText: {
    color: "#def5ff",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  legalSupportButtonMeta: {
    color: "#9fc8d8",
    fontSize: 12,
    lineHeight: 17,
  },
  penaltyHistoryList: {
    gap: 10,
  },
  penaltyHistoryItem: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 4,
  },
  penaltyHistoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  penaltyHistoryReason: {
    flex: 1,
    color: "#fff0f6",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  penaltyHistoryStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  penaltyHistoryStatusBadgeActive: {
    backgroundColor: "rgba(255, 123, 157, 0.14)",
    borderColor: "rgba(255, 123, 157, 0.32)",
  },
  penaltyHistoryStatusBadgeInactive: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  penaltyHistoryStatusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  penaltyHistoryStatusTextActive: {
    color: "#ffd4e1",
  },
  penaltyHistoryStatusTextInactive: {
    color: "#b798aa",
  },
  penaltyHistoryMeta: {
    color: "#b798aa",
    fontSize: 12,
    lineHeight: 17,
  },
  penaltyHistoryCountdown: {
    color: "#ffd4e1",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  moderationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  moderationBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 115, 167, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 115, 167, 0.28)",
  },
  moderationBadgeText: {
    color: "#ffd6e5",
    fontSize: 13,
    fontWeight: "800",
  },
  moderationList: {
    gap: 12,
    marginTop: 16,
  },
  moderationCard: {
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  moderationCardTopRow: {
    gap: 6,
  },
  moderationCardTitle: {
    color: "#fff7ff",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  moderationCardMeta: {
    color: "#9f95c3",
    fontSize: 12,
    lineHeight: 17,
  },
  moderationReasonPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(154, 223, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(154, 223, 255, 0.18)",
  },
  moderationReasonPillText: {
    color: "#ccefff",
    fontSize: 12,
    fontWeight: "700",
  },
  moderationCardText: {
    color: "#d7d0e8",
    fontSize: 14,
    lineHeight: 20,
  },
  moderationQuoteCard: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#120f18",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  moderationQuoteLabel: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  moderationQuoteText: {
    color: "#f4efff",
    fontSize: 14,
    lineHeight: 20,
  },
  moderationActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  moderationDismissButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  moderationDismissButtonText: {
    color: "#f3f0ff",
    fontSize: 13,
    fontWeight: "700",
  },
  moderationConfirmButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#6f2948",
  },
  moderationConfirmButtonText: {
    color: "#fff8fb",
    fontSize: 13,
    fontWeight: "700",
  },
  reportFeedbackCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(154, 223, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(154, 223, 255, 0.16)",
  },
  reportFeedbackText: {
    color: "#d8f3ff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  unlockCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(18, 16, 32, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255, 182, 95, 0.22)",
    gap: 12,
  },
  unlockHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  unlockTitleWrap: {
    flex: 1,
    gap: 4,
  },
  unlockEyebrow: {
    color: "#ffcb82",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  unlockTitle: {
    color: "#fff7ff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  unlockBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 203, 130, 0.26)",
  },
  unlockBadgeText: {
    color: "#fff5e8",
    fontSize: 12,
    fontWeight: "800",
  },
  unlockText: {
    color: "#d8c6ba",
    fontSize: 14,
    lineHeight: 20,
  },
  unlockProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  unlockRingWrap: {
    width: 118,
    height: 118,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockRingCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  unlockRingValue: {
    color: "#fff7ff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  unlockRingLabel: {
    color: "#d9c8bc",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  unlockProgressCopy: {
    flex: 1,
    gap: 6,
  },
  unlockProgressTitle: {
    color: "#fff2e6",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  unlockFootnote: {
    color: "#b8a79d",
    fontSize: 12,
    lineHeight: 18,
  },
  unlockPurchaseButton: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: "#1b1521",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 145, 0.52)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
  },
  unlockPurchaseButtonPressed: {
    opacity: 0.92,
  },
  unlockPurchaseButtonDisabled: {
    opacity: 0.52,
  },
  unlockPurchaseButtonContent: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  unlockPurchaseButtonLabelRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unlockPurchaseButtonTitle: {
    flex: 1,
    color: "#f3edf9",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    letterSpacing: 0,
  },
  unlockPurchasePricePill: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(154, 223, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(154, 223, 255, 0.18)",
  },
  unlockPurchasePriceText: {
    color: "#dff6ff",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0,
  },
  unlockPurchaseHint: {
    color: "#ceb9ac",
    fontSize: 12,
    lineHeight: 18,
  },
  unlockPurchaseFeedbackCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 203, 130, 0.18)",
  },
  unlockPurchaseFeedbackText: {
    color: "#fff2e6",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  phaseJumpCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(17, 12, 24, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(154, 223, 255, 0.16)",
    gap: 12,
  },
  phaseJumpEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  phaseJumpTitle: {
    color: "#fff7ff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  phaseJumpText: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 20,
  },
  phaseJumpButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  phaseJumpButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(154, 223, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(154, 223, 255, 0.24)",
  },
  phaseJumpButtonText: {
    color: "#e6f8ff",
    fontSize: 13,
    fontWeight: "700",
  },
  overviewDecisionRow: {
    flexDirection: "row",
    gap: 10,
  },
  overviewListCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(17, 12, 24, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
    gap: 14,
  },
  overviewListTitle: {
    color: "#fff7ff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  overviewSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  overviewSectionEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  overviewSectionEditText: {
    color: "#c7bbdf",
    fontSize: 12,
    fontWeight: "800",
  },
  profilePhotoRow: {
    gap: 10,
    paddingRight: 2,
  },
  profilePhotoButton: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  profilePhoto: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  profilePhotoPrimary: {
    width: 188,
    height: 248,
  },
  profilePhotoSecondary: {
    width: 148,
    height: 248,
  },
  overviewListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  overviewListCopy: {
    flex: 1,
    gap: 4,
  },
  overviewListName: {
    color: "#f7f4ff",
    fontSize: 16,
    fontWeight: "700",
  },
  overviewListMeta: {
    color: "#aea2cf",
    fontSize: 13,
    lineHeight: 18,
  },
  overviewVideoSection: {
    gap: 12,
  },
  phaseTwoAvatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 115, 167, 0.16)",
  },
  phaseTwoAvatarText: {
    color: "#ffd8e7",
    fontSize: 20,
    fontWeight: "800",
  },
  phaseTwoHeaderBadge: {
    minWidth: 56,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  phaseTwoHeaderBadgeText: {
    color: "#efe8ff",
    fontSize: 13,
    fontWeight: "800",
  },
  phaseTwoScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 14,
  },
  phaseTwoProgressCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(17, 12, 24, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
    gap: 10,
  },
  phaseTwoEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  phaseTwoProgressTitle: {
    color: "#fff7ff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  phaseTwoProgressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  phaseTwoProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#86e3ff",
  },
  phaseTwoWaitCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255, 184, 134, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 184, 134, 0.22)",
    gap: 10,
  },
  phaseTwoWaitLabel: {
    color: "#ffe4c5",
    fontSize: 15,
    fontWeight: "800",
  },
  phaseTwoWaitText: {
    color: "#d8caeb",
    fontSize: 14,
    lineHeight: 20,
  },
  phaseTwoWaitButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  phaseTwoWaitButtonText: {
    color: "#f6efff",
    fontSize: 13,
    fontWeight: "800",
  },
  phaseTwoContextCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 6,
  },
  phaseTwoContextLabel: {
    color: "#8f87b6",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  phaseTwoContextValue: {
    color: "#f7f4ff",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  phaseTwoQuestionCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(17, 12, 24, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
    gap: 10,
  },
  phaseTwoQuestionEyebrow: {
    color: "#ffb9d3",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  phaseTwoQuestionText: {
    color: "#fff7ff",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  phaseTwoSavingText: {
    marginTop: 10,
    color: "#9adfff",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  phaseTwoAnswerList: {
    gap: 12,
  },
  phaseTwoAnswerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.22)",
  },
  phaseTwoAnswerCardPressed: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(134, 227, 255, 0.28)",
  },
  phaseTwoAnswerScoreBubble: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(134, 227, 255, 0.18)",
  },
  phaseTwoAnswerScoreText: {
    color: "#d6f6ff",
    fontSize: 14,
    fontWeight: "800",
  },
  phaseTwoAnswerText: {
    flex: 1,
    color: "#f5eeff",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  phaseTwoEntryCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(17, 12, 24, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 115, 167, 0.16)",
    gap: 12,
  },
  phaseTwoEntryTitle: {
    color: "#fff7ff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  phaseTwoEntryText: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 21,
  },
  phaseTwoEntryResultPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(134, 227, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(134, 227, 255, 0.22)",
  },
  phaseTwoEntryResultText: {
    color: "#d6f6ff",
    fontSize: 12,
    fontWeight: "800",
  },
  phaseTwoStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  phaseTwoStatusPillSuccess: {
    backgroundColor: "rgba(134, 227, 255, 0.14)",
    borderColor: "rgba(134, 227, 255, 0.22)",
  },
  phaseTwoStatusPillMuted: {
    backgroundColor: "rgba(255, 184, 134, 0.12)",
    borderColor: "rgba(255, 184, 134, 0.24)",
  },
  phaseTwoStatusPillText: {
    color: "#fff4ea",
    fontSize: 12,
    fontWeight: "800",
  },
  phaseTwoEntryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c42f69",
  },
  phaseTwoEntryButtonText: {
    color: "#fff7fb",
    fontSize: 14,
    fontWeight: "800",
  },
  phaseThreeEntryCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(13, 13, 25, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(134, 227, 255, 0.18)",
    gap: 12,
  },
  phaseThreeEntryTitle: {
    color: "#fff7ff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  phaseThreePreviewWrap: {
    marginTop: 2,
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  phaseThreePreviewImage: {
    width: "100%",
    height: 280,
    backgroundColor: "#120e18",
  },
  phaseThreePreviewCopy: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  phaseThreePreviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  phaseThreePreviewName: {
    flex: 1,
    color: "#fff7ff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  phaseThreePreviewPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(154, 223, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(154, 223, 255, 0.26)",
  },
  phaseThreePreviewPillText: {
    color: "#d8f2ff",
    fontSize: 12,
    fontWeight: "800",
  },
  phaseThreePreviewMeta: {
    color: "#b7aecf",
    fontSize: 14,
    fontWeight: "600",
  },
  phaseThreePreviewTagline: {
    color: "#d6cfee",
    fontSize: 14,
    lineHeight: 20,
  },
  phaseThreePreviewFallback: {
    marginTop: 2,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  phaseThreePreviewFallbackTitle: {
    color: "#fff7ff",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  phaseThreePreviewFallbackText: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 21,
  },
  phaseThreeDecisionRow: {
    flexDirection: "row",
    gap: 10,
  },
  phaseThreeDecisionOption: {
    flex: 1,
    minHeight: 156,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 14,
  },
  phaseThreeDecisionOptionStay: {
    backgroundColor: "rgba(255, 115, 167, 0.08)",
    borderColor: "rgba(255, 115, 167, 0.16)",
  },
  phaseThreeDecisionOptionNewMatch: {
    backgroundColor: "rgba(154, 223, 255, 0.08)",
    borderColor: "rgba(154, 223, 255, 0.18)",
  },
  phaseThreeDecisionOptionPressed: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  phaseThreeDecisionOptionActive: {
    backgroundColor: "rgba(255, 115, 167, 0.24)",
    borderColor: "rgba(255, 115, 167, 0.46)",
    shadowColor: "#ff73a7",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  phaseThreeDecisionOptionActivePressed: {
    backgroundColor: "rgba(255, 115, 167, 0.32)",
  },
  phaseThreeDecisionOptionMuted: {
    backgroundColor: "rgba(154, 223, 255, 0.18)",
    borderColor: "rgba(154, 223, 255, 0.34)",
    shadowColor: "#9adfff",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  phaseThreeDecisionOptionMutedPressed: {
    backgroundColor: "rgba(154, 223, 255, 0.26)",
  },
  phaseThreeDecisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  phaseThreeDecisionIcon: {
    color: "#f7e8f0",
    fontSize: 18,
    lineHeight: 18,
  },
  phaseThreeDecisionCopy: {
    flex: 1,
    gap: 6,
  },
  phaseThreeDecisionTitle: {
    color: "#fff7ff",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  phaseThreeDecisionTitleActive: {
    color: "#ffd7e7",
  },
  phaseThreeDecisionTitleMuted: {
    color: "#d8f2ff",
  },
  phaseThreeDecisionText: {
    color: "#a89dbf",
    fontSize: 13,
    lineHeight: 18,
  },
  phaseThreeDecisionMark: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 247, 251, 0.88)",
  },
  phaseThreeDecisionMarkText: {
    color: "#a01c52",
    fontSize: 13,
    fontWeight: "800",
  },
  phaseThreeDecisionMarkMuted: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 249, 255, 0.92)",
  },
  phaseThreeDecisionMarkMutedText: {
    color: "#14557d",
    fontSize: 13,
    fontWeight: "800",
  },
  phaseThreeResultCard: {
    marginTop: 2,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(134, 227, 255, 0.14)",
    gap: 12,
  },
  phaseFourEntryCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(15, 13, 24, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(182, 156, 255, 0.18)",
    gap: 12,
  },
  phaseFourEntryTitle: {
    color: "#fff7ff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  phaseFourLockCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(182, 156, 255, 0.14)",
  },
  phaseFourLockIcon: {
    color: "#d9c9ff",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
  },
  phaseFourLockCopy: {
    flex: 1,
    gap: 6,
  },
  phaseFourLockTitle: {
    color: "#f8f2ff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  phaseFourLockText: {
    color: "#b8add4",
    fontSize: 13,
    lineHeight: 19,
  },
  phaseFiveEntryCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(17, 12, 24, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255, 115, 167, 0.18)",
    gap: 12,
  },
  phaseFiveEntryTitle: {
    color: "#fff7ff",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  phaseFivePreviewCard: {
    marginTop: 4,
    gap: 10,
  },
  phaseFivePreviewLabel: {
    color: "#b696ff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  phaseFiveAwardCard: {
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "rgba(19,14,28,0.96)",
    borderWidth: 1,
    borderColor: "rgba(230, 218, 228, 0.14)",
    padding: 18,
    gap: 14,
    shadowColor: "#f0cfe2",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  phaseFiveHeartVisual: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  phaseFiveWordmark: {
    alignSelf: "center",
    width: 160,
    height: 44,
    marginTop: -16,
  },
  phaseFiveAwardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  phaseFiveAwardPersonBadge: {
    minWidth: 82,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  phaseFiveAwardPersonText: {
    color: "#fff7ff",
    fontSize: 13,
    fontWeight: "800",
  },
  phaseFiveAwardLink: {
    color: "#ffb4ce",
    fontSize: 18,
    fontWeight: "800",
  },
  phaseFiveAwardHeadline: {
    color: "#fff7ff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  phaseFiveAwardBody: {
    color: "#cdbfe4",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  phaseTwoResultCard: {
    padding: 20,
    borderRadius: 26,
    backgroundColor: "rgba(17, 12, 24, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255, 115, 167, 0.18)",
    gap: 12,
  },
  phaseTwoResultValue: {
    color: "#fff7ff",
    fontSize: 56,
    lineHeight: 60,
    fontWeight: "800",
    letterSpacing: -2,
  },
  phaseTwoResultTitle: {
    color: "#fff7ff",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  phaseTwoResultText: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 21,
  },
  phaseTwoResultInsightCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(134, 227, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(134, 227, 255, 0.14)",
    gap: 6,
  },
  phaseTwoResultInsightLabel: {
    color: "#d6f6ff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  phaseTwoResultInsightText: {
    color: "#eef8ff",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  phaseTwoResultList: {
    gap: 10,
    marginTop: 4,
  },
  phaseTwoResultRound: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 6,
  },
  phaseTwoResultRoundTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  phaseTwoResultRoundLabel: {
    color: "#d8f2ff",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  phaseTwoResultRoundScore: {
    color: "#ffd7e7",
    fontSize: 14,
    fontWeight: "800",
  },
  phaseTwoResultRoundText: {
    color: "#ece4ff",
    fontSize: 14,
    lineHeight: 20,
  },
  phaseTwoResultRoundTopic: {
    color: "#b8f0ff",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  phaseTwoResultRoundComment: {
    color: "#b8add4",
    fontSize: 13,
    lineHeight: 19,
  },
  chatSurfaceCard: {
    marginTop: 8,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#120f18",
    borderWidth: 1,
    borderColor: "rgba(144, 128, 255, 0.16)",
  },
  chatSurfaceCardFullScreen: {
    flex: 1,
    marginTop: 0,
    borderRadius: 0,
    borderWidth: 0,
  },
  chatSurfaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  chatSurfaceHeaderFullScreen: {
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#16121d",
  },
  chatSurfaceBackButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  chatSurfaceBackButtonText: {
    color: "#ecf7ff",
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "400",
    marginTop: -2,
  },
  chatSurfaceProfileButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatSurfaceAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  chatSurfaceAvatarImage: {
    width: "100%",
    height: "100%",
  },
  chatSurfaceAvatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chatSurfaceAvatarFallbackText: {
    color: "#eaf8ff",
    fontSize: 16,
    fontWeight: "800",
  },
  chatSurfaceHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  chatSurfaceActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatSurfaceReportButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 206, 220, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 206, 220, 0.18)",
  },
  chatSurfaceReportButtonText: {
    color: "#ffd3e3",
    fontSize: 12,
    fontWeight: "700",
  },
  chatSurfaceActionButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chatSurfaceActionButtonActive: {
    backgroundColor: "rgba(255, 115, 167, 0.18)",
    borderColor: "rgba(255, 115, 167, 0.36)",
  },
  chatSurfaceActionIcon: {
    color: "#ecf7ff",
    fontSize: 16,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 3,
  },
  chatSurfaceActionIconActive: {
    color: "#ffd8e8",
  },
  chatSurfaceTitle: {
    color: "#fff7ff",
    fontSize: 16,
    fontWeight: "700",
  },
  chatSurfaceSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chatSurfaceStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  chatSurfaceStatusDotOnline: {
    backgroundColor: "#6af0a4",
  },
  chatSurfaceStatusDotOffline: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  chatSurfaceSubtitle: {
    color: "#9e95c3",
    fontSize: 12,
    lineHeight: 17,
  },
  chatSurfaceSubtitleOnline: {
    color: "#d7ffe8",
  },
  chatSurfaceThreadScroll: {
    flex: 1,
    backgroundColor: "#0d0a11",
  },
  chatSurfaceThread: {
    flexGrow: 1,
    gap: 10,
    minHeight: 280,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#0d0a11",
  },
  chatSurfaceThreadFullScreen: {
    flexGrow: 1,
    minHeight: "100%",
  },
  chatThreadSupplement: {
    marginTop: 6,
  },
  chatThreadSupplementDock: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: "#0d0a11",
  },
  chatThreadContent: {
    gap: 10,
  },
  chatThreadContentPinned: {
    flex: 1,
  },
  chatThreadMessages: {
    gap: 10,
  },
  chatThreadMessagesPinned: {
    marginTop: "auto",
  },
  chatHistoryStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  chatHistoryStartLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  chatHistoryStartText: {
    color: "#857c9f",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  phaseNoticeCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  phaseNoticeCopy: {
    gap: 4,
  },
  phaseNoticeEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  phaseNoticeTitle: {
    color: "#fff7ff",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  phaseNoticeText: {
    color: "#b5abcc",
    fontSize: 14,
    lineHeight: 21,
  },
  phaseNoticeButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c42f69",
  },
  phaseNoticeButtonText: {
    color: "#fff7fb",
    fontSize: 14,
    fontWeight: "700",
  },
  phaseFiveNoticeCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: "rgba(19, 42, 49, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(146, 227, 255, 0.18)",
    gap: 12,
    shadowColor: "#6fd7ff",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  phaseFiveNoticeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(146, 227, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(146, 227, 255, 0.14)",
  },
  phaseFiveNoticeBadgeText: {
    color: "#bfefff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  phaseFiveNoticeTitle: {
    color: "#f5fdff",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  phaseFiveNoticeText: {
    color: "#c6dde4",
    fontSize: 14,
    lineHeight: 21,
  },
  phaseFiveNoticeFooter: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  phaseFiveNoticeFooterText: {
    color: "#e5f5fa",
    fontSize: 12,
    fontWeight: "700",
  },
  chatDecisionOverlay: {
    flex: 1,
    backgroundColor: "rgba(6, 5, 10, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(6, 5, 10, 0.62)",
  },
  reportModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  reportModalScroll: {
    flex: 1,
  },
  reportModalScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  chatDecisionCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#17121d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  reportModalCard: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#17121d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  chatDecisionEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  chatDecisionTitle: {
    color: "#fff7ff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  chatDecisionText: {
    color: "#b5abcc",
    fontSize: 14,
    lineHeight: 21,
  },
  chatDecisionButtonColumn: {
    gap: 10,
    marginTop: 6,
  },
  chatDecisionOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chatDecisionOptionButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  chatDecisionOptionButtonActive: {
    backgroundColor: "rgba(255, 94, 152, 0.26)",
    borderColor: "rgba(255, 127, 176, 0.52)",
    shadowColor: "#ff5e98",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  chatDecisionOptionButtonActivePressed: {
    backgroundColor: "rgba(255, 94, 152, 0.34)",
  },
  chatDecisionOptionButtonActiveMuted: {
    backgroundColor: "rgba(154, 223, 255, 0.18)",
    borderColor: "rgba(154, 223, 255, 0.34)",
    shadowColor: "#9adfff",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  chatDecisionOptionButtonActiveMutedPressed: {
    backgroundColor: "rgba(154, 223, 255, 0.26)",
  },
  chatDecisionOptionIcon: {
    width: 26,
    color: "#f7e8f0",
    fontSize: 18,
    lineHeight: 18,
    textAlign: "center",
  },
  chatDecisionOptionIconActive: {
    color: "#ff7aad",
    textShadowColor: "rgba(255, 122, 173, 0.5)",
    textShadowRadius: 12,
  },
  chatDecisionOptionCopy: {
    flex: 1,
    gap: 3,
  },
  chatDecisionOptionTitle: {
    color: "#fff7ff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  chatDecisionOptionTitleActive: {
    color: "#ffd7e7",
  },
  chatDecisionOptionTitleActiveMuted: {
    color: "#d8f2ff",
  },
  chatDecisionOptionText: {
    color: "#a89dbf",
    fontSize: 13,
    lineHeight: 18,
  },
  chatDecisionOptionMark: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 247, 251, 0.88)",
  },
  chatDecisionOptionMarkText: {
    color: "#a01c52",
    fontSize: 13,
    fontWeight: "800",
  },
  chatDecisionOptionMarkMuted: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 249, 255, 0.92)",
  },
  chatDecisionOptionMarkMutedText: {
    color: "#14557d",
    fontSize: 13,
    fontWeight: "800",
  },
  reportReasonList: {
    gap: 10,
    marginTop: 2,
  },
  reportReasonOption: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  reportReasonOptionActive: {
    backgroundColor: "rgba(255, 115, 167, 0.16)",
    borderColor: "rgba(255, 115, 167, 0.34)",
  },
  reportReasonOptionText: {
    color: "#f7f2ff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  reportReasonOptionTextActive: {
    color: "#ffd6e5",
  },
  reportDetailsInput: {
    minHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#120f18",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#f4fbff",
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  reportModalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  reportModalActionColumn: {
    gap: 10,
    marginTop: 2,
  },
  reportModalCancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  reportModalCancelButtonText: {
    color: "#f7f4ff",
    fontSize: 14,
    fontWeight: "700",
  },
  reportModalSubmitButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#7c223f",
  },
  reportModalSubmitButtonDisabled: {
    backgroundColor: "#3a3143",
  },
  reportModalSubmitButtonText: {
    color: "#fff7fb",
    fontSize: 14,
    fontWeight: "700",
  },
  reportModalBlockButton: {
    gap: 3,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: "rgba(255, 115, 167, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 115, 167, 0.22)",
  },
  reportModalBlockButtonDisabled: {
    opacity: 0.55,
  },
  reportModalBlockButtonText: {
    color: "#ffd9e8",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  reportModalBlockButtonMeta: {
    color: "#cba6b9",
    fontSize: 12,
    lineHeight: 17,
  },
  chatBubbleRow: {
    width: "100%",
  },
  chatBubbleRowLeft: {
    alignItems: "flex-start",
  },
  chatBubbleRowRight: {
    alignItems: "flex-end",
  },
  chatBubbleStack: {
    gap: 4,
    maxWidth: "84%",
  },
  chatBubbleStackLeft: {
    alignItems: "flex-start",
  },
  chatBubbleStackRight: {
    alignItems: "flex-end",
  },
  chatBubble: {
    maxWidth: "84%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 20,
  },
  chatBubbleImageWrap: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: "hidden",
    backgroundColor: "#120f18",
  },
  chatBubbleSending: {
    borderWidth: 1,
    borderColor: "rgba(134, 227, 255, 0.34)",
  },
  chatBubbleEmojiOnly: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  chatBubbleLeft: {
    borderTopLeftRadius: 8,
    backgroundColor: "#1c1723",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chatBubbleRight: {
    borderTopRightRadius: 8,
    backgroundColor: "#144f7f",
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatBubbleTextLeft: {
    color: "#ece5ff",
  },
  chatBubbleTextRight: {
    color: "#f4fbff",
  },
  chatBubbleMeta: {
    fontSize: 11,
    lineHeight: 13,
    color: "#8d84a5",
  },
  chatBubbleMetaRow: {
    minHeight: 14,
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chatBubbleMetaRowLeft: {
    justifyContent: "flex-start",
  },
  chatBubbleMetaRowRight: {
    justifyContent: "flex-end",
  },
  chatBubbleMetaLeft: {
    textAlign: "left",
  },
  chatBubbleMetaRight: {
    textAlign: "right",
  },
  chatBubbleMetaSending: {
    color: "#b4abcd",
  },
  chatBubbleSendingDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#86e3ff",
  },
  chatBubbleImage: {
    width: 184,
    height: 232,
    backgroundColor: "#17121d",
  },
  chatBubbleEmojiText: {
    fontSize: 34,
    lineHeight: 42,
  },
  chatEmptyStateCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 320,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  chatEmptyStateTitle: {
    color: "#fff7ff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  chatEmptyStateText: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  chatComposerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#120f18",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  chatComposerBarFullScreen: {
    paddingBottom: 16,
  },
  chatComposerLockedBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#120f18",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  chatComposerLockedText: {
    color: "#bfb3d5",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  chatComposerStatusCard: {
    marginHorizontal: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "rgba(255, 116, 165, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 116, 165, 0.22)",
  },
  chatComposerStatusText: {
    color: "#ffd9e8",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  chatComposerAccessoryButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1b1621",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  chatComposerAccessoryButtonDisabled: {
    opacity: 0.46,
  },
  chatComposerAccessoryButtonText: {
    color: "#f4fbff",
    fontSize: 13,
    lineHeight: 13,
    fontWeight: "700",
    marginTop: 0,
  },
  chatComposerField: {
    flex: 1,
    minHeight: 42,
    borderRadius: 22,
    paddingHorizontal: 12,
    backgroundColor: "#1b1621",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  chatComposerInput: {
    color: "#f4fbff",
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 10,
    minHeight: 42,
    maxHeight: 96,
  },
  chatComposerSendButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c42f69",
  },
  chatComposerSendButtonDisabled: {
    backgroundColor: "#3a3143",
  },
  chatComposerSendButtonText: {
    color: "#fff7fb",
    fontSize: 17,
    lineHeight: 17,
    fontWeight: "500",
    marginTop: 0,
  },
  chatListCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  chatDecisionInlineCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  chatDecisionInlineHeader: {
    gap: 4,
  },
  chatDecisionInlineEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  chatDecisionInlineTitle: {
    color: "#fff7ff",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  chatDecisionInlineRow: {
    gap: 10,
  },
  chatDecisionInlineOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chatDecisionInlineOptionPressed: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  chatDecisionInlineOptionActive: {
    backgroundColor: "rgba(255, 115, 167, 0.24)",
    borderColor: "rgba(255, 115, 167, 0.46)",
    shadowColor: "#ff73a7",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  chatDecisionInlineOptionActivePressed: {
    backgroundColor: "rgba(255, 115, 167, 0.32)",
  },
  chatDecisionInlineOptionMuted: {
    backgroundColor: "rgba(154, 223, 255, 0.18)",
    borderColor: "rgba(154, 223, 255, 0.34)",
    shadowColor: "#9adfff",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  chatDecisionInlineOptionMutedPressed: {
    backgroundColor: "rgba(154, 223, 255, 0.26)",
  },
  chatDecisionInlineIcon: {
    width: 24,
    color: "#f7e8f0",
    fontSize: 18,
    lineHeight: 18,
    textAlign: "center",
  },
  chatDecisionInlineCopy: {
    flex: 1,
    gap: 3,
  },
  chatDecisionInlineOptionTitle: {
    color: "#fff7ff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  chatDecisionInlineOptionTitleActive: {
    color: "#ffd7e7",
  },
  chatDecisionInlineOptionTitleMuted: {
    color: "#d8f2ff",
  },
  chatDecisionInlineOptionText: {
    color: "#a89dbf",
    fontSize: 13,
    lineHeight: 18,
  },
  chatDecisionInlineNotice: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(154, 223, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(154, 223, 255, 0.16)",
  },
  chatDecisionInlineNoticeText: {
    color: "#d8f2ff",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  chatDecisionInlineMark: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 247, 251, 0.88)",
  },
  chatDecisionInlineMarkText: {
    color: "#a01c52",
    fontSize: 13,
    fontWeight: "800",
  },
  chatDecisionInlineMarkMuted: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 249, 255, 0.92)",
  },
  chatDecisionInlineMarkMutedText: {
    color: "#14557d",
    fontSize: 13,
    fontWeight: "800",
  },
  chatListAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  chatListAvatarImage: {
    width: "100%",
    height: "100%",
  },
  chatListAvatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chatListAvatarFallbackText: {
    color: "#eaf8ff",
    fontSize: 18,
    fontWeight: "800",
  },
  chatListUnreadBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff6f96",
    borderWidth: 2,
    borderColor: "#191320",
  },
  chatListUnreadBadgeText: {
    color: "#fff7fb",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  chatListBody: {
    flex: 1,
    gap: 4,
  },
  chatListTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  chatListName: {
    color: "#fff7ff",
    fontSize: 16,
    fontWeight: "700",
  },
  chatListTime: {
    color: "#8f87b6",
    fontSize: 12,
    fontWeight: "600",
  },
  chatListDeadlinePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 182, 95, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 182, 95, 0.26)",
  },
  chatListDeadlinePillEnded: {
    backgroundColor: "rgba(255, 123, 157, 0.14)",
    borderColor: "rgba(255, 123, 157, 0.26)",
  },
  chatListDeadlineText: {
    color: "#ffd7a7",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 12,
  },
  chatListDeadlineTextEnded: {
    color: "#ffc0d0",
  },
  chatListPreview: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 20,
  },
  chatListHint: {
    color: "#8f87b6",
    fontSize: 12,
    lineHeight: 17,
  },
  profileFactList: {
    gap: 12,
  },
  profileFactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  profileFactRowEditable: {
    paddingVertical: 2,
  },
  profileFactCopy: {
    flex: 1,
    gap: 4,
  },
  profileFactLabel: {
    color: "#8f87b6",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  profileFactValue: {
    color: "#f7f4ff",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  profileFactActionText: {
    color: "#9adfff",
    fontSize: 12,
    fontWeight: "800",
  },
  overviewListBadge: {
    color: "#10243a",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#98dfff",
    overflow: "hidden",
  },
  overviewListDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  overviewRuleCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.10)",
    gap: 8,
  },
  overviewRuleTitle: {
    color: "#fff7ff",
    fontSize: 16,
    fontWeight: "700",
  },
  overviewRuleText: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 20,
  },
  matchReasonList: {
    gap: 12,
    marginTop: 14,
  },
  matchReasonItem: {
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  matchReasonLabel: {
    color: "#f7f4ff",
    fontSize: 14,
    fontWeight: "700",
  },
  matchReasonText: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 20,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  timelineBadge: {
    marginTop: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(229, 93, 135, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(229, 93, 135, 0.28)",
  },
  timelineBadgeActive: {
    backgroundColor: "rgba(152, 223, 255, 0.18)",
    borderColor: "rgba(152, 223, 255, 0.28)",
  },
  timelineBadgeMuted: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  timelineBadgeIcon: {
    color: "#ffdce8",
    fontSize: 16,
    lineHeight: 16,
    fontWeight: "800",
  },
  timelineDot: {
    marginTop: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e55d87",
  },
  timelineCopy: {
    flex: 1,
    gap: 4,
  },
  timelineStepLabel: {
    color: "#ff9cbb",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  timelineStepLabelActive: {
    color: "#9adfff",
  },
  timelineStepLabelMuted: {
    color: "#b8add4",
  },
  timelineTitle: {
    color: "#f7f4ff",
    fontSize: 15,
    fontWeight: "700",
  },
  timelineStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  timelineStatusPillActive: {
    backgroundColor: "rgba(152, 223, 255, 0.14)",
    borderColor: "rgba(152, 223, 255, 0.24)",
  },
  timelineStatusPillDone: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  timelineStatusText: {
    color: "#f7f4ff",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  timelineText: {
    color: "#aea2cf",
    fontSize: 13,
    lineHeight: 18,
  },
  overviewProfileName: {
    color: "#fff7ff",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  overviewProfileMeta: {
    color: "#b6abd5",
    fontSize: 14,
    lineHeight: 20,
  },
  overviewExitCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
  },
  overviewExitCardText: {
    color: "#e7f6ff",
    fontSize: 14,
    fontWeight: "700",
  },
  accountActionsCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(17, 12, 24, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
    gap: 14,
  },
  accountActionsText: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 20,
  },
  accountActionsList: {
    gap: 10,
  },
  accountActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  accountActionButtonWarning: {
    borderColor: "rgba(255, 196, 120, 0.18)",
  },
  accountActionButtonDanger: {
    borderColor: "rgba(255, 106, 138, 0.24)",
    backgroundColor: "rgba(255, 106, 138, 0.06)",
  },
  accountActionCopy: {
    flex: 1,
    gap: 3,
  },
  accountActionTitle: {
    color: "#f7f4ff",
    fontSize: 15,
    fontWeight: "700",
  },
  accountActionTitleDanger: {
    color: "#ffd5df",
  },
  accountActionMeta: {
    color: "#a89dbf",
    fontSize: 13,
    lineHeight: 18,
  },
  accountActionArrow: {
    color: "#d8f2ff",
    fontSize: 24,
    lineHeight: 24,
  },
  accountActionArrowDanger: {
    color: "#ffd5df",
  },
  accountActionMessage: {
    color: "#ffb8cb",
    fontSize: 13,
    lineHeight: 18,
  },
  overviewTabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(14, 10, 18, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
  },
  overviewTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 999,
  },
  overviewTabBadge: {
    position: "absolute",
    top: 6,
    right: "24%",
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#ff5a8e",
    borderWidth: 1,
    borderColor: "#150f1a",
  },
  overviewTabIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  overviewTabIndicatorActive: {
    width: 22,
    backgroundColor: "#98dfff",
  },
  overviewTabText: {
    color: "#9187b8",
    fontSize: 11,
    fontWeight: "700",
  },
  overviewTabTextActive: {
    color: "#eff9ff",
  },
  accountSwitchOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    backgroundColor: "rgba(6, 5, 10, 0.68)",
  },
  accountSwitchCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#17131f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 14,
  },
  accountSwitchEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  accountSwitchTitle: {
    color: "#fff7ff",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  accountSwitchText: {
    color: "#b8add4",
    fontSize: 14,
    lineHeight: 21,
  },
  accountSwitchList: {
    gap: 10,
  },
  accountSwitchMatchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 15,
    borderRadius: 22,
    backgroundColor: "rgba(255, 66, 124, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 116, 165, 0.22)",
  },
  accountSwitchMatchCardPressed: {
    backgroundColor: "rgba(255, 66, 124, 0.18)",
  },
  accountSwitchMatchCardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 200, 220, 0.20)",
  },
  accountSwitchMatchCardAvatarText: {
    color: "#ffe4f0",
    fontSize: 18,
    fontWeight: "800",
  },
  accountSwitchMatchCardCopy: {
    flex: 1,
    gap: 3,
  },
  accountSwitchMatchCardEyebrow: {
    color: "#ffd8e7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  accountSwitchMatchCardTitle: {
    color: "#fff7ff",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  accountSwitchMatchCardText: {
    color: "#f0d5e0",
    fontSize: 13,
    lineHeight: 18,
  },
  accountSwitchMatchCardArrow: {
    color: "#ffe6ef",
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "700",
  },
  accountSwitchOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  accountSwitchOptionPressed: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(134, 227, 255, 0.20)",
  },
  accountSwitchOptionAvatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 184, 211, 0.18)",
  },
  accountSwitchOptionAvatarText: {
    color: "#ffe0ec",
    fontSize: 16,
    fontWeight: "800",
  },
  accountSwitchOptionCopy: {
    flex: 1,
    gap: 2,
  },
  accountSwitchOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  accountSwitchOptionName: {
    color: "#fff7ff",
    fontSize: 15,
    fontWeight: "700",
  },
  accountSwitchMatchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(154, 223, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(154, 223, 255, 0.26)",
  },
  accountSwitchMatchBadgeText: {
    color: "#bfefff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  accountSwitchOptionMeta: {
    color: "#b8add4",
    fontSize: 13,
    lineHeight: 18,
  },
  accountSwitchEmpty: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  accountSwitchEmptyText: {
    color: "#b8add4",
    fontSize: 13,
    lineHeight: 20,
  },
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(7, 6, 10, 0.96)",
  },
  photoViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  photoViewerChrome: {
    position: "absolute",
    top: 72,
    right: 18,
    zIndex: 2,
    alignItems: "flex-end",
  },
  photoViewerCloseButton: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  photoViewerCloseButtonText: {
    color: "#f3f7ff",
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
  },
  photoViewerFrame: {
    flex: 1,
    paddingHorizontal: 18,
  },
  photoViewerPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerImage: {
    width: "100%",
    height: "96%",
  },
  photoViewerFooter: {
    position: "absolute",
    right: 0,
    bottom: 28,
    left: 0,
    alignItems: "center",
    gap: 8,
  },
  photoViewerDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoViewerDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  photoViewerDotActive: {
    width: 20,
    backgroundColor: "#f4f8ff",
  },
  accountModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(8, 7, 12, 0.66)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  accountModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#17121d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  accountModalEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  accountModalTitle: {
    color: "#fff7ff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  accountModalText: {
    color: "#b5abcc",
    fontSize: 14,
    lineHeight: 21,
  },
  accountModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  accountModalCancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  accountModalCancelButtonText: {
    color: "#f7f4ff",
    fontSize: 14,
    fontWeight: "700",
  },
  accountModalConfirmButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#24314a",
  },
  accountModalConfirmButtonWarning: {
    backgroundColor: "#5b3d1c",
  },
  accountModalConfirmButtonDanger: {
    backgroundColor: "#7c223f",
  },
  accountModalConfirmButtonDisabled: {
    opacity: 0.65,
  },
  accountModalConfirmButtonText: {
    color: "#f8fbff",
    fontSize: 14,
    fontWeight: "700",
  },
  formShell: {
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topTag: {
    color: "#b5aef8",
    fontSize: 13,
    fontWeight: "700",
  },
  topCount: {
    color: "#a8a1cd",
    fontSize: 13,
    fontWeight: "600",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#33c8ff",
  },
  card: {
    padding: 22,
    borderRadius: 30,
    backgroundColor: "rgba(18, 11, 34, 0.90)",
    borderWidth: 1,
    borderColor: "rgba(144, 128, 255, 0.16)",
    gap: 18,
  },
  matchCard: {
    minHeight: 320,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#140d1f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  matchCardCompact: {
    minHeight: 214,
  },
  matchImage: {
    width: "100%",
    height: 320,
  },
  matchImageCompact: {
    height: 214,
  },
  matchImageShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "rgba(8, 8, 16, 0.22)",
  },
  matchTopRow: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  matchEyebrowPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 245, 250, 0.92)",
  },
  matchEyebrow: {
    color: "#6a2050",
    fontSize: 12,
    fontWeight: "700",
  },
  matchTimePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(21, 25, 52, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.32)",
  },
  matchTime: {
    color: "#dcf8ff",
    fontSize: 12,
    fontWeight: "700",
  },
  matchBottomBlock: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    gap: 6,
  },
  matchName: {
    color: "#fff8ff",
    fontSize: 28,
    fontWeight: "700",
  },
  matchMeta: {
    color: "#cfc7eb",
    fontSize: 14,
    fontWeight: "600",
  },
  matchTagline: {
    color: "#f7f3ff",
    fontSize: 14,
    lineHeight: 20,
  },
  matchInterestRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  matchInterestPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(8, 10, 18, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  matchInterestText: {
    color: "#f6f2ff",
    fontSize: 12,
    fontWeight: "700",
  },
  authStageCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(17, 12, 24, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.14)",
    gap: 10,
  },
  authStageEyebrow: {
    color: "#9adfff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  authStageTitle: {
    color: "#fff7ff",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  authStageText: {
    color: "#c0b2d8",
    fontSize: 14,
    lineHeight: 20,
  },
  screenTitle: {
    color: "#fff7ff",
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "700",
  },
  screenHint: {
    marginTop: -8,
    color: "#a99fcf",
    fontSize: 14,
  },
  fieldWrap: {
    gap: 12,
  },
  birthdayTrigger: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.18)",
    gap: 6,
  },
  birthdayTriggerLabel: {
    color: "#a99fcf",
    fontSize: 13,
    fontWeight: "700",
  },
  birthdayTriggerValue: {
    color: "#fff7ff",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  birthdayTriggerHint: {
    color: "#8f87b6",
    fontSize: 14,
  },
  birthdayModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(9, 8, 14, 0.58)",
    justifyContent: "flex-end",
  },
  birthdayModalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#f7f4ff",
    paddingTop: 14,
    paddingHorizontal: 12,
  },
  birthdayModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  birthdayModalTitle: {
    color: "#171d2b",
    fontSize: 18,
    fontWeight: "700",
  },
  birthdayModalDoneButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#171d2b",
  },
  birthdayModalDoneButtonText: {
    color: "#f7fbff",
    fontSize: 14,
    fontWeight: "700",
  },
  birthdayModalPicker: {
    backgroundColor: "#f7f4ff",
    alignSelf: "stretch",
  },
  photoGrid: {
    gap: 14,
  },
  photoSlotColumn: {
    gap: 8,
  },
  photoSlot: {
    minHeight: 190,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.18)",
  },
  photoSlotImage: {
    width: "100%",
    height: 190,
  },
  photoSlotPlaceholder: {
    minHeight: 190,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  photoSlotPlus: {
    color: "#f7f4ff",
    fontSize: 38,
    lineHeight: 38,
    fontWeight: "300",
  },
  photoSlotText: {
    color: "#bcb2da",
    fontSize: 15,
    fontWeight: "700",
  },
  photoSlotAction: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
  },
  photoSlotActionText: {
    color: "#d6f3ff",
    fontSize: 13,
    fontWeight: "700",
  },
  videoSlotCard: {
    gap: 10,
    marginTop: 8,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.18)",
  },
  videoSlotHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  videoSlotTitle: {
    color: "#fff7ff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  videoSlotMeta: {
    color: "#9fe6ff",
    fontSize: 13,
    fontWeight: "700",
  },
  videoSlot: {
    minHeight: 112,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "rgba(14, 16, 24, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
    justifyContent: "center",
  },
  videoSlotEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  videoSlotFilled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  videoSlotPreviewWrap: {
    gap: 10,
  },
  videoSlotPlayIcon: {
    color: "#fff7ff",
    fontSize: 20,
    fontWeight: "800",
    width: 24,
    textAlign: "center",
  },
  videoSlotCopy: {
    flex: 1,
    gap: 4,
  },
  videoSlotFilledTitle: {
    color: "#fff7ff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  videoSlotFilledText: {
    color: "#9d97ba",
    fontSize: 14,
    lineHeight: 20,
  },
  videoSlotActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  videoSlotSecondaryAction: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.18)",
  },
  videoSlotSecondaryActionText: {
    color: "#b8afd7",
    fontSize: 13,
    fontWeight: "700",
  },
  inlineVideoPreview: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#09080e",
  },
  preferenceSection: {
    gap: 10,
  },
  preferenceSectionTitle: {
    color: "#fff7ff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  preferenceSectionHint: {
    color: "#8f87b6",
    fontSize: 14,
    lineHeight: 20,
    marginTop: -2,
  },
  rangeInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  rangeInputColumn: {
    flex: 1,
    gap: 8,
  },
  rangeInputLabel: {
    color: "#a99fcf",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  phonePrefixChip: {
    minWidth: 76,
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  phonePrefixText: {
    color: "#edf7ff",
    fontSize: 18,
    fontWeight: "700",
  },
  input: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.18)",
    paddingHorizontal: 18,
    paddingVertical: 15,
    color: "#fff7ff",
    fontSize: 18,
  },
  phoneLocalInput: {
    flex: 1,
  },
  textarea: {
    minHeight: 130,
    textAlignVertical: "top",
  },
  inlineHint: {
    color: "#8f87b6",
    fontSize: 14,
  },
  citySuggestionsCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.18)",
    overflow: "hidden",
  },
  citySuggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  citySuggestionTitle: {
    color: "#fff7ff",
    fontSize: 15,
    fontWeight: "700",
  },
  citySuggestionMeta: {
    color: "#a99fcf",
    fontSize: 13,
    lineHeight: 18,
  },
  citySuggestionEmpty: {
    color: "#bdb1d8",
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  devCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(47, 210, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(47, 210, 255, 0.22)",
    alignSelf: "flex-start",
  },
  devLabel: {
    color: "#6fdcff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  devCode: {
    marginTop: 4,
    color: "#dff8ff",
    fontSize: 22,
    fontWeight: "700",
  },
  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statementOptionList: {
    gap: 12,
  },
  statementOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    minHeight: 74,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.24)",
  },
  statementOptionCardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(154, 223, 255, 0.3)",
  },
  statementOptionCardActive: {
    backgroundColor: "#86e3ff",
    borderColor: "#86e3ff",
    shadowColor: "#2fd2ff",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  statementOptionCardActivePressed: {
    backgroundColor: "#6fdcff",
    borderColor: "#6fdcff",
  },
  statementOptionText: {
    flex: 1,
    color: "#f4efff",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  statementOptionTextActive: {
    color: "#0d294d",
  },
  statementOptionCheck: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13, 41, 77, 0.14)",
  },
  statementOptionCheckText: {
    color: "#0d294d",
    fontSize: 13,
    fontWeight: "800",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(154, 144, 230, 0.26)",
  },
  chipPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.11)",
    borderColor: "rgba(154, 223, 255, 0.30)",
  },
  chipActive: {
    backgroundColor: "#86e3ff",
    borderColor: "#86e3ff",
    shadowColor: "#2fd2ff",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  chipActivePressed: {
    backgroundColor: "#6fdcff",
    borderColor: "#6fdcff",
  },
  chipText: {
    flexShrink: 1,
    color: "#efeaff",
    fontSize: 14,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#0d294d",
  },
  chipCheck: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13, 41, 77, 0.14)",
  },
  chipCheckText: {
    color: "#0d294d",
    fontSize: 12,
    fontWeight: "800",
  },
  switchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 64, 110, 0.20)",
  },
  switchLabelWrap: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    color: "#fff7ff",
    fontSize: 16,
    fontWeight: "700",
  },
  switchHint: {
    color: "#a99fcf",
    fontSize: 14,
  },
  errorCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255, 72, 108, 0.12)",
  },
  errorText: {
    color: "#ff7d9e",
    fontSize: 14,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionStack: {
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: "#c42f69",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    shadowColor: "#ff5b9d",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 7,
  },
  primaryButtonSolo: {
    width: "100%",
  },
  primaryButtonText: {
    color: "#fff7fb",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  secondaryButton: {
    minWidth: 108,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  secondaryButtonText: {
    color: "#c0b8ea",
    fontSize: 15,
    fontWeight: "600",
  },
  devShortcutButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(120, 214, 255, 0.12)",
  },
  devShortcutText: {
    color: "#cfeeff",
    fontSize: 13,
    fontWeight: "700",
  },
  doneCard: {
    paddingVertical: 14,
    gap: 10,
  },
  doneTitle: {
    color: "#fff7ff",
    fontSize: 24,
    fontWeight: "700",
  },
  doneText: {
    color: "#b7afd7",
    fontSize: 15,
    lineHeight: 22,
  },
  doneFactsWrap: {
    gap: 12,
  },
  doneFactRow: {
    gap: 4,
  },
  doneFactLabel: {
    color: "#8f87b6",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  doneFactValue: {
    color: "#f4efff",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  donePreferenceGroup: {
    gap: 10,
  },
  donePreferenceTitle: {
    color: "#f4efff",
    fontSize: 15,
    fontWeight: "700",
  },
  doneStatusCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(144, 128, 255, 0.16)",
    gap: 4,
  },
  doneStatusText: {
    color: "#fff7ff",
    fontSize: 15,
    fontWeight: "600",
  },
  doneStatusSubtext: {
    color: "#9b93be",
    fontSize: 14,
    lineHeight: 20,
  },
  legalConsentCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(196, 47, 105, 0.2)",
    gap: 14,
  },
  legalConsentTitle: {
    color: "#fff7ff",
    fontSize: 16,
    fontWeight: "700",
  },
  legalConsentText: {
    color: "#b7afd7",
    fontSize: 14,
    lineHeight: 21,
  },
  legalLinksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legalLinkPill: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  legalLinkPillText: {
    color: "#f1eafe",
    fontSize: 13,
    fontWeight: "700",
  },
  legalConsentToggle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  legalConsentToggleActive: {
    backgroundColor: "rgba(196, 47, 105, 0.12)",
    borderColor: "rgba(255, 110, 162, 0.34)",
  },
  legalConsentCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
  },
  legalConsentCheckboxActive: {
    backgroundColor: "#c42f69",
    borderColor: "#ff9cc1",
  },
  legalConsentCheckmark: {
    color: "#fff7fb",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 15,
  },
  legalConsentLabel: {
    flex: 1,
    color: "#ece4ff",
    fontSize: 14,
    lineHeight: 21,
  },
  chatPreviewCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(144, 128, 255, 0.16)",
    gap: 10,
  },
  chatPreviewText: {
    color: "#ddd6f6",
    fontSize: 14,
    lineHeight: 20,
  },
  decisionPreviewRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 10,
  },
  decisionGhostButton: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  decisionGhostText: {
    color: "#cbc3e7",
    fontSize: 14,
    fontWeight: "700",
  },
  decisionSolidButton: {
    flex: 1.2,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#c42f69",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  decisionSolidButtonDisabled: {
    backgroundColor: "rgba(196, 47, 105, 0.36)",
    borderColor: "rgba(255,255,255,0.08)",
    opacity: 0.7,
  },
  decisionSolidText: {
    color: "#fff7fb",
    fontSize: 14,
    fontWeight: "700",
  },
  doneButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#7d79ec",
  },
  doneButtonText: {
    color: "#fff7fb",
    fontSize: 15,
    fontWeight: "700",
  },
});
