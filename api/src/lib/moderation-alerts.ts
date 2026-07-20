import type { FastifyBaseLogger } from "fastify";

type SendNewReportAlertInput = {
  adminDashboardUrl: string;
  apiKey?: string;
  createdAt: Date;
  details?: string | null;
  fromEmail: string;
  latestMessagePreview?: string | null;
  logger: FastifyBaseLogger;
  matchId?: string | null;
  reason: string;
  recipientsRaw: string;
  reportId: string;
  reportedLabel: string;
  reporterLabel: string;
};

function parseRecipients(rawValue: string) {
  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function sendNewReportAlert(input: SendNewReportAlertInput) {
  const recipients = parseRecipients(input.recipientsRaw);

  if (!input.apiKey?.trim()) {
    input.logger.warn({ reportId: input.reportId }, "Skipping moderation alert email because RESEND_API_KEY is missing.");
    return { sent: false as const, reason: "MISSING_API_KEY" as const };
  }

  if (!recipients.length) {
    input.logger.warn({ reportId: input.reportId }, "Skipping moderation alert email because no moderation recipients are configured.");
    return { sent: false as const, reason: "MISSING_RECIPIENTS" as const };
  }

  const formattedCreatedAt = input.createdAt.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });
  const text = [
    "Neue Choice-Meldung eingegangen",
    "",
    `Report-ID: ${input.reportId}`,
    `Zeitpunkt: ${formattedCreatedAt}`,
    `Gemeldete Person: ${input.reportedLabel}`,
    `Meldende Person: ${input.reporterLabel}`,
    `Grund: ${input.reason}`,
    input.details ? `Details: ${input.details}` : null,
    input.latestMessagePreview ? `Letzte Nachricht: ${input.latestMessagePreview}` : null,
    input.matchId ? `Match-ID: ${input.matchId}` : null,
    "",
    "Prüfziel: möglichst innerhalb von 24 Stunden sichten.",
    `Admin-Dashboard: ${input.adminDashboardUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.fromEmail,
      to: recipients,
      subject: `Neue Choice-Meldung: ${input.reason}`,
      text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    input.logger.error(
      {
        reportId: input.reportId,
        status: response.status,
        responseText,
      },
      "Failed to send moderation alert email.",
    );
    return { sent: false as const, reason: "DELIVERY_FAILED" as const };
  }

  return { sent: true as const };
}
