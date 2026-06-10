import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const matchNotificationChannelId = "match-releases";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let notificationsPrepared = false;

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
