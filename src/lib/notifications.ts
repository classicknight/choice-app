import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

const matchNotificationChannelId = "match-releases";
const phaseNotificationChannelId = "phase-updates";
const fairPlayNotificationChannelId = "fair-play";
const chatNotificationChannelId = "chat-messages";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let notificationsPrepared = false;

export type JourneyLocalNotificationPlan = {
  ownerUserId: string;
  key: string;
  date: Date;
  title: string;
  body: string;
  kind: "phase" | "warning";
  data?: Record<string, string | number | boolean | null>;
};

function normalizeNotificationData(data: Notifications.NotificationContentInput["data"]) {
  if (!data || typeof data !== "object") {
    return {};
  }

  return data as Record<string, unknown>;
}

export async function prepareLocalNotifications() {
  if (notificationsPrepared) {
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(matchNotificationChannelId, {
      name: "Neue Matches",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: "#ff427c",
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync(phaseNotificationChannelId, {
      name: "Choice Phasen",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: "#94d2ff",
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync(fairPlayNotificationChannelId, {
      name: "Fair Play",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 280, 180, 280],
      lightColor: "#ff7b9d",
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync(chatNotificationChannelId, {
      name: "Chat Nachrichten",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: "#8be9a8",
      sound: "default",
    });
  }

  notificationsPrepared = true;
}

export async function ensureLocalNotificationPermission() {
  await prepareLocalNotifications();

  const existing = await Notifications.getPermissionsAsync();

  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function scheduleMatchReleaseNotification(releaseAt: Date, matchName?: string) {
  const hasPermission = await ensureLocalNotificationPermission();

  if (!hasPermission || releaseAt.getTime() <= Date.now()) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Dein neues Match ist da",
      body: matchName
        ? `${matchName} wurde gerade für dich freigeschaltet.`
        : "Choice hat gerade ein neues Match für dich freigegeben.",
      sound: "default",
      data: {
        type: "match-release",
        releaseAt: releaseAt.toISOString(),
      },
      ...(Platform.OS === "android"
        ? {
            channelId: matchNotificationChannelId,
          }
        : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: releaseAt,
    },
  });
}

export async function cancelScheduledLocalNotification(notificationId: string | null | undefined) {
  if (!notificationId) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Ignore stale notification ids.
  }
}

export async function syncJourneyLocalNotifications(
  ownerUserId: string,
  plans: readonly JourneyLocalNotificationPlan[],
) {
  const hasPermission = await ensureLocalNotificationPermission();

  if (!hasPermission) {
    return;
  }

  const now = Date.now();
  const nextPlans = plans
    .filter((entry) => entry.ownerUserId === ownerUserId)
    .filter((entry) => entry.date.getTime() > now);

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const relevant = scheduled.filter((entry) => {
    const data = normalizeNotificationData(entry.content.data);
    return data.scope === "choice-journey" && data.ownerUserId === ownerUserId;
  });

  const existingByKey = new Map(
    relevant.map((entry) => {
      const data = normalizeNotificationData(entry.content.data);
      return [
        String(data.notificationKey ?? ""),
        {
          id: entry.identifier,
          scheduledAt: typeof data.scheduledAt === "string" ? data.scheduledAt : null,
        },
      ] as const;
    }),
  );

  const nextKeys = new Set(nextPlans.map((entry) => entry.key));

  await Promise.all(
    relevant.map(async (entry) => {
      const data = normalizeNotificationData(entry.content.data);
      const key = typeof data.notificationKey === "string" ? data.notificationKey : null;

      if (!key || !nextKeys.has(key)) {
        await Notifications.cancelScheduledNotificationAsync(entry.identifier);
      }
    }),
  );

  for (const plan of nextPlans) {
    const scheduledAt = plan.date.toISOString();
    const existing = existingByKey.get(plan.key);

    if (existing?.scheduledAt === scheduledAt) {
      continue;
    }

    if (existing?.id) {
      await Notifications.cancelScheduledNotificationAsync(existing.id);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: plan.title,
        body: plan.body,
        sound: "default",
        data: {
          scope: "choice-journey",
          ownerUserId,
          notificationKey: plan.key,
          scheduledAt,
          notificationKind: plan.kind,
          ...(plan.data ?? {}),
        },
        ...(Platform.OS === "android"
          ? {
              channelId: plan.kind === "warning" ? fairPlayNotificationChannelId : phaseNotificationChannelId,
            }
          : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: plan.date,
      },
    });
  }
}

export async function clearJourneyLocalNotifications(ownerUserId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  await Promise.all(
    scheduled.map(async (entry) => {
      const data = normalizeNotificationData(entry.content.data);

      if (data.scope === "choice-journey" && data.ownerUserId === ownerUserId) {
        await Notifications.cancelScheduledNotificationAsync(entry.identifier);
      }
    }),
  );
}

export async function getExpoPushToken() {
  const hasPermission = await ensureLocalNotificationPermission();

  if (!hasPermission) {
    return null;
  }

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data ?? null;
  } catch {
    return null;
  }
}
