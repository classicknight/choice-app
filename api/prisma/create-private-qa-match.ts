import { getPrivateQaRepeatUntilDate, preparePrivateQaMatch } from "../src/lib/private-qa-match.js";
import { prisma } from "../src/lib/prisma.js";

function getRepeatUntilBerlinDate(now: Date) {
  const value = process.env.QA_REPEAT_UNTIL_BERLIN_DATE?.trim();

  if (!value) {
    return getPrivateQaRepeatUntilDate(now, 14);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : null;

  if (
    !match
    || !parsed
    || parsed.getUTCFullYear() !== Number(match[1])
    || parsed.getUTCMonth() !== Number(match[2]) - 1
    || parsed.getUTCDate() !== Number(match[3])
  ) {
    throw new Error("QA_REPEAT_UNTIL_BERLIN_DATE must use a valid YYYY-MM-DD date.");
  }

  return value;
}

function requireOwnerPhoneNumber() {
  const phoneNumber = process.env.QA_OWNER_PHONE_NUMBER?.trim();

  if (!phoneNumber) {
    throw new Error("QA_OWNER_PHONE_NUMBER is required.");
  }

  return phoneNumber;
}

async function main() {
  const ownerPhoneNumber = requireOwnerPhoneNumber();
  const now = new Date();
  const owner = await prisma.user.findUnique({
    where: { phoneNumber: ownerPhoneNumber },
    select: { id: true },
  });

  if (!owner) {
    throw new Error("The QA owner account could not be found.");
  }

  const result = await preparePrivateQaMatch({
    ownerUserId: owner.id,
    repeatUntilBerlinDate: getRepeatUntilBerlinDate(now),
    now,
  });

  console.log(JSON.stringify({
    ...result,
    scheduledFor: result.scheduledFor.toISOString(),
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
