import {
  AuthProvider,
  MatchStatus,
  ParticipantDecision,
  Prisma,
} from "@prisma/client";
import { getBerlinDateKey, getNextBerlinDateAtTime } from "../src/lib/berlin-time.js";
import { prisma } from "../src/lib/prisma.js";
import { sendPushNotificationOnce } from "../src/lib/push-notifications.js";
import { isPrivateQaAccountEmail } from "../src/lib/synthetic-accounts.js";

const privateQaEmail = "alex-private.qa@choice.local";
const privateQaFirstName = "Mara";

function requireOwnerPhoneNumber() {
  const phoneNumber = process.env.QA_OWNER_PHONE_NUMBER?.trim();

  if (!phoneNumber) {
    throw new Error("QA_OWNER_PHONE_NUMBER is required.");
  }

  return phoneNumber;
}

function getParticipantDecisions(ownerUserId: string, userAId: string) {
  const ownerIsUserA = ownerUserId === userAId;

  return {
    userADecision: ownerIsUserA ? ParticipantDecision.UNDECIDED : ParticipantDecision.KEEP,
    userBDecision: ownerIsUserA ? ParticipantDecision.KEEP : ParticipantDecision.UNDECIDED,
    phaseThreeUserADecision: ownerIsUserA ? ParticipantDecision.UNDECIDED : ParticipantDecision.KEEP,
    phaseThreeUserBDecision: ownerIsUserA ? ParticipantDecision.KEEP : ParticipantDecision.UNDECIDED,
  };
}

async function main() {
  const ownerPhoneNumber = requireOwnerPhoneNumber();
  const now = new Date();
  const scheduledFor = getNextBerlinDateAtTime(now, 9, 0);
  const owner = await prisma.user.findUnique({
    where: { phoneNumber: ownerPhoneNumber },
    include: { profile: true },
  });

  if (!owner?.profile || !owner.profileCompleted) {
    throw new Error("The QA owner account does not have a completed profile.");
  }

  const ownerProfile = owner.profile;

  const openMatches = await prisma.match.findMany({
    where: {
      OR: [{ userAId: owner.id }, { userBId: owner.id }],
      status: { in: [MatchStatus.PENDING, MatchStatus.ACTIVE, MatchStatus.KEPT] },
      closedAt: null,
    },
    include: {
      userA: { select: { email: true } },
      userB: { select: { email: true } },
    },
  });

  const realOpenMatch = openMatches.find((match) => {
    const partnerEmail = match.userAId === owner.id ? match.userB.email : match.userA.email;
    return !isPrivateQaAccountEmail(partnerEmail);
  });

  if (realOpenMatch) {
    throw new Error("The QA owner already has a real open match. Nothing was changed.");
  }

  const qaPartner = await prisma.user.upsert({
    where: { email: privateQaEmail },
    update: {
      authProvider: AuthProvider.EMAIL,
      emailVerifiedAt: now,
      profileCompleted: true,
      suspendedAt: null,
      penaltySuspendedAt: null,
      bannedAt: null,
      profile: {
        upsert: {
          update: {
            firstName: privateQaFirstName,
            age: 25,
            city: "Dortmund, Nordrhein-Westfalen",
            selfDescription: "Konzerte, kleine Cafes und spontane Ausfluege. Ich mag offene Gespraeche und Menschen, die herzlich lachen koennen.",
            pronouns: "sie/ihr",
            identity: "hetero",
            lookingFor: "Männer",
            datingIntent: "intentional-dating",
            ageRangeMin: 20,
            ageRangeMax: 32,
            interests: ["Musik", "Reisen", "Konzerte", "Cafes"],
            dealbreaker: "Pro: Ehrlichkeit, Humor, echtes Interesse | No-Gos: Respektlosigkeit, unklare Absichten",
            matchTime: "09:00",
            conversationStyle: "warm",
            avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
            photoUrls: [
              "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80&sat=-10",
            ],
          },
          create: {
            firstName: privateQaFirstName,
            age: 25,
            city: "Dortmund, Nordrhein-Westfalen",
            selfDescription: "Konzerte, kleine Cafes und spontane Ausfluege. Ich mag offene Gespraeche und Menschen, die herzlich lachen koennen.",
            pronouns: "sie/ihr",
            identity: "hetero",
            lookingFor: "Männer",
            datingIntent: "intentional-dating",
            ageRangeMin: 20,
            ageRangeMax: 32,
            interests: ["Musik", "Reisen", "Konzerte", "Cafes"],
            dealbreaker: "Pro: Ehrlichkeit, Humor, echtes Interesse | No-Gos: Respektlosigkeit, unklare Absichten",
            matchTime: "09:00",
            conversationStyle: "warm",
            avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
            photoUrls: [
              "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80&sat=-10",
            ],
          },
        },
      },
    },
    create: {
      email: privateQaEmail,
      authProvider: AuthProvider.EMAIL,
      emailVerifiedAt: now,
      profileCompleted: true,
      profile: {
        create: {
          firstName: privateQaFirstName,
          age: 25,
          city: "Dortmund, Nordrhein-Westfalen",
          selfDescription: "Konzerte, kleine Cafes und spontane Ausfluege. Ich mag offene Gespraeche und Menschen, die herzlich lachen koennen.",
          pronouns: "sie/ihr",
          identity: "hetero",
          lookingFor: "Männer",
          datingIntent: "intentional-dating",
          ageRangeMin: 20,
          ageRangeMax: 32,
          interests: ["Musik", "Reisen", "Konzerte", "Cafes"],
          dealbreaker: "Pro: Ehrlichkeit, Humor, echtes Interesse | No-Gos: Respektlosigkeit, unklare Absichten",
          matchTime: "09:00",
          conversationStyle: "warm",
          avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
          photoUrls: [
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80&sat=-10",
          ],
        },
      },
    },
  });

  const [userAId, userBId] = [owner.id, qaPartner.id].sort();
  const decisions = getParticipantDecisions(owner.id, userAId);
  const privateOpenMatchIds = openMatches.map((match) => match.id);

  const match = await prisma.$transaction(async (transaction) => {
    if (privateOpenMatchIds.length) {
      await transaction.match.deleteMany({
        where: { id: { in: privateOpenMatchIds } },
      });
    }

    // Makes rerunning the script for the same release time idempotent.
    await transaction.match.deleteMany({
      where: {
        scheduledFor,
        OR: [
          { userAId: owner.id, userBId: qaPartner.id },
          { userAId: qaPartner.id, userBId: owner.id },
        ],
      },
    });

    return transaction.match.create({
      data: {
        scheduledFor,
        status: MatchStatus.PENDING,
        userAId,
        userBId,
        phaseOneStarterUserId: owner.id,
        ...decisions,
        compatibility: 0.92,
        rationale: {
          generatedBy: "private-qa-match",
          ownerUserId: owner.id,
          sharedInterests: ownerProfile.interests.filter((interest) =>
            ["Musik", "Reisen", "Konzerte", "Cafes"].includes(interest),
          ),
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  const releaseDayLabel = getBerlinDateKey(scheduledFor) === getBerlinDateKey(now) ? "heute" : "morgen";

  const push = await sendPushNotificationOnce({
    userId: owner.id,
    matchId: match.id,
    kind: "private-qa-match-prepared",
    contextKey: `private-qa-match-prepared:${match.id}:${owner.id}`,
    payload: {
      title: "Dein privates Test-Match ist vorbereitet",
      body: `Dein Match wird ${releaseDayLabel} um 09:00 Uhr für dich freigeschaltet.`,
      channelId: "match-releases",
      data: {
        type: "private-qa-match-prepared",
        matchId: match.id,
      },
    },
  });

  console.log(JSON.stringify({
    matchId: match.id,
    scheduledFor: match.scheduledFor.toISOString(),
    pushSent: push.sent,
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
