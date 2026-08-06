import { Prisma } from "@prisma/client";

export type PrivateQaRepeatConfig = {
  ownerUserId: string;
  repeatUntilBerlinDate: string;
  sharedInterests: string[];
};

function isValidDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function parsePrivateQaRepeatConfig(
  value: Prisma.JsonValue | null | undefined,
): PrivateQaRepeatConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const generatedBy = value.generatedBy;
  const ownerUserId = value.ownerUserId;
  const repeatUntilBerlinDate = value.repeatUntilBerlinDate;

  if (
    generatedBy !== "private-qa-match"
    || typeof ownerUserId !== "string"
    || typeof repeatUntilBerlinDate !== "string"
    || !isValidDateKey(repeatUntilBerlinDate)
  ) {
    return null;
  }

  const sharedInterests = Array.isArray(value.sharedInterests)
    ? value.sharedInterests.filter((interest): interest is string => typeof interest === "string")
    : [];

  return {
    ownerUserId,
    repeatUntilBerlinDate,
    sharedInterests,
  };
}

export function canRepeatPrivateQaMatch(
  config: PrivateQaRepeatConfig,
  ownerUserId: string,
  nextReleaseBerlinDate: string,
) {
  return config.ownerUserId === ownerUserId
    && nextReleaseBerlinDate <= config.repeatUntilBerlinDate;
}
