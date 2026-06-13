import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { VideoView, useVideoPlayer } from "expo-video";
import {
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
  createRemoteReport,
  createRemoteProfile,
  deleteRemoteAccount,
  fetchRemoteAccountState,
  fetchRemoteJourney,
  fetchRemoteProfile,
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
  demoRunthrough,
  demoSessionPhotoUris,
  demoSessionProfile,
  type DemoChatMessage,
  type DemoProfile,
} from "../lib/mock-data";
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
  cancelScheduledLocalNotification,
  scheduleMatchReleaseNotification,
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

const PHASE_THREE_THRESHOLD = 50;
const PHASE_TWO_ROUNDS_PER_SESSION = 3;
const MATCH_RELEASE_HOUR = 9;
const MATCH_DECISION_HOUR = 21;
const TEST_PHASE_TIMELINE_ENABLED = false;
const TEST_PHASE_TIMELINE = {
  phaseOneStart: { hour: 12, minute: 30 },
  phaseTwoStart: { hour: 12, minute: 35 },
  phaseThreeStart: { hour: 12, minute: 40 },
  phaseFourStart: { hour: 12, minute: 45 },
  phaseFiveStart: { hour: 12, minute: 50 },
} as const;
const TEST_PHASE_JUMP_OPTIONS = [
  { phase: 1, label: "Phase 1" },
  { phase: 2, label: "Phase 2" },
  { phase: 3, label: "Phase 3" },
  { phase: 4, label: "Phase 4" },
  { phase: 5, label: "Phase 5" },
] as const;
const LEGAL_URLS = {
  impressum: "https://choice-dating.app/impressum",
  datenschutz: "https://choice-dating.app/datenschutz",
  rechtliches: "https://choice-dating.app/rechtliches",
  agb: "https://choice-dating.app/agb",
} as const;

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
const demoMilaUserId = "demo_mila_user";
const demoMilaPhoneNumber = "+49 152 00000000";
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
  { value: "anstoessige-bilder", label: "Anstößige Bilder" },
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

function setTimeOfDay(date: Date, hour: number, minute: number) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function buildPhaseSchedule(now: Date) {
  if (!TEST_PHASE_TIMELINE_ENABLED) {
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

  const scheduleDate = new Date(now);
  scheduleDate.setHours(0, 0, 0, 0);

  let release = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseOneStart.hour, TEST_PHASE_TIMELINE.phaseOneStart.minute);
  let phaseTwoStart = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseTwoStart.hour, TEST_PHASE_TIMELINE.phaseTwoStart.minute);
  let phaseThreeStart = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseThreeStart.hour, TEST_PHASE_TIMELINE.phaseThreeStart.minute);
  let phaseFourStart = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseFourStart.hour, TEST_PHASE_TIMELINE.phaseFourStart.minute);
  let phaseFiveStart = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseFiveStart.hour, TEST_PHASE_TIMELINE.phaseFiveStart.minute);

  if (now >= phaseFiveStart) {
    scheduleDate.setDate(scheduleDate.getDate() + 1);
    release = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseOneStart.hour, TEST_PHASE_TIMELINE.phaseOneStart.minute);
    phaseTwoStart = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseTwoStart.hour, TEST_PHASE_TIMELINE.phaseTwoStart.minute);
    phaseThreeStart = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseThreeStart.hour, TEST_PHASE_TIMELINE.phaseThreeStart.minute);
    phaseFourStart = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseFourStart.hour, TEST_PHASE_TIMELINE.phaseFourStart.minute);
    phaseFiveStart = setTimeOfDay(scheduleDate, TEST_PHASE_TIMELINE.phaseFiveStart.hour, TEST_PHASE_TIMELINE.phaseFiveStart.minute);
  }

  return {
    release,
    decisionDeadline: phaseTwoStart,
    phaseTwoStart,
    phaseThreeStart,
    phaseFourStart,
    phaseFiveStart,
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

  if (!TEST_PHASE_TIMELINE_ENABLED && now >= release) {
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

function buildDemoMilaSession(): Omit<PersistedSession, "savedAt"> {
  const milaProfile = demoProfiles.find((entry) => entry.id === "mila") ?? demoProfiles[0];

  return {
    userId: demoMilaUserId,
    phoneNumber: demoMilaPhoneNumber,
    profile: buildProfileFromDemoProfile(milaProfile),
    photoUris: [...milaProfile.photoUris],
    introVideoUri: milaProfile.introVideoUrl ?? null,
    introVideoDurationMs: null,
  };
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
    hint: "Wähl 3 bis 5 Dinge, über die du gern sprichst",
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

type SharedChatAuthor = "primary" | "mila";

type SharedChatTextMessage = {
  id: string;
  author: SharedChatAuthor;
  kind: "text";
  text: string;
};

type SharedChatImageMessage = {
  id: string;
  author: SharedChatAuthor;
  kind: "image";
  imageUri: string;
};

type SharedChatMessage =
  | SharedChatTextMessage
  | SharedChatImageMessage;

type SharedChatMessageInput =
  | { kind: "text"; text: string }
  | { kind: "image"; imageUri: string };

type ChatRenderMessage =
  | { id: string; side: "left" | "right"; kind: "text"; text: string }
  | { id: string; side: "left" | "right"; kind: "image"; imageUri: string };

function buildSharedDemoChatMessages(messages: readonly DemoChatMessage[]): SharedChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    author: message.side === "right" ? "primary" : "mila",
    kind: "text",
    text: message.text,
  }));
}

function mapSharedChatMessagesForViewer(
  messages: readonly SharedChatMessage[],
  isMilaSession: boolean,
): ChatRenderMessage[] {
  return messages.map((message) => {
    const side = message.author === (isMilaSession ? "mila" : "primary") ? "right" : "left";

    if (message.kind === "image") {
      return {
        id: message.id,
        side,
        kind: "image",
        imageUri: message.imageUri,
      };
    }

    return {
      id: message.id,
      side,
      kind: "text",
      text: message.text,
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

    const candidate = entry as Partial<SharedChatMessage> & { kind?: unknown; author?: unknown; id?: unknown };
    const author = candidate.author === "mila" ? "mila" : candidate.author === "primary" ? "primary" : null;
    const id = typeof candidate.id === "string" ? candidate.id : null;

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
      });
      return messages;
    }

    if (candidate.kind === "text" && typeof candidate.text === "string") {
      messages.push({
        id,
        author,
        kind: "text" as const,
        text: candidate.text,
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

    const author: SharedChatAuthor = message.senderUserId === viewerUserId ? "primary" : "mila";

    if (message.kind === "image" && message.imageUri) {
      items.push({
        id: message.id,
        author,
        kind: "image",
        imageUri: message.imageUri,
      });
      return items;
    }

    if (message.kind === "text" && message.text) {
      items.push({
        id: message.id,
        author,
        kind: "text",
        text: message.text,
      });
    }

    return items;
  }, []);
}

function mapRemoteJourneyPartnerToDemoProfile(partner: RemoteJourneyState["partner"]): DemoProfile | null {
  if (!partner) {
    return null;
  }

  const primaryPhoto = partner.photoUrls.find((entry) => entry?.trim()) ?? partner.avatarUrl ?? demoSessionPhotoUris[0];
  const tagline =
    partner.greenFlags.slice(0, 2).join(" • ")
    || partner.interests.slice(0, 2).join(" • ")
    || "Choice Match";

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
        <Text style={styles.unlockRingValue}>{unlocked ? unlockedValue : `${current}/${total}`}</Text>
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
  composerHidden?: boolean;
  composerLockedText?: string | null;
  fullScreen?: boolean;
  onBack?: () => void;
  onOpenProfile?: () => void;
  onReportPress?: () => void;
  headerActionState?: "idle" | "keep";
  onHeaderActionPress?: () => void;
  onComposerChangeText: (value: string) => void;
  onPickImage: () => void;
  onSend: () => void;
  topInset?: number;
  bottomInset?: number;
  threadSupplement?: ReactNode;
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
  composerHidden = false,
  composerLockedText = null,
  fullScreen = false,
  onBack,
  onOpenProfile,
  onReportPress,
  headerActionState = "idle",
  onHeaderActionPress,
  onComposerChangeText,
  onPickImage,
  onSend,
  topInset = 0,
  bottomInset = 0,
  threadSupplement,
}: ChatSurfaceProps) {
  const threadRef = useRef<ScrollView | null>(null);
  const [threadViewportHeight, setThreadViewportHeight] = useState(0);
  const [threadContentHeight, setThreadContentHeight] = useState(0);
  const canSend = composerEditable && composerValue.trim().length > 0;
  const composerBottomPadding = fullScreen ? 4 : 10;
  const canScrollThread = threadContentHeight > threadViewportHeight + 1;
  const dockedThreadSupplement = threadSupplement && fullScreen
    ? <View style={[styles.chatThreadSupplement, styles.chatThreadSupplementDock]}>{threadSupplement}</View>
    : null;
  const inlineThreadSupplement = threadSupplement && !fullScreen
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
                      <View
                        style={[
                          styles.chatBubble,
                          right ? styles.chatBubbleRight : styles.chatBubbleLeft,
                          message.kind === "image" && styles.chatBubbleImageWrap,
                          emojiOnly && styles.chatBubbleEmojiOnly,
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
          <Pressable
            onPress={onPickImage}
            disabled={!composerEditable}
            style={[styles.chatComposerAccessoryButton, !composerEditable && styles.chatComposerAccessoryButtonDisabled]}
          >
            <Text style={styles.chatComposerAccessoryButtonText}>＋</Text>
          </Pressable>
          <View style={styles.chatComposerField}>
            <TextInput
              value={composerValue}
              onChangeText={onComposerChangeText}
              placeholder={composerPlaceholder}
              placeholderTextColor="#867ea9"
              style={styles.chatComposerInput}
              editable={composerEditable}
              multiline
              returnKeyType="send"
              blurOnSubmit={false}
              onFocus={() => threadRef.current?.scrollToEnd({ animated: true })}
              onSubmitEditing={canSend ? onSend : undefined}
            />
          </View>
          <Pressable onPress={onSend} disabled={!canSend} style={[styles.chatComposerSendButton, !canSend && styles.chatComposerSendButtonDisabled]}>
            <Text style={styles.chatComposerSendButtonText}>↑</Text>
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
  onEditProfileField: (screenId: EditableProfileScreenId) => void;
  onPauseAccount: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  onDeleteAccount: () => Promise<void> | void;
  accountActionPending: boolean;
  accountActionMessage?: string | null;
  displayName: string;
  currentUserId: string | null;
  matchedSession: Omit<PersistedSession, "savedAt"> | PersistedSession | null;
  profile: RegistrationProfile;
  photoUris: string[];
  introVideoUri: string | null;
  introVideoDurationMs: number | null;
};

function OverviewScreen({
  currentTab,
  onSelectTab,
  onOpenAccountSwitcher,
  onEditProfileField,
  onPauseAccount,
  onSignOut,
  onDeleteAccount,
  accountActionPending,
  accountActionMessage,
  displayName,
  currentUserId,
  matchedSession,
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
  const [phaseTwoStarterUserId, setPhaseTwoStarterUserId] = useState<string | null>(null);
  const [phaseTwoPartnerUserId, setPhaseTwoPartnerUserId] = useState<string | null>(null);
  const [phaseTwoStarterName, setPhaseTwoStarterName] = useState("");
  const [phaseTwoPartnerName, setPhaseTwoPartnerName] = useState("");
  const [phaseOneDecisions, setPhaseOneDecisions] = useState<Record<string, "continue" | "new-match">>({});
  const [phaseThreeDecisions, setPhaseThreeDecisions] = useState<Record<string, "stay" | "new-match">>({});
  const [chatDraft, setChatDraft] = useState("");
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
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const photoViewerRef = useRef<ScrollView | null>(null);
  const { width: viewportWidth } = useWindowDimensions();
  const photoViewerPageWidth = Math.max(viewportWidth - 36, 1);
  const insets = useSafeAreaInsets();
  const isMilaSession = currentUserId === demoMilaUserId;
  const isServerJourneyMode = Boolean(currentUserId && !isMilaSession);
  const journeyOwnerUserId = currentUserId === demoMilaUserId ? matchedSession?.userId ?? null : currentUserId;

  function applyJourneyState(state: PersistedJourneyState) {
    setRemoteJourney(null);
    setJourneyReleaseAt(state.releaseAt);
    setSharedChatMessages(normalizeSharedChatMessages(state.sharedChatMessages));
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

  function applyRemoteJourneyState(state: RemoteJourneyState) {
    setRemoteJourney(state);
    setJourneyReleaseAt(state.releaseAt);
    setSharedChatMessages(currentUserId ? mapRemoteJourneyMessages(state.sharedChatMessages, currentUserId) : []);
    setPhaseOneStarterPenaltyAppliedAt(state.phaseOneStarterPenaltyAppliedAt);
    setPhaseTwoPenaltyAppliedAt(state.phaseTwoPenaltyAppliedAt);
    setPhaseOneDecisions(state.phaseOneDecisions);
    setPhaseThreeDecisions(state.phaseThreeDecisions);
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

  const featuredProfile = useMemo<DemoProfile>(() => {
    const remotePartnerProfile = mapRemoteJourneyPartnerToDemoProfile(remoteJourney?.partner ?? null);

    if (remotePartnerProfile) {
      return remotePartnerProfile;
    }

    if (matchedSession) {
      const primaryPhoto = matchedSession.photoUris.find((entry) => entry?.trim()) ?? demoSessionPhotoUris[0];
      const matchedAge = calculateAgeFromProfile(matchedSession.profile) ?? 27;
      const tagline =
        matchedSession.profile.greenFlags.slice(0, 2).join(" • ") ||
        matchedSession.profile.interests.slice(0, 2).join(" • ") ||
        "Choice Match";

      return {
        id: matchedSession.userId,
        firstName: matchedSession.profile.firstName.trim() || "Choice",
        age: matchedAge,
        city: matchedSession.profile.city.trim() || "Berlin",
        selfDescription: matchedSession.profile.selfDescription,
        tagline,
        imageUri: primaryPhoto,
        photoUris: matchedSession.photoUris.length ? matchedSession.photoUris : [primaryPhoto],
        introVideoUrl: matchedSession.introVideoUri,
        interests: matchedSession.profile.interests,
        pronouns: matchedSession.profile.pronouns,
        identity: matchedSession.profile.identity,
        lookingFor: matchedSession.profile.lookingFor,
        datingIntent: matchedSession.profile.datingIntent,
        ageRangeMin: Number(matchedSession.profile.ageRangeMin || 18),
        ageRangeMax: Number(matchedSession.profile.ageRangeMax || 99),
        greenFlags: matchedSession.profile.greenFlags,
        dealbreakers: matchedSession.profile.dealbreakers,
        time: "Heute 21:00",
      };
    }

    return demoProfiles.find((entry) => entry.id === demoRunthrough.currentMatchProfileId) ?? demoProfiles[0];
  }, [matchedSession, remoteJourney?.partner]);
  const penaltyPoints = accountState?.penaltyPoints ?? 0;
  const maxPenaltyPoints = 3;
  const remainingPenaltyPoints = Math.max(maxPenaltyPoints - penaltyPoints, 0);
  const accountPaused = accountState?.accountPaused ?? false;
  const accountBanned = accountState?.accountBanned ?? false;
  const activePartnerUserId = remoteJourney?.partner?.userId ?? matchedSession?.userId ?? null;
  const hasActiveChat = isServerJourneyMode ? Boolean(currentUserId && remoteJourney?.partner) : Boolean(currentUserId && matchedSession);
  const isBuiltInDemoMatch = !isServerJourneyMode && matchedSession?.userId === demoMilaUserId;
  const includedMatchLimit = 8;
  const paidMatchCredits = accountState?.paidMatchCredits ?? 0;
  const frozenPaidMatchCredits = accountState?.frozenPaidMatchCredits ?? 0;
  const forfeitedPaidMatchCredits = accountState?.forfeitedPaidMatchCredits ?? 0;
  const hasPaidMatchAccess = accountState?.hasPaidMatchAccess ?? false;
  const profileAge = calculateAgeFromProfile(profile);
  const profileSelfDescription = profile.selfDescription ? getOptionLabel(selfDescriptionOptions, profile.selfDescription) : "";
  const profileIdentity = profile.identity ? getOptionLabel(identityOptions, profile.identity) : "";
  const profileIntent = profile.datingIntent ? getOptionLabel(datingIntentOptions, profile.datingIntent) : "";
  const profilePronouns =
    profile.pronouns && profile.pronouns !== "keine-angabe" ? getOptionLabel(pronounOptions, profile.pronouns) : "";
  const profileMetaParts = [profile.city || "Berlin", String(profileAge ?? 27), profilePronouns].filter(Boolean);
  const awardViewerPhotoUri =
    photoUris.find((entry) => entry?.trim())
    ?? demoSessionPhotoUris[0]
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
    "Du verschickst anstößige Bilder und das wird von der anderen Person bestätigt gemeldet.",
  ];
  const phaseOneViewerUserId = currentUserId ?? "choice_primary_demo";
  const phaseOnePartnerUserId =
    activePartnerUserId ?? (phaseOneViewerUserId === demoMilaUserId ? "choice_primary_demo" : demoMilaUserId);
  const phaseOneStarterUserId = remoteJourney?.phaseOneStarterUserId ?? chooseStableStarterUserId(phaseOneViewerUserId, phaseOnePartnerUserId);
  const phaseOneStarterName = phaseOneStarterUserId === phaseOneViewerUserId ? displayName : featuredProfile.firstName;
  const phaseOneViewerStarts = phaseOneStarterUserId === phaseOneViewerUserId;
  const phaseOneChatStarted = sharedChatMessages.length > 0;
  const phaseSchedule = useMemo(
    () => buildPhaseSchedule(journeyReleaseAt ? new Date(journeyReleaseAt) : currentTime),
    [currentTime, journeyReleaseAt],
  );
  const matchReleaseTime = phaseSchedule.release;
  const completedMatchCount = hasActiveChat && currentTime >= matchReleaseTime ? 1 : 0;
  const remainingIncludedMatches = Math.max(includedMatchLimit - completedMatchCount, 0);
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
  const phaseOneBothContinue = phaseOneViewerDecision === "continue" && phaseOnePartnerDecision === "continue";
  const phaseOneAnyDeclined = phaseOneViewerDecision === "new-match" || phaseOnePartnerDecision === "new-match";
  const phaseOneWindowOpen = currentTime >= matchReleaseTime && currentTime < decisionDeadline;
  const phaseOneBeforeRelease = currentTime < matchReleaseTime;
  const phaseOneClosed = currentTime >= decisionDeadline;
  const currentReleaseKey = journeyReleaseAt ?? matchReleaseTime.toISOString();
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
  const renderedChatMessages = useMemo(
    () => (hasActiveChat ? mapSharedChatMessagesForViewer(sharedChatMessages, isMilaSession) : []),
    [hasActiveChat, isMilaSession, sharedChatMessages],
  );
  const latestSharedChatMessage = sharedChatMessages[sharedChatMessages.length - 1];
  const latestSharedChatPreview = getSharedChatMessagePreview(latestSharedChatMessage);
  const chatPreviewText = latestSharedChatPreview
    ?? (hasActiveChat
      ? phaseOneBeforeRelease
        ? "Choice zeigt dir vorher noch nicht, wer dein erstes Match wird."
        : `Choice hat ${phaseOneStarterName} ausgewählt, den Chat zu eröffnen.`
      : "Choice hat gerade noch kein Match für dich freigegeben.");
  const phaseThreeSuggestedProfile = useMemo(() => {
    const excludedIds = new Set<string>([featuredProfile.id, activePartnerUserId ?? ""]);

    if (currentUserId === demoMilaUserId) {
      excludedIds.add("mila");
    }

    return demoProfiles.find((entry) => !excludedIds.has(entry.id)) ?? demoProfiles[0];
  }, [activePartnerUserId, currentUserId, featuredProfile.id]);
  const phaseThreeSuggestedDistanceLabel = formatDistanceLabel(
    estimateDistanceKm(profile.city || "Berlin", phaseThreeSuggestedProfile.city),
  );
  const phaseTwoViewerUserId = currentUserId ?? "choice_local_viewer";
  const phaseTwoFallbackPartnerUserId =
    activePartnerUserId ?? (phaseTwoViewerUserId === demoMilaUserId ? "choice_primary_demo" : demoMilaUserId);
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
  const phaseTwoViewerCanAnswer =
    phaseTwoStage !== "result"
    && Boolean(phaseTwoCurrentResponderUserId)
    && phaseTwoViewerUserId === phaseTwoCurrentResponderUserId
    && (phaseTwoHasStarted || (phaseOneBothContinue && phaseTwoAvailableByTime));
  const phaseTwoCompletedRounds = phaseTwoResults.filter((entry) => entry.personBLabel).length;
  const phaseTwoCompatibility = phaseTwoCompletedRounds
    ? Math.round(
        phaseTwoResults
          .filter((entry) => entry.personBLabel)
          .reduce((sum, entry) => sum + entry.compatibility, 0) / phaseTwoCompletedRounds,
      )
    : 0;
  const phaseTwoReady = phaseTwoHasStarted && phaseTwoRounds.length > 0 && phaseTwoCompletedRounds === phaseTwoRounds.length;
  const phaseTwoOverdue = phaseOneBothContinue && !phaseTwoReady && currentTime >= phaseThreeStartTime;
  const phaseTwoPenaltyJustApplied = phaseTwoPenaltyAppliedAt === currentReleaseKey;
  const phaseThreeQualified = phaseTwoReady && phaseTwoCompatibility > PHASE_THREE_THRESHOLD;
  const phaseThreeUnlocked =
    currentTime >= phaseThreeStartTime
    && phaseThreeQualified;
  const phaseThreeViewerDecisionRaw = phaseThreeDecisions[phaseOneViewerUserId];
  const phaseThreeViewerDecision: "stay" | "new-match" | "undecided" =
    phaseThreeViewerDecisionRaw ?? "undecided";
  const phaseThreePartnerDecision: "stay" | "new-match" | "undecided" =
    phaseThreeDecisions[phaseOnePartnerUserId] ?? "undecided";
  const phaseThreeBothStay = phaseThreeViewerDecision === "stay" && phaseThreePartnerDecision === "stay";
  const phaseThreeAnyLeave = phaseThreeViewerDecision === "new-match" || phaseThreePartnerDecision === "new-match";
  const phaseThreeDecisionPending =
    phaseThreeUnlocked
    && currentTime >= phaseThreeStartTime
    && !phaseThreeBothStay
    && !phaseThreeAnyLeave;
  const phaseFourUnlocked = currentTime >= phaseFourStartTime && phaseThreeUnlocked && phaseThreeBothStay;
  const phaseThreeDecisionOpen = phaseThreeQualified && !phaseFourUnlocked;
  const phaseThreeViewerKeepsChat = phaseThreeDecisionOpen && phaseThreeViewerDecision !== "new-match";
  const viewerSelectedNewMatch =
    (phaseOneWindowOpen && phaseOneViewerDecision === "new-match")
    || (phaseThreeDecisionOpen && phaseThreeViewerDecision === "new-match");
  const phaseFourStartsInLabel = formatDurationLabel(phaseFourStartTime.getTime() - currentTime.getTime());
  const phaseFourWindowLocked = phaseFourUnlocked && currentTime >= phaseFourStartTime && currentTime < phaseFiveStartTime;
  const phaseFiveUnlocked = phaseFourUnlocked && currentTime >= phaseFiveStartTime;
  const phaseTwoChatUnlocked =
    hasActiveChat
    && (
      (
        phaseTwoReady
        && currentTime >= phaseTwoStartTime
        && currentTime < phaseThreeStartTime
        && (!phaseThreeDecisionOpen || phaseThreeViewerKeepsChat)
      )
      || (phaseThreeUnlocked && phaseThreeViewerKeepsChat && currentTime >= phaseThreeStartTime && currentTime < phaseFourStartTime)
    );
  const chatHeaderActionState = hasActiveChat
    && (
      phaseTwoReady
        ? phaseThreeViewerDecision === "stay"
        : phaseOneViewerDecision === "continue"
    )
    ? "keep"
    : "idle";
  const chatHintText = hasActiveChat
    ? phaseOneBeforeRelease
      ? `Dein erstes Match öffnet ${nextMatchReleaseLabel}.`
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
        : phaseThreeViewerDecision === "new-match"
          ? "Du hast dich für ein neues Match entschieden. Für dich bleibt dieser Chat jetzt zu."
        : phaseThreeAnyLeave
          ? "Mindestens eine Person möchte morgen lieber mit dem neuen Vorschlag weitermachen. Dieser Chat bleibt zu."
          : phaseThreeDecisionPending
            ? `Choice schlägt euch für morgen ${phaseThreeSuggestedProfile.firstName} vor. Erst wenn ihr beide dagegen entscheidet, geht dieser Chat weiter.`
        : phaseOneClosed
          ? phaseOneBothContinue
            ? phaseTwoAvailableByTime
              ? "Beide haben zugestimmt. Erst die Choice-Runde, danach öffnet sich der Chat wieder."
              : `Beide haben zugestimmt. Phase 2 startet heute um ${phaseTwoClockLabel}.`
            : "Die Zeit ist um. Ohne Zustimmung von beiden endet dieses Match."
          : phaseOneChatStarted
            ? decisionCountdownText
            : phaseOneViewerStarts
              ? "Choice hat dich ausgewählt. Du schreibst die erste Nachricht."
              : `Choice hat ${phaseOneStarterName} ausgewählt. Du kannst nach der ersten Nachricht antworten.`
    : "Gerade sind noch nicht genug passende Nutzer da. Mit der Zeit kommen mehr dazu, also hab bitte etwas Geduld.";
  const chatComposerEditable = hasActiveChat && (
    !viewerSelectedNewMatch
      && (
        phaseTwoChatUnlocked
        || (phaseOneWindowOpen && (phaseOneChatStarted || phaseOneViewerStarts))
      )
  );
  const chatComposerHidden = hasActiveChat && viewerSelectedNewMatch;
  const chatComposerLockedText = chatComposerHidden
    ? phaseThreeDecisionOpen
      ? `Du kannst hier nicht mehr schreiben, weil du Neues Match gewählt hast. Für dich ist dieser Chat damit vorbei.`
      : `Du kannst hier nicht mehr schreiben, weil du morgen ein neues Match gewählt hast. Wenn du deine Wahl änderst, öffnet sich dieser Chat wieder.`
    : null;
  const chatComposerPlaceholder = hasActiveChat
    ? phaseOneBeforeRelease
      ? `Chat öffnet ${nextMatchReleaseLabel}`
      : phaseFiveUnlocked
        ? "Ihr habt den Choice Award erreicht"
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
        : phaseThreeViewerDecision === "new-match"
          ? "Neues Match gewählt"
        : phaseThreeAnyLeave
          ? "Morgen startet ein neues Match"
          : phaseThreeDecisionPending
            ? "Erst Phase 3 entscheiden"
        : phaseOneClosed
          ? phaseOneBothContinue
            ? phaseTwoAvailableByTime
              ? "Erst die Choice-Runde spielen"
              : `Phase 2 startet heute um ${phaseTwoClockLabel}`
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
        : phaseThreeViewerDecision === "new-match"
          ? "Du möchtest morgen ein neues Match."
        : phaseThreeAnyLeave
          ? "Morgen geht es nicht weiter."
          : phaseThreeDecisionPending
            ? "Choice macht euch einen Vorschlag."
        : phaseOneClosed
          ? phaseOneBothContinue
            ? phaseTwoAvailableByTime
              ? "Phase 2 ist freigeschaltet."
              : "Beide haben zugestimmt."
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
      : phaseFiveUnlocked
        ? "Ihr habt die letzte Phase erreicht. Choice zeigt euch jetzt den Award für das, was zwischen euch geblieben ist."
        : phaseFourWindowLocked
          ? `Zwischen ${phaseFourClockLabel} und ${phaseFiveClockLabel} bleibt euer Chat in Phase 4 bewusst geschlossen. Danach zeigt Choice, was trotz Abstand geblieben ist.`
      : phaseTwoChatUnlocked
        ? phaseThreeUnlocked
          ? phaseFourUnlocked
            ? "Die Pause ist vorbei. Jetzt ist der Choice Award da."
            : phaseThreePartnerDecision === "new-match"
              ? `${featuredProfile.firstName} möchte morgen lieber mit ${phaseThreeSuggestedProfile.firstName} starten. Du kannst hier noch schreiben, aber ${featuredProfile.firstName} wird nicht mehr antworten.`
              : "Ihr habt euch beide gegen den neuen Vorschlag entschieden. Jetzt könnt ihr hier in Phase 3 weiterschreiben."
          : "Die Choice-Runde ist geschafft. Jetzt könnt ihr hier in Phase 2 weiterschreiben."
        : phaseThreeViewerDecision === "new-match"
          ? `Du hast dich für ${phaseThreeSuggestedProfile.firstName} entschieden. Für dich bleibt dieser Chat jetzt zu, und morgen startet für dich ein neues Match.`
        : phaseThreeAnyLeave
          ? `Mindestens eine Person möchte morgen lieber mit ${phaseThreeSuggestedProfile.firstName} starten. Deshalb bleibt dieser Chat jetzt zu.`
          : phaseThreeDecisionPending
            ? `Choice schlägt euch für morgen ${phaseThreeSuggestedProfile.firstName} vor. Erst wenn ihr beide sagt, dass ihr trotzdem miteinander weitermachen wollt, öffnet sich dieser Chat wieder.`
        : phaseOneClosed
          ? phaseOneBothContinue
            ? phaseTwoAvailableByTime
              ? "Ihr habt beide zugestimmt. Jetzt kommt zuerst die Choice-Runde. Direkt danach öffnet sich dieser Chat wieder."
              : `Ihr habt beide zugestimmt. Phase 1 ist für heute vorbei und heute um ${phaseTwoClockLabel} beginnt Phase 2.`
            : `Bis ${decisionClockLabel} kam keine gemeinsame Zusage zustande. Danach startet wieder ein neues Match.`
          : phaseOneViewerStarts
            ? "In Phase 1 eröffnest du den Chat. Sobald deine erste Nachricht raus ist, kann die andere Person direkt antworten."
            : `${phaseOneStarterName} eröffnet diesen Chat. Sobald die erste Nachricht da ist, kannst du direkt weiterschreiben.`
    : !hasActiveChat
      ? "Im Moment hat Choice noch kein passendes Match für dich gefunden. Gerade am Anfang kann es sein, dass noch zu wenige passende Nutzer da sind. Mit der Zeit kommen mehr dazu, also hab bitte etwas Geduld."
      : undefined;
  const homePhases: Array<{
    phase: string;
    icon: string;
    title: string;
    text: string;
    muted?: boolean;
  }> = [
    {
      phase: "Phase 1",
      icon: "✦",
      title: "Ein kuratiertes Match und ein klarer Start",
      text: `Choice stellt euch um ${releaseClockLabel} ein Match vor, bestimmt, wer den ersten Schritt macht, und gibt euch bis ${decisionClockLabel} Zeit, euch kennenzulernen und die Richtung für danach zu wählen.`,
    },
    {
      phase: "Phase 2",
      icon: "≈",
      title: "Die Choice-Runde macht Haltung sichtbar",
      text: "Drei Dilemma-Fragen zeigen, wie ihr denkt und entscheidet. Danach prüft Choice, wie ähnlich ihr geantwortet hättet, und berechnet daraus eure Kompatibilität.",
    },
    {
      phase: "Phase 3",
      icon: "↻",
      title: "Ein neuer Reiz zeigt, wie stark das Interesse ist",
      text: "Beide bekommen erneut die Chance auf ein neues Match. Genau daran wird sichtbar, ob man bei dieser Person bleiben will oder sich sofort neu orientiert.",
    },
    {
      phase: "Phase 4",
      icon: "◐",
      title: "Eine bewusste Chat-Pause schafft Abstand",
      text: `In Phase 4 bleibt euer Chat zwischen ${phaseFourClockLabel} und ${phaseFiveClockLabel} geschlossen. Der Abstand soll zeigen, ob auch ohne ständigen Kontakt noch wirklich etwas trägt.`,
    },
    {
      phase: "Phase 5",
      icon: "♡",
      title: "Der Choice Award markiert, was geblieben ist",
      text: "Am Ende zeigt der Choice Award, was zwischen euch geblieben ist: ein gemeinsames Herz mit einer Seite für dich und einer für dein Gegenüber. Im besten Fall braucht ihr Choice danach nicht mehr.",
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

  function jumpToTestPhase(phase: (typeof TEST_PHASE_JUMP_OPTIONS)[number]["phase"]) {
    if (!journeyOwnerUserId) {
      return;
    }

    const releaseAt = getReleaseAnchorForCurrentTime(currentTime);

    if (phase === 2) {
      releaseAt.setDate(releaseAt.getDate() - 1);
    }

    if (phase === 3) {
      releaseAt.setDate(releaseAt.getDate() - 2);
    }

    if (phase === 4) {
      releaseAt.setDate(releaseAt.getDate() - 3);
    }

    if (phase === 5) {
      releaseAt.setDate(releaseAt.getDate() - 4);
    }

    const nextState = buildInitialJourneyState(journeyOwnerUserId, releaseAt);
    nextState.releaseAt = releaseAt.toISOString();

    if (phase >= 2) {
      nextState.phaseOneDecisions = {
        [phaseOneViewerUserId]: "continue",
        [phaseOnePartnerUserId]: "continue",
      };
    }

    if (phase >= 3) {
      const rounds = buildPhaseTwoRounds(phaseTwoAssignedStarterName, phaseTwoAssignedPartnerName);
      nextState.phaseTwoRounds = rounds;
      nextState.phaseTwoResults = buildCompletedPhaseTwoResults(rounds);
      nextState.phaseTwoStage = "result";
      nextState.phaseTwoRoundIndex = 0;
      nextState.phaseTwoStarterUserId = phaseTwoAssignedStarterUserId;
      nextState.phaseTwoPartnerUserId = phaseTwoAssignedPartnerUserId;
      nextState.phaseTwoStarterName = phaseTwoAssignedStarterName;
      nextState.phaseTwoPartnerName = phaseTwoAssignedPartnerName;
    }

    if (phase >= 4) {
      nextState.phaseThreeDecisions = {
        [phaseOneViewerUserId]: "stay",
        [phaseOnePartnerUserId]: "stay",
      };
    }

    applyJourneyState(nextState);
    setShowChatDecisionModal(false);
    setShowReportModal(false);
    setReportFeedback(null);
    onSelectTab("chats");
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
    if (phaseTwoHasStarted && !phaseTwoReady) {
      setChatOpen(false);
      setShowChatDecisionModal(false);
      setPhaseTwoOpen(true);
      return;
    }

    if (!phaseOneBothContinue || !phaseTwoAvailableByTime) {
      return;
    }

    void startPhaseTwo();
  }

  function setViewerPhaseOneDecision(nextDecision: "continue" | "new-match") {
    if (!phaseOneWindowOpen) {
      return;
    }

    if (isServerJourneyMode && journeyOwnerUserId) {
      void (async () => {
        try {
          const journey = await setRemotePhaseOneDecision({
            userId: journeyOwnerUserId,
            decision: nextDecision,
          });
          applyRemoteJourneyState(journey);
        } catch {
          // Keep the existing choice visible if the API is temporarily unavailable.
        }
      })();
      return;
    }

    setPhaseOneDecisions((current) => ({
      ...current,
      [phaseOneViewerUserId]: nextDecision,
      ...(isBuiltInDemoMatch ? { [phaseOnePartnerUserId]: nextDecision } : {}),
    }));
  }

  function setViewerPhaseThreeDecision(nextDecision: "stay" | "new-match") {
    if (!phaseThreeDecisionOpen) {
      return;
    }

    if (isServerJourneyMode && journeyOwnerUserId) {
      void (async () => {
        try {
          const journey = await setRemotePhaseThreeDecision({
            userId: journeyOwnerUserId,
            decision: nextDecision,
          });
          applyRemoteJourneyState(journey);
        } catch {
          // Keep the current UI state until the next refresh if the API fails.
        }
      })();
      return;
    }

    setPhaseThreeDecisions((current) => ({
      ...current,
      [phaseOneViewerUserId]: nextDecision,
    }));
  }

  function selectPhaseTwoAnswerA(answer: PhaseTwoAnswerBranch) {
    if (!phaseTwoCurrentRound || !phaseTwoViewerCanAnswer) {
      return;
    }

    if (isServerJourneyMode && journeyOwnerUserId) {
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
          // Keep the current round open if syncing fails.
        }
      })();
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

  function selectPhaseTwoAnswerB(answer: PhaseTwoResponseOption) {
    if (!phaseTwoCurrentRound || !phaseTwoCurrentResult || !phaseTwoViewerCanAnswer) {
      return;
    }

    if (isServerJourneyMode && journeyOwnerUserId) {
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
          // Keep the current round open if syncing fails.
        }
      })();
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

  function sendChatMessage() {
    const nextText = chatDraft.trim();

    if (!nextText || !hasActiveChat || !chatComposerEditable) {
      return;
    }

    if (isServerJourneyMode && journeyOwnerUserId) {
      void (async () => {
        try {
          const journey = await sendRemoteJourneyMessage({
            userId: journeyOwnerUserId,
            kind: "text",
            text: nextText,
          });
          applyRemoteJourneyState(journey);
          setChatDraft("");
        } catch {
          // Ignore temporary send failures and leave the draft intact.
        }
      })();
      return;
    }

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
              text: "Dein Profil, deine Matches und deine Chats werden dauerhaft entfernt.",
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

    const decisionIsAfterGame = phaseThreeQualified;
    const decisionEyebrow = decisionIsAfterGame ? "Für morgen" : "Vor dem Öffnen";
    const decisionTitle = decisionIsAfterGame
      ? "Wie möchtest du morgen weitermachen?"
      : "Wohin tendierst du gerade?";
    const continueTitle = decisionIsAfterGame ? "Bleiben" : "Phase 2";
    const continueText = decisionIsAfterGame
      ? "Mit dieser Person würdest du morgen weitermachen."
      : "Mit dieser Person würdest du weitermachen.";
    const viewerSelectedNewMatchHere = decisionIsAfterGame
      ? phaseThreeViewerDecision === "new-match"
      : phaseOneViewerDecision === "new-match";
    const newMatchConsequenceText = decisionIsAfterGame
      ? `Du startest morgen nicht mehr mit ${featuredProfile.firstName}. Für dich bleibt dieser Chat ab jetzt zu.`
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
              (decisionIsAfterGame ? phaseThreeViewerDecision === "stay" : phaseOneViewerDecision === "continue") && styles.chatDecisionInlineOptionActive,
              (decisionIsAfterGame ? phaseThreeViewerDecision === "stay" : phaseOneViewerDecision === "continue") && pressed && styles.chatDecisionInlineOptionActivePressed,
            ]}
          >
            <Text style={styles.chatDecisionInlineIcon}>♥</Text>
            <View style={styles.chatDecisionInlineCopy}>
              <Text
                style={[
                  styles.chatDecisionInlineOptionTitle,
                  (decisionIsAfterGame ? phaseThreeViewerDecision === "stay" : phaseOneViewerDecision === "continue") && styles.chatDecisionInlineOptionTitleActive,
                ]}
              >
                {continueTitle}
              </Text>
              <Text style={styles.chatDecisionInlineOptionText}>{continueText}</Text>
            </View>
            {(decisionIsAfterGame ? phaseThreeViewerDecision === "stay" : phaseOneViewerDecision === "continue") ? (
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
              <Text style={styles.chatDecisionInlineOptionText}>Du möchtest morgen ein neues Match.</Text>
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
    if (phaseFourUnlocked) {
      return null;
    }

    if (
      !hasActiveChat
      || (
        !phaseTwoHasStarted
        && !phaseTwoReady
        && phaseOneViewerDecision === "undecided"
        && phaseOnePartnerDecision === "undecided"
      )
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
      : phaseOneBothContinue
        ? "Zum Spiel"
        : "Phase 2 starten";
    let phaseTwoStatusTitle = "Phase 2 startet mit einer Person zuerst.";
    let phaseTwoStatusText =
      "Sobald ihr startet, beantwortet eine Person zuerst alle 3 Fragen komplett. Danach ist die andere Person dran.";

    if (!phaseTwoHasStarted && !phaseTwoReady && phaseOneViewerDecision === "continue" && phaseOnePartnerDecision === "undecided") {
      phaseTwoStatusTitle = "Du hast zugestimmt.";
      phaseTwoStatusText = `Choice wartet jetzt noch auf ${featuredProfile.firstName}. Wenn ihr beide bis ${decisionClockLabel} weitermachen wollt, startet Phase 2 heute um ${phaseTwoClockLabel}.`;
    }

    if (!phaseTwoHasStarted && !phaseTwoReady && phaseOneViewerDecision === "undecided" && phaseOnePartnerDecision === "continue") {
      phaseTwoStatusTitle = `${featuredProfile.firstName} möchte weitermachen.`;
      phaseTwoStatusText = `Wenn du auch zustimmst, endet Phase 1 heute um ${decisionClockLabel} und heute um ${phaseTwoClockLabel} beginnt Phase 2.`;
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
              ? `Bis ${decisionClockLabel} kam keine gemeinsame Zusage zustande. Direkt danach startet wieder ein neues Match.`
              : `Mindestens eine Person möchte danach ein neues Match. Bis ${decisionClockLabel} könnt ihr diese Entscheidung noch ändern.`;
    }

    if (!phaseTwoHasStarted && phaseOneBothContinue && !phaseTwoAvailableByTime) {
      phaseTwoStatusTitle = "Beide haben zugestimmt.";
      phaseTwoStatusText = `Phase 1 endet heute um ${decisionClockLabel}. Heute um ${phaseTwoClockLabel} startet Phase 2. Noch ${phaseTwoStartsInLabel}.`;
    }

    if (!phaseTwoHasStarted && phaseOneBothContinue && phaseTwoAvailableByTime) {
      phaseTwoStatusTitle = phaseTwoCurrentResponderUserId === phaseTwoViewerUserId
        ? "Du beginnst jetzt Phase 2."
        : `${phaseTwoCurrentResponderName} beginnt jetzt Phase 2.`;
      phaseTwoStatusText = phaseTwoCurrentResponderUserId === phaseTwoViewerUserId
        ? `Beantworte jetzt zuerst alle 3 Fragen. Danach ist ${phaseTwoPartnerName} dran.`
        : `${phaseTwoCurrentResponderName} beantwortet jetzt zuerst alle 3 Fragen. Danach bist du dran.`;
    }

    if (phaseTwoOverdue) {
      phaseTwoStatusTitle = "Phase 2 wartet noch auf Antworten.";
      phaseTwoStatusText = phaseTwoPenaltyJustApplied
        ? phaseTwoCurrentResponderUserId === phaseTwoViewerUserId
          ? `Du warst für diese Runde dran und hast dafür bereits einen Strafpunkt bekommen. Wenn du jetzt weitermachst, kann die Runde trotzdem noch abgeschlossen werden.`
          : `${phaseTwoCurrentResponderName} war für diese Runde dran und hat dafür bereits einen Strafpunkt bekommen. Sobald die Antworten da sind, kann es trotzdem noch weitergehen.`
        : phaseTwoCurrentResponderUserId === phaseTwoViewerUserId
          ? `Bis ${phaseThreeClockLabel} war deine Runde fällig. Wenn du jetzt nicht spielst, gibt es dafür einen Strafpunkt.`
          : `${phaseTwoCurrentResponderName} ist mit der Runde dran. Wenn bis ${phaseThreeClockLabel} nichts kommt, gibt es dafür einen Strafpunkt.`;
    }

    if (phaseTwoHasStarted && phaseTwoStage === "starter") {
      if (viewerIsStarter) {
        phaseTwoStatusTitle = "Du beginnst diese Runde.";
        phaseTwoStatusText = `Beantworte jetzt zuerst alle 3 Fragen. Danach ist ${phaseTwoPartnerName} dran.`;
      } else {
        phaseTwoStatusTitle = `${phaseTwoStarterName} beginnt diese Runde.`;
        phaseTwoStatusText = `${phaseTwoStarterName} beantwortet gerade die 3 Fragen. Danach bekommst du Bescheid und bist dran.`;
      }
    }

    if (phaseTwoHasStarted && phaseTwoStage === "partner") {
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
        ? phaseThreeUnlocked
          ? `Choice hat eure Runde ausgewertet. Jetzt zeigt euch Choice ${phaseThreeSuggestedProfile.firstName} für morgen. Erst wenn ihr beide euch dagegen entscheidet, bleibt euer Chat offen.`
          : `Choice hat eure Runde ausgewertet. Ihr seid über 50% und könnt morgen in Phase 3 weitergehen.`
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
                ? phaseThreeUnlocked
                  ? `heute um ${phaseThreeClockLabel} geht es in Phase 3 weiter`
                  : `über 50% • morgen startet Phase 3`
                : "nicht genug für Phase 3"}
            </Text>
          </View>
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
    if (!hasActiveChat || !phaseThreeUnlocked || phaseFourUnlocked) {
      return null;
    }

    let phaseThreeTitle = "Choice macht euch jetzt einen neuen Vorschlag.";
    let phaseThreeText =
      `Für morgen schlägt Choice ${phaseThreeSuggestedProfile.firstName} vor. Nur wenn ihr beide euch aktiv dagegen entscheidet, bleibt dieser Chat offen und ihr könnt weiterschreiben.`;

    if (phaseThreeViewerDecision === "stay" && phaseThreePartnerDecision === "undecided") {
      phaseThreeTitle = "Du möchtest bei diesem Match bleiben.";
      phaseThreeText = `Choice wartet jetzt noch auf ${featuredProfile.firstName}. Erst wenn ihr beide euch gegen ${phaseThreeSuggestedProfile.firstName} entscheidet, geht euer Chat weiter.`;
    }

    if (phaseThreeViewerDecision === "undecided" && phaseThreePartnerDecision === "stay") {
      phaseThreeTitle = `${featuredProfile.firstName} möchte bei euch bleiben.`;
      phaseThreeText = `Wenn du dich auch gegen ${phaseThreeSuggestedProfile.firstName} entscheidest, bleibt euer Chat offen und ihr könnt weiterschreiben.`;
    }

    if (phaseThreeBothStay) {
      phaseThreeTitle = "Ihr habt euch beide gegen den neuen Vorschlag entschieden.";
      phaseThreeText = "Choice lässt euren Chat offen. Ihr könnt jetzt in Phase 3 weiterschreiben.";
    }

    if (phaseThreeAnyLeave) {
      phaseThreeTitle = "Mindestens eine Person möchte morgen ein neues Match.";
      phaseThreeText = `Damit endet euer aktueller Chat. Morgen würde stattdessen ${phaseThreeSuggestedProfile.firstName} in Phase 1 bereitstehen.`;
    }

    return (
      <View style={styles.phaseThreeEntryCard}>
        <Text style={styles.phaseTwoEyebrow}>Phase 3</Text>
        <Text style={styles.phaseThreeEntryTitle}>{phaseThreeTitle}</Text>
        <Text style={styles.phaseTwoEntryText}>{phaseThreeText}</Text>

        <View style={styles.phaseThreePreviewWrap}>
          <Image source={{ uri: phaseThreeSuggestedProfile.imageUri }} style={styles.phaseThreePreviewImage} />
          <View style={styles.phaseThreePreviewCopy}>
            <View style={styles.phaseThreePreviewTopRow}>
              <Text style={styles.phaseThreePreviewName}>
                {phaseThreeSuggestedProfile.firstName}, {phaseThreeSuggestedProfile.age}
              </Text>
              <View style={styles.phaseThreePreviewPill}>
                <Text style={styles.phaseThreePreviewPillText}>{`heute ${phaseThreeClockLabel}`}</Text>
              </View>
            </View>
            <Text style={styles.phaseThreePreviewMeta}>
              {[phaseThreeSuggestedProfile.city, phaseThreeSuggestedDistanceLabel].filter(Boolean).join(" • ")}
            </Text>
            <Text style={styles.phaseThreePreviewTagline}>{phaseThreeSuggestedProfile.tagline}</Text>
          </View>
        </View>

        <View style={styles.phaseThreeDecisionRow}>
          <Pressable
            onPress={() => setViewerPhaseThreeDecision("stay")}
            style={({ pressed }) => [
              styles.phaseThreeDecisionOption,
              styles.phaseThreeDecisionOptionStay,
              pressed && styles.phaseThreeDecisionOptionPressed,
              phaseThreeViewerDecision === "stay" && styles.phaseThreeDecisionOptionActive,
              phaseThreeViewerDecision === "stay" && pressed && styles.phaseThreeDecisionOptionActivePressed,
            ]}
          >
            <View style={styles.phaseThreeDecisionHeader}>
              <Text style={styles.phaseThreeDecisionIcon}>♥</Text>
              {phaseThreeViewerDecision === "stay" ? (
                <View style={styles.phaseThreeDecisionMark}>
                  <Text style={styles.phaseThreeDecisionMarkText}>✓</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.phaseThreeDecisionCopy}>
              <Text style={[styles.phaseThreeDecisionTitle, phaseThreeViewerDecision === "stay" && styles.phaseThreeDecisionTitleActive]}>
                Bleiben
              </Text>
              <Text style={styles.phaseThreeDecisionText}>Morgen mit diesem Match weiterschreiben.</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setViewerPhaseThreeDecision("new-match")}
            style={({ pressed }) => [
              styles.phaseThreeDecisionOption,
              styles.phaseThreeDecisionOptionNewMatch,
              pressed && styles.phaseThreeDecisionOptionPressed,
              phaseThreeViewerDecision === "new-match" && styles.phaseThreeDecisionOptionMuted,
              phaseThreeViewerDecision === "new-match" && pressed && styles.phaseThreeDecisionOptionMutedPressed,
            ]}
          >
            <View style={styles.phaseThreeDecisionHeader}>
              <Text style={styles.phaseThreeDecisionIcon}>○</Text>
              {phaseThreeViewerDecision === "new-match" ? (
                <View style={styles.phaseThreeDecisionMarkMuted}>
                  <Text style={styles.phaseThreeDecisionMarkMutedText}>✓</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.phaseThreeDecisionCopy}>
              <Text
                style={[
                  styles.phaseThreeDecisionTitle,
                  phaseThreeViewerDecision === "new-match" && styles.phaseThreeDecisionTitleMuted,
                ]}
              >
                Neu starten
              </Text>
              <Text style={styles.phaseThreeDecisionText}>Morgen lieber mit {phaseThreeSuggestedProfile.firstName} chatten.</Text>
            </View>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderPhaseFourEntryCard() {
    if (!hasActiveChat || !phaseFourUnlocked || phaseFiveUnlocked) {
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
        try {
          const journey = await refreshJourneyState(journeyOwnerUserId);

          if (!cancelled) {
            setIsJourneyHydrated(true);
          }
        } catch {
          if (!cancelled) {
            setRemoteJourney(null);
            resetJourneyState(journeyOwnerUserId);
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
    if (isServerJourneyMode || !isJourneyHydrated || !journeyOwnerUserId || !journeyReleaseAt) {
      return;
    }

    void saveTransientState<PersistedJourneyState>({
      ownerUserId: journeyOwnerUserId,
      releaseAt: journeyReleaseAt,
      sharedChatMessages,
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
      || !phaseOneBothContinue
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
    phaseOneBothContinue,
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
    if (!showFreshMatchNotice) {
      return;
    }

    if (currentTab === "match" || currentTab === "chats") {
      setSeenMatchReleaseAt(currentReleaseKey);
    }
  }, [currentReleaseKey, currentTab, showFreshMatchNotice]);

  function appendSharedChatMessage(message: SharedChatMessageInput) {
    setSharedChatMessages((current) => [
      ...current,
      {
        id: `shared-${Date.now()}-${current.length + 1}`,
        author: isMilaSession ? "mila" : "primary",
        ...message,
      },
    ]);
  }

  async function pickChatImage() {
    if (!hasActiveChat || !chatComposerEditable) {
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
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

      if (isServerJourneyMode && journeyOwnerUserId) {
        const [uploadedImageUri] = await uploadProfilePhotos([nextUri]);

        if (!uploadedImageUri) {
          return;
        }

        const journey = await sendRemoteJourneyMessage({
          userId: journeyOwnerUserId,
          kind: "image",
          imageUri: uploadedImageUri,
        });
        applyRemoteJourneyState(journey);
        return;
      }

      appendSharedChatMessage({
        kind: "image",
        imageUri: nextUri,
      });
    } catch {
      // Ignore picker edge cases in the demo flow.
    }
  }

  function openReportModal() {
    setReportReason("");
    setReportDetails("");
    setReportFeedback(null);
    setShowReportModal(true);
  }

  async function submitReport() {
    if (!currentUserId || !activePartnerUserId || !reportReason) {
      return;
    }

    const latestMessagePreview = getSharedChatMessagePreview(sharedChatMessages[sharedChatMessages.length - 1]) ?? null;

    try {
      await createRemoteReport({
        reporterUserId: currentUserId,
        reportedUserId: activePartnerUserId,
        reporterName: displayName,
        reportedName: featuredProfile.firstName,
        reason: reportReason,
        details: reportDetails.trim(),
        latestMessagePreview,
      });
      setShowReportModal(false);
      setReportReason("");
      setReportDetails("");
      setReportFeedback("Meldung gespeichert. Choice prüft sie im Admin-Dashboard.");
    } catch {
      setReportFeedback("Meldung konnte gerade nicht gespeichert werden. Bitte versuch es gleich nochmal.");
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
    if (!phaseTwoOpen || phaseTwoStage === "result") {
      return;
    }

    if (!phaseTwoViewerCanAnswer) {
      setPhaseTwoOpen(false);
    }
  }, [phaseTwoOpen, phaseTwoStage, phaseTwoViewerCanAnswer]);

  useEffect(() => {
    if (!phaseThreeDecisionOpen || phaseThreeViewerDecisionRaw) {
      return;
    }

    setPhaseThreeDecisions((current) => ({
      ...current,
      [phaseOneViewerUserId]: "stay",
    }));
  }, [phaseOneViewerUserId, phaseThreeDecisionOpen, phaseThreeViewerDecisionRaw]);

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

    if (phaseOneClosed && !phaseOneBothContinue && currentTime >= phaseTwoStartTime) {
      resetJourneyState(journeyOwnerUserId, phaseTwoStartTime.toISOString());
      return;
    }

    if (phaseTwoReady && phaseTwoCompatibility <= PHASE_THREE_THRESHOLD && currentTime >= phaseThreeStartTime) {
      resetJourneyState(journeyOwnerUserId, phaseThreeStartTime.toISOString());
      return;
    }

    if (phaseThreeUnlocked && !phaseThreeBothStay && currentTime >= phaseFourStartTime) {
      resetJourneyState(journeyOwnerUserId, phaseFourStartTime.toISOString());
    }
  }, [
    currentTime,
    isServerJourneyMode,
    isJourneyHydrated,
    journeyOwnerUserId,
    journeyReleaseAt,
    phaseFourStartTime,
    phaseOneBothContinue,
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
          <Pressable onPress={onOpenAccountSwitcher} style={styles.overviewHeaderSwitchButton}>
            <Text style={styles.overviewHeaderSwitchButtonText}>Wechseln</Text>
          </Pressable>
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
                  : `Choice pausiert Konten bei drei bestätigten Strafpunkten automatisch. Dazu zählt auch, wenn du den Chat eröffnen solltest und bis ${decisionClockLabel} keine erste Nachricht schreibst oder wenn du eine dir zugewiesene Choice-Runde in Phase 2 liegen lässt.`}
            </Text>
          </View>

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
                    ? phaseThreeUnlocked
                      ? "Über 50% erreicht • Phase 3 ist jetzt offen"
                      : "Über 50% erreicht • morgen kann Phase 3 starten"
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
          composerHidden={chatComposerHidden}
          composerLockedText={chatComposerLockedText}
          fullScreen
          onBack={() => setChatOpen(false)}
          onOpenProfile={hasActiveChat ? () => {
            setChatOpen(false);
            onSelectTab("match");
          } : undefined}
          onReportPress={hasActiveChat && !phaseOneBeforeRelease ? openReportModal : undefined}
          headerActionState={chatHeaderActionState}
          onHeaderActionPress={hasActiveChat && (phaseOneWindowOpen || (phaseThreeUnlocked && !phaseFourUnlocked)) ? () => setShowChatDecisionModal(true) : undefined}
          onComposerChangeText={setChatDraft}
          onPickImage={() => void pickChatImage()}
          onSend={sendChatMessage}
          topInset={insets.top}
          bottomInset={insets.bottom}
          threadSupplement={renderPhaseAdvanceNotice()}
        />
        <Modal transparent visible={showChatDecisionModal} animationType="fade" onRequestClose={() => setShowChatDecisionModal(false)}>
          <Pressable style={styles.chatDecisionOverlay} onPress={() => setShowChatDecisionModal(false)}>
            <Pressable style={styles.chatDecisionCard} onPress={() => {}}>
              <Text style={styles.chatDecisionEyebrow}>{phaseThreeUnlocked ? "Für morgen" : "Nach dem Match"}</Text>
              <Text style={styles.chatDecisionTitle}>
                {phaseThreeUnlocked ? "Möchtest du morgen bei diesem Match bleiben?" : "Möchtest du diesen Chat weiterführen?"}
              </Text>
              <Text style={styles.chatDecisionText}>
                {phaseThreeUnlocked
                  ? `Choice schlägt dir für morgen ${phaseThreeSuggestedProfile.firstName} vor. Nur wenn ihr beide euch dagegen entscheidet, bleibt euer Chat offen.`
                  : "Wenn es sich gut anfühlt, kannst du Phase 2 vormerken. Sonst gehst du morgen einfach mit einem neuen Match weiter."}
              </Text>

              <View style={styles.chatDecisionButtonColumn}>
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
                    (phaseThreeUnlocked ? phaseThreeViewerDecision === "stay" : phaseOneViewerDecision === "continue") && styles.chatDecisionOptionButtonActive,
                    (phaseThreeUnlocked ? phaseThreeViewerDecision === "stay" : phaseOneViewerDecision === "continue") && pressed && styles.chatDecisionOptionButtonActivePressed,
                  ]}
                >
                  <Text style={styles.chatDecisionOptionIcon}>♥</Text>
                  <View style={styles.chatDecisionOptionCopy}>
                    <Text style={[styles.chatDecisionOptionTitle, (phaseThreeUnlocked ? phaseThreeViewerDecision === "stay" : phaseOneViewerDecision === "continue") && styles.chatDecisionOptionTitleActive]}>
                      {phaseThreeUnlocked ? "Bleiben" : "Phase 2 vormerken"}
                    </Text>
                    <Text style={styles.chatDecisionOptionText}>
                      {phaseThreeUnlocked
                        ? "Morgen mit diesem Match weiterschreiben."
                        : "Diesen Chat würdest du gern weiterführen."}
                    </Text>
                  </View>
                  {(phaseThreeUnlocked ? phaseThreeViewerDecision === "stay" : phaseOneViewerDecision === "continue") ? (
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
                        ? `Morgen lieber mit ${phaseThreeSuggestedProfile.firstName} chatten.`
                        : "Du möchtest morgen ein neues Match."}
                    </Text>
                  </View>
                  {(phaseThreeUnlocked ? phaseThreeViewerDecision === "new-match" : phaseOneViewerDecision === "new-match") ? (
                    <View style={styles.chatDecisionOptionMarkMuted}>
                      <Text style={styles.chatDecisionOptionMarkMutedText}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        <Modal transparent visible={showReportModal} animationType="fade" onRequestClose={() => setShowReportModal(false)}>
          <Pressable style={styles.chatDecisionOverlay} onPress={() => setShowReportModal(false)}>
            <Pressable style={styles.reportModalCard} onPress={() => {}}>
              <Text style={styles.chatDecisionEyebrow}>Meldung</Text>
              <Text style={styles.chatDecisionTitle}>Warum möchtest du diese Person melden?</Text>
              <Text style={styles.chatDecisionText}>
                Die Meldung landet bei dir im Status-Tab. Dort kannst du später prüfen, ob der Grund legitim ist und ob es einen Strafpunkt geben soll.
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

              <View style={styles.reportModalActionRow}>
                <Pressable onPress={() => setShowReportModal(false)} style={styles.reportModalCancelButton}>
                  <Text style={styles.reportModalCancelButtonText}>Abbrechen</Text>
                </Pressable>
                <Pressable
                  onPress={submitReport}
                  disabled={!reportReason}
                  style={[styles.reportModalSubmitButton, !reportReason && styles.reportModalSubmitButtonDisabled]}
                >
                  <Text style={styles.reportModalSubmitButtonText}>Melden</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
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
          Ein bestätigter Verstoß gibt einen Strafpunkt. Bei drei Punkten wird dein Konto pausiert. Gekaufte Match-Pakete werden dann eingefroren und nur bei dauerhafter Sperre endgültig verloren.
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
                : `Noch ${remainingPenaltyPoints} Punkt${remainingPenaltyPoints === 1 ? "" : "e"} bis dein Konto pausiert wird.`}
            </Text>
          </View>
        </View>

        <View style={styles.penaltyReasonList}>
          {penaltyReasons.map((reason) => (
            <View key={reason} style={styles.penaltyReasonItem}>
              <View style={styles.penaltyReasonDot} />
              <Text style={styles.penaltyReasonText}>{reason}</Text>
            </View>
          ))}
        </View>
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
          Choice hat {featuredProfile.firstName} jetzt für dich geöffnet. Du solltest dazu auch eine Benachrichtigung auf dein Handy bekommen haben.
        </Text>

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

    let eyebrow = "";
    let title = "";
    let text = "";
    let buttonLabel: string | null = null;
    let onPress: (() => void) | null = null;

    if (!phaseTwoReady && phaseOneBothContinue && currentTime >= phaseTwoStartTime) {
      eyebrow = "Phase 2";

      if (phaseTwoViewerCanAnswer) {
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
        text = phaseTwoPenaltyJustApplied
          ? `${phaseTwoCurrentResponderName} hat dafür bereits einen Strafpunkt bekommen. Sobald die Antworten da sind, kann es hier trotzdem noch weitergehen.`
          : `Bevor hier etwas weitergeht, muss zuerst die Choice-Runde gespielt werden.`;
      }
    } else if (phaseThreeDecisionPending) {
      eyebrow = "Phase 3";
      title = "Phase 3 ist jetzt da.";
      text = `Choice schlägt euch für morgen ${phaseThreeSuggestedProfile.firstName} vor. Entscheidet jetzt, ob ihr bleiben oder neu starten wollt.`;
      buttonLabel = "Weiter";
      onPress = () => setShowChatDecisionModal(true);
    } else if (phaseFourUnlocked && !phaseFiveUnlocked) {
      eyebrow = "Phase 4";
      title = "Phase 4 läuft jetzt.";
      text = `Zwischen ${phaseFourClockLabel} und ${phaseFiveClockLabel} bleibt euer Chat bewusst geschlossen.`;
    } else if (phaseFiveUnlocked) {
      eyebrow = "Phase 5";
      title = "Phase 5 ist jetzt da.";
      text = "Choice zeigt euch jetzt, was nach allen Phasen zwischen euch geblieben ist.";
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

  function renderTestPhaseCard() {
    if (!hasActiveChat || !journeyOwnerUserId) {
      return null;
    }

    return (
      <View style={styles.phaseJumpCard}>
        <Text style={styles.phaseJumpEyebrow}>Testen</Text>
        <Text style={styles.phaseJumpTitle}>Direkt zwischen den Phasen springen</Text>
        <Text style={styles.phaseJumpText}>
          Das setzt deinen aktuellen Match-Verlauf lokal auf die gewählte Phase und bringt dich direkt in den Chat.
        </Text>

        <View style={styles.phaseJumpButtonRow}>
          {TEST_PHASE_JUMP_OPTIONS.map((option) => (
            <Pressable
              key={option.phase}
              onPress={() => jumpToTestPhase(option.phase)}
              style={styles.phaseJumpButton}
            >
              <Text style={styles.phaseJumpButtonText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  function renderOverviewContent() {
    if (currentTab === "today") {
      return (
        <>
          {renderFreshMatchNotice()}
          {!hasActiveChat || phaseOneBeforeRelease ? (
            <View style={styles.matchReleaseNoticeCard}>
              <Text style={styles.matchReleaseNoticeEyebrow}>Nächstes Match</Text>
              <Text style={styles.matchReleaseNoticeTitle}>Noch {nextScheduledMatchCountdownLabel} bis zu deinem nächsten Match.</Text>
              <Text style={styles.matchReleaseNoticeText}>
                Choice gibt neue Matches gesammelt um {nextScheduledMatchReleaseClockLabel} frei. Deine nächste Freigabe ist {nextScheduledMatchReleaseLabel}.
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

          <View style={styles.overviewStatusCard}>
            <Text style={styles.overviewStatusEyebrow}>Home</Text>
            <Text style={styles.overviewStatusTitle}>Choice sucht bewusst nach echter Passung.</Text>
            <Text style={styles.overviewStatusText}>
              Choice übernimmt die guten Züge von jemandem, der dich ehrlich und aufmerksam verkuppeln würde: selektiv, klar und mit echtem Blick darauf, wer wirklich zu dir passen könnte.
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
                <View style={[styles.timelineBadge, phase.muted && styles.timelineBadgeMuted]}>
                  <Text style={styles.timelineBadgeIcon}>{phase.icon}</Text>
                </View>
                <View style={styles.timelineCopy}>
                  <Text style={[styles.timelineStepLabel, phase.muted && styles.timelineStepLabelMuted]}>{phase.phase}</Text>
                  <Text style={styles.timelineTitle}>{phase.title}</Text>
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
          {renderPillSection("Interessen", featuredProfile.interests)}
          {renderPillSection("Eher pro", featuredProfile.greenFlags)}
          {renderPillSection("No-Gos", featuredProfile.dealbreakers)}
          <View style={styles.overviewRuleCard}>
            <Text style={styles.overviewRuleTitle}>Dieses Match öffnet genau einen echten Chat</Text>
            <Text style={styles.overviewRuleText}>
              Kein zweiter Thread, kein Ablenken. Wenn du öffnest, gehört dieser Chat nur zu diesem einen Match und endet auch mit ihm.
            </Text>
          </View>
          <View style={styles.overviewDecisionRow}>
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
            </View>

              <View style={styles.chatListBody}>
                <View style={styles.chatListTopRow}>
                  <Text style={styles.chatListName}>{chatTitle}</Text>
                  {hasActiveChat ? (
                    <View style={[styles.chatListDeadlinePill, remainingDecisionMs <= 0 && styles.chatListDeadlinePillEnded]}>
                      <Text style={[styles.chatListDeadlineText, remainingDecisionMs <= 0 && styles.chatListDeadlineTextEnded]}>
                        {phaseOneBeforeRelease
                          ? nextMatchReleaseLabel === `heute um ${releaseClockLabel}`
                            ? `heute ${releaseClockLabel}`
                            : `morgen ${releaseClockLabel}`
                          : remainingDecisionMs > 0
                            ? decisionCountdownLabel
                            : `${decisionClockLabel} vorbei`}
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
          {renderChatDecisionCard()}
          {phaseTwoEntryCard}
          {phaseThreeEntryCard}
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
                  {hasPaidMatchAccess ? `+${paidMatchCredits}` : `${completedMatchCount}/${includedMatchLimit}`}
                </Text>
              </View>
            </View>

            <Text style={styles.unlockText}>
              Nach deinen ersten 8 Matches kannst du dir jeweils 8 weitere Matches für 3,99 € freischalten.
            </Text>

            <View style={styles.unlockProgressRow}>
              <ProgressRing
                current={completedMatchCount}
                total={includedMatchLimit}
                activeColor="#ffb65f"
                label="Matches"
                unlocked={hasPaidMatchAccess}
              />
              <View style={styles.unlockProgressCopy}>
                <Text style={styles.unlockProgressTitle}>
                  {hasPaidMatchAccess
                    ? `${paidMatchCredits} gekaufte Matches offen`
                    : `${remainingIncludedMatches} von ${includedMatchLimit} offen`}
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
                        : "Sobald die 8 voll sind, kannst du dir für 3,99 € 8 weitere Matches kaufen."}
                </Text>
              </View>
            </View>
          </View>

          {renderPenaltyCard()}
          {renderTestPhaseCard()}

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
            Konto aktiv.
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
        <Pressable onPress={onOpenAccountSwitcher} style={styles.overviewHeaderSwitchButton}>
          <Text style={styles.overviewHeaderSwitchButtonText}>Wechseln</Text>
        </Pressable>
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
  const [signedInReturningUser, setSignedInReturningUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ profileId: string; summary: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountActionPending, setAccountActionPending] = useState(false);
  const [accountActionMessage, setAccountActionMessage] = useState<string | null>(null);
  const [rememberedSessions, setRememberedSessions] = useState<PersistedSession[]>([]);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

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
  const milaSwitchSession = useMemo(() => buildDemoMilaSession(), []);
  const activeChatAuthor: SharedChatAuthor = verifiedUserId === demoMilaUserId ? "mila" : "primary";
  const matchedSession = useMemo(() => {
    if (verifiedUserId === demoMilaUserId) {
      return rememberedSessions.find((entry) => entry.userId !== demoMilaUserId) ?? null;
    }

    return milaSwitchSession;
  }, [milaSwitchSession, rememberedSessions, verifiedUserId]);
  const alternateRememberedSessions = useMemo(() => {
    const base = rememberedSessions.filter((entry) => entry.userId !== verifiedUserId);

    if (verifiedUserId !== demoMilaUserId && !base.some((entry) => entry.userId === demoMilaUserId)) {
      return [milaSwitchSession, ...base];
    }

    return base;
  }, [milaSwitchSession, rememberedSessions, verifiedUserId]);

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

  function setSessionState(session: Omit<PersistedSession, "savedAt">) {
    setProfile(session.profile);
    setPhotoUris(session.photoUris);
    setIntroVideoUri(session.introVideoUri);
    setIntroVideoDurationMs(session.introVideoDurationMs);
    setVerifiedUserId(session.userId);
    setVerifiedPhone(session.phoneNumber);
    setCurrentSurface("overview");
    setOverviewTab("today");
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

  async function loadIsAccountPaused(userId: string) {
    try {
      const remoteAccount = await fetchRemoteAccountState(userId);
      return remoteAccount.accountPaused;
    } catch {
      return false;
    }
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

        if (await loadIsAccountPaused(persistedSession.userId)) {
          await clearTransientState();
          await clearPersistedSession();
          await removeRememberedSession(persistedSession.userId);

          if (!cancelled) {
            setRememberedSessions((current) => current.filter((entry) => entry.userId !== persistedSession.userId));
            resetToPausedSignIn();
          }
          return;
        }

        if (!cancelled) {
          setSessionState(persistedSession);
        }

        try {
          const restoredProfile = await fetchRemoteProfile(persistedSession.userId);

          if (cancelled) {
            return;
          }

          setProfile(restoredProfile.profile);
          setPhotoUris(restoredProfile.photoUrls);
          setIntroVideoUri(restoredProfile.videoUrl);
          setIntroVideoDurationMs(null);
          await persistLocalSession({
            userId: persistedSession.userId,
            phoneNumber: persistedSession.phoneNumber,
            profile: restoredProfile.profile,
            photoUris: restoredProfile.photoUrls,
            introVideoUri: restoredProfile.videoUrl,
            introVideoDurationMs: null,
          });
        } catch (requestError) {
          const message = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";

          if (message === "PROFILE_NOT_FOUND") {
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
            setVerifiedPhone(null);
            setCurrentSurface("onboarding");
            setOverviewTab("today");
            setScreenIndex(0);
            return;
          }

          // Keep the cached local session if the live refresh fails for temporary reasons.
        }
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
    if (!isSessionHydrated || currentSurface !== "overview" || !verifiedUserId || !profile.firstName.trim()) {
      return;
    }

    void persistLocalSession({
      userId: verifiedUserId,
      phoneNumber: verifiedPhone,
      profile,
      photoUris,
      introVideoUri,
      introVideoDurationMs,
    });
  }, [currentSurface, introVideoDurationMs, introVideoUri, isSessionHydrated, photoUris, profile, verifiedPhone, verifiedUserId]);

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
    setScreenIndex(0);
    setCurrentSurface("onboarding");
    setOverviewTab("today");
  }

  async function switchToRememberedSession(session: Omit<PersistedSession, "savedAt"> | PersistedSession) {
    setShowAccountSwitcher(false);
    setAccountActionMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      let nextSession = session;

      if (session.userId === demoMilaUserId) {
        const savedDemoSession = await persistLocalSession({
          userId: session.userId,
          phoneNumber: session.phoneNumber,
          profile: session.profile,
          photoUris: session.photoUris,
          introVideoUri: session.introVideoUri,
          introVideoDurationMs: session.introVideoDurationMs,
        });
        setSessionState(savedDemoSession);
        return;
      }

      if (await loadIsAccountPaused(session.userId)) {
        await removeRememberedSession(session.userId);
        setRememberedSessions((current) => current.filter((entry) => entry.userId !== session.userId));
        setAccountActionMessage("Dieses Konto ist pausiert.");
        return;
      }

      try {
        const restoredProfile = await fetchRemoteProfile(session.userId);
        nextSession = await persistLocalSession({
          userId: session.userId,
          phoneNumber: session.phoneNumber,
          profile: restoredProfile.profile,
          photoUris: restoredProfile.photoUrls,
          introVideoUri: restoredProfile.videoUrl,
          introVideoDurationMs: null,
        });
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";

        if (message === "PROFILE_NOT_FOUND") {
          await removeRememberedSession(session.userId);
          setRememberedSessions((current) => current.filter((entry) => entry.userId !== session.userId));

          if (verifiedUserId === session.userId) {
            await clearPersistedSession();
            resetToIntroSurface();
          }

          setAccountActionMessage("Dieses Konto gibt es nicht mehr.");
          return;
        }
      }

      setSessionState(nextSession);
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
      await clearPersistedSession();
      resetToIntroSurface();
    } finally {
      setAccountActionPending(false);
    }
  }

  async function handleSignOut() {
    setAccountActionPending(true);

    try {
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
      Keyboard.dismiss();
      setVerifiedUserId(result.userId);
      setVerifiedPhone(phoneNumber.trim());

      if (result.profileCompleted) {
        if (await loadIsAccountPaused(result.userId)) {
          setError("Dieses Konto ist pausiert.");
          return;
        }

        const restoredProfile = await fetchRemoteProfile(result.userId);
        setSessionState({
          userId: result.userId,
          phoneNumber: phoneNumber.trim(),
          profile: restoredProfile.profile,
          photoUris: restoredProfile.photoUrls,
          introVideoUri: restoredProfile.videoUrl,
          introVideoDurationMs: null,
        });
        await persistLocalSession({
          userId: result.userId,
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

      if (message === "PROFILE_NOT_FOUND") {
        setError("Profil konnte nicht geladen werden.");
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
    const uploadedPhotoUrls = await uploadProfilePhotos(photoUris);
    const uploadedVideoUrl = await uploadProfileVideo(introVideoUri);
    const result = await createRemoteProfile(verifiedUserId, nextProfile, uploadedPhotoUrls, uploadedVideoUrl);

    setProfile(nextProfile);
    setPhotoUris(uploadedPhotoUrls);
    setIntroVideoUri(uploadedVideoUrl);
    await persistLocalSession({
      userId: verifiedUserId,
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
      await Linking.openURL(url);
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
              Bevor du dein Konto bestätigst, musst du Impressum, Datenschutz, Rechtliches und AGB gelesen haben und ihnen zustimmen.
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
                Ich habe Impressum, Datenschutz, Rechtliches und AGB gelesen und stimme allen vier Punkten zu.
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
          onEditProfileField={startProfileFieldEditing}
          onPauseAccount={handlePauseAccount}
          onSignOut={handleSignOut}
          onDeleteAccount={handleDeleteAccount}
          accountActionPending={accountActionPending}
          accountActionMessage={accountActionMessage}
          displayName={overviewDisplayName}
          currentUserId={verifiedUserId}
          matchedSession={matchedSession}
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
                          <Text style={styles.accountSwitchOptionName}>{sessionName}</Text>
                          <Text style={styles.accountSwitchOptionMeta}>{sessionMeta || "Gespeicherter Account"}</Text>
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
    justifyContent: "space-between",
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
  chatDecisionOverlay: {
    flex: 1,
    backgroundColor: "rgba(6, 5, 10, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
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
    backgroundColor: "rgba(255, 115, 167, 0.24)",
    borderColor: "rgba(255, 115, 167, 0.46)",
    shadowColor: "#ff73a7",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  chatDecisionOptionButtonActivePressed: {
    backgroundColor: "rgba(255, 115, 167, 0.32)",
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
  chatBubbleRow: {
    width: "100%",
  },
  chatBubbleRowLeft: {
    alignItems: "flex-start",
  },
  chatBubbleRowRight: {
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
  timelineStepLabelMuted: {
    color: "#b8add4",
  },
  timelineTitle: {
    color: "#f7f4ff",
    fontSize: 15,
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
  accountSwitchOptionName: {
    color: "#fff7ff",
    fontSize: 15,
    fontWeight: "700",
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
    marginTop: -3,
    color: "#f3f7ff",
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "400",
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
