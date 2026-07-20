import AsyncStorage from "@react-native-async-storage/async-storage";
import { type RegistrationProfile } from "./registration";

const sessionStorageKey = "choice.current-session";
const sessionHistoryStorageKey = "choice.session-history";
const transientStateStorageKey = "choice.transient-state";
const moderationStateStorageKey = "choice.moderation-state";
const maxRememberedSessions = 6;

export type PersistedSession = {
  userId: string;
  accessToken: string | null;
  phoneNumber: string | null;
  profile: RegistrationProfile;
  photoUris: string[];
  introVideoUri: string | null;
  introVideoDurationMs: number | null;
  savedAt: string;
};

export type ModerationReport = {
  id: string;
  reporterUserId: string;
  reporterName: string;
  reportedUserId: string;
  reportedName: string;
  reason: string;
  details: string;
  latestMessagePreview: string | null;
  createdAt: string;
  status: "pending" | "dismissed" | "confirmed";
  resolvedAt: string | null;
};

export type PersistedModerationState = {
  reports: ModerationReport[];
  penaltyPointsByUserId: Record<string, number>;
};

function cloneProfile(profile: RegistrationProfile): RegistrationProfile {
  return {
    ...profile,
    interests: [...profile.interests],
    greenFlags: [...profile.greenFlags],
    dealbreakers: [...profile.dealbreakers],
  };
}

function cloneSession(session: PersistedSession): PersistedSession {
  return {
    ...session,
    accessToken: typeof session.accessToken === "string" ? session.accessToken.trim() || null : null,
    phoneNumber: session.phoneNumber ?? null,
    photoUris: Array.isArray(session.photoUris) ? session.photoUris.filter(Boolean) : [],
    introVideoUri: typeof session.introVideoUri === "string" ? session.introVideoUri : null,
    introVideoDurationMs:
      typeof session.introVideoDurationMs === "number" && Number.isFinite(session.introVideoDurationMs)
        ? session.introVideoDurationMs
        : null,
    profile: cloneProfile(session.profile),
  };
}

function normalizeSessionHistory(value: unknown): PersistedSession[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is PersistedSession => Boolean(entry && typeof entry === "object"))
    .filter((entry) => Boolean(entry.userId && entry.profile))
    .map(cloneSession);
}

function upsertSessionHistory(
  sessions: PersistedSession[],
  nextSession: PersistedSession,
): PersistedSession[] {
  const deduped = sessions.filter((entry) => entry.userId !== nextSession.userId);
  return [cloneSession(nextSession), ...deduped].slice(0, maxRememberedSessions);
}

export async function loadPersistedSession(): Promise<PersistedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(sessionStorageKey);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedSession;

    if (!parsed?.userId || !parsed?.profile) {
      return null;
    }

    return cloneSession(parsed);
  } catch {
    return null;
  }
}

export async function loadRememberedSessions(): Promise<PersistedSession[]> {
  try {
    const raw = await AsyncStorage.getItem(sessionHistoryStorageKey);

    if (!raw) {
      return [];
    }

    return normalizeSessionHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function savePersistedSession(
  session: Omit<PersistedSession, "savedAt">,
): Promise<PersistedSession> {
  const payload: PersistedSession = {
    ...session,
    accessToken: typeof session.accessToken === "string" ? session.accessToken.trim() || null : null,
    phoneNumber: session.phoneNumber ?? null,
    photoUris: session.photoUris.filter(Boolean),
    introVideoUri: session.introVideoUri ?? null,
    introVideoDurationMs: session.introVideoDurationMs ?? null,
    profile: cloneProfile(session.profile),
    savedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(sessionStorageKey, JSON.stringify(payload));
  const currentHistory = await loadRememberedSessions();
  const nextHistory = upsertSessionHistory(currentHistory, payload);
  await AsyncStorage.setItem(sessionHistoryStorageKey, JSON.stringify(nextHistory));
  return payload;
}

export async function clearPersistedSession() {
  await AsyncStorage.removeItem(sessionStorageKey);
}

export async function removeRememberedSession(userId: string) {
  const currentHistory = await loadRememberedSessions();
  const nextHistory = currentHistory.filter((entry) => entry.userId !== userId);
  await AsyncStorage.setItem(sessionHistoryStorageKey, JSON.stringify(nextHistory));
}

export async function loadTransientState<T>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(transientStateStorageKey);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveTransientState<T>(state: T) {
  await AsyncStorage.setItem(transientStateStorageKey, JSON.stringify(state));
}

export async function clearTransientState() {
  await AsyncStorage.removeItem(transientStateStorageKey);
}

function normalizeModerationState(value: unknown): PersistedModerationState {
  if (!value || typeof value !== "object") {
    return {
      reports: [],
      penaltyPointsByUserId: {},
    };
  }

  const typed = value as Partial<PersistedModerationState>;

  return {
    reports: Array.isArray(typed.reports)
      ? typed.reports.filter((entry): entry is ModerationReport => Boolean(entry && typeof entry === "object" && entry.id))
      : [],
    penaltyPointsByUserId:
      typed.penaltyPointsByUserId && typeof typed.penaltyPointsByUserId === "object"
        ? Object.fromEntries(
            Object.entries(typed.penaltyPointsByUserId).filter(
              ([userId, points]) => Boolean(userId) && typeof points === "number" && Number.isFinite(points),
            ),
          )
        : {},
  };
}

export async function loadModerationState(): Promise<PersistedModerationState> {
  try {
    const raw = await AsyncStorage.getItem(moderationStateStorageKey);

    if (!raw) {
      return {
        reports: [],
        penaltyPointsByUserId: {},
      };
    }

    return normalizeModerationState(JSON.parse(raw));
  } catch {
    return {
      reports: [],
      penaltyPointsByUserId: {},
    };
  }
}

export async function saveModerationState(state: PersistedModerationState) {
  await AsyncStorage.setItem(moderationStateStorageKey, JSON.stringify(normalizeModerationState(state)));
}
