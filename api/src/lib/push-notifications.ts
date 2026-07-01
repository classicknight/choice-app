import { prisma } from "./prisma.js";

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
  channelId?: string;
};

type ExpoPushTicket = {
  status?: "ok" | "error";
  details?: {
    error?: string;
  };
};

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";

function isExpoPushToken(value: string) {
  return /^ExponentPushToken\[.+\]$/.test(value) || /^ExpoPushToken\[.+\]$/.test(value);
}

export async function registerPushDevice(input: {
  userId: string;
  token: string;
  platform?: string;
}) {
  const token = input.token.trim();

  if (!token || !isExpoPushToken(token)) {
    return {
      ok: false as const,
      reason: "INVALID_PUSH_TOKEN" as const,
    };
  }

  await prisma.pushDevice.upsert({
    where: { token },
    update: {
      userId: input.userId,
      platform: input.platform?.trim() || null,
      disabledAt: null,
      lastSeenAt: new Date(),
    },
    create: {
      userId: input.userId,
      token,
      platform: input.platform?.trim() || null,
      lastSeenAt: new Date(),
    },
  });

  return {
    ok: true as const,
  };
}

async function disablePushToken(token: string) {
  await prisma.pushDevice.updateMany({
    where: {
      token,
      disabledAt: null,
    },
    data: {
      disabledAt: new Date(),
    },
  });
}

export async function sendPushNotificationToUser(userId: string, payload: PushPayload) {
  const devices = await prisma.pushDevice.findMany({
    where: {
      userId,
      disabledAt: null,
    },
    select: {
      token: true,
    },
  });

  const tokens = devices
    .map((entry) => entry.token.trim())
    .filter((entry) => isExpoPushToken(entry));

  if (!tokens.length) {
    return {
      ok: true as const,
      sent: 0,
    };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    channelId: payload.channelId,
  }));

  try {
    const response = await fetch(expoPushEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const parsed = (await response.json().catch(() => null)) as { data?: ExpoPushTicket[] } | null;

    if (!response.ok || !parsed?.data) {
      return {
        ok: false as const,
        sent: 0,
      };
    }

    await Promise.all(
      parsed.data.map(async (ticket, index) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          await disablePushToken(tokens[index] ?? "");
        }
      }),
    );

    return {
      ok: true as const,
      sent: tokens.length,
    };
  } catch {
    return {
      ok: false as const,
      sent: 0,
    };
  }
}
