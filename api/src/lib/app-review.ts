import {
  AuthProvider,
  MatchStatus,
  MessageKind,
  ParticipantDecision,
  PhaseTwoStage,
  Prisma,
} from "@prisma/client";
import { getBerlinDateAtTime } from "./berlin-time.js";
import { prisma } from "./prisma.js";

const REVIEW_EMAIL_SUFFIX = "@choice-review.local";
const REVIEW_ACCOUNT_EMAIL = `apple${REVIEW_EMAIL_SUFFIX}`;
const REVIEW_PARTNER_EMAIL = `mila${REVIEW_EMAIL_SUFFIX}`;

// App Review credentials only expose the isolated synthetic accounts below.
export const APP_REVIEW_PHONE_NUMBER = "+491713920042";
export const APP_REVIEW_CODE = "847822";

const reviewRounds = [
  {
    id: "review-spontaneity",
    prompt: "Ein freier Samstag liegt vor euch. Was passt am ehesten?",
    answerOptions: [],
  },
  {
    id: "review-communication",
    prompt: "Wie wichtig ist euch ein ehrlicher Umgang mit kleinen Unsicherheiten?",
    answerOptions: [],
  },
  {
    id: "review-closeness",
    prompt: "Wie entsteht für euch echte Nähe?",
    answerOptions: [],
  },
];

const reviewResults = [
  {
    roundId: "review-spontaneity",
    prompt: reviewRounds[0].prompt,
    personALabel: "Etwas Neues entdecken",
    personAScore: 4,
    followUpPrompt: "Wie spontan darf es sein?",
    followUpOptions: [],
    personBLabel: "Etwas Neues entdecken",
    personBScore: 4,
    compatibility: 100,
  },
  {
    roundId: "review-communication",
    prompt: reviewRounds[1].prompt,
    personALabel: "Direkt und respektvoll ansprechen",
    personAScore: 5,
    followUpPrompt: "Was hilft in dem Moment?",
    followUpOptions: [],
    personBLabel: "Erst kurz nachdenken, dann offen reden",
    personBScore: 4,
    compatibility: 75,
  },
  {
    roundId: "review-closeness",
    prompt: reviewRounds[2].prompt,
    personALabel: "Durch gemeinsame Erlebnisse",
    personAScore: 4,
    followUpPrompt: "Was bleibt besonders in Erinnerung?",
    followUpOptions: [],
    personBLabel: "Durch gemeinsame Erlebnisse",
    personBScore: 4,
    compatibility: 100,
  },
];

export function isAppReviewAccountEmail(email: string | null | undefined) {
  return email?.endsWith(REVIEW_EMAIL_SUFFIX) ?? false;
}

export async function ensureAppReviewDemoAccount(userId: string, phoneNumber: string) {
  const now = new Date();
  const scheduledFor = getBerlinDateAtTime(now, 9, 0, -7);

  const reviewUser = await prisma.user.update({
    where: { id: userId },
    data: {
      email: REVIEW_ACCOUNT_EMAIL,
      phoneNumber,
      authProvider: AuthProvider.PHONE,
      phoneVerifiedAt: now,
      profileCompleted: true,
      suspendedAt: null,
      penaltySuspendedAt: null,
      bannedAt: null,
      penaltyPoints: 0,
      profile: {
        upsert: {
          create: {
            firstName: "Alex",
            age: 28,
            city: "Berlin",
            selfDescription: "Kunst, spontane Zugreisen und gute Gespräche bei einem Kaffee.",
            pronouns: "er/ihm",
            identity: "hetero",
            lookingFor: "Frauen",
            datingIntent: "intentional-dating",
            ageRangeMin: 24,
            ageRangeMax: 32,
            interests: ["Kunst", "Reisen", "Konzerte", "Cafes"],
            dealbreaker: "Unklare Absichten",
            matchTime: "09:00",
            conversationStyle: "direct",
            avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
            photoUrls: [
              "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80",
            ],
          },
          update: {
            firstName: "Alex",
            age: 28,
            city: "Berlin",
            selfDescription: "Kunst, spontane Zugreisen und gute Gespräche bei einem Kaffee.",
            pronouns: "er/ihm",
            identity: "hetero",
            lookingFor: "Frauen",
            datingIntent: "intentional-dating",
            ageRangeMin: 24,
            ageRangeMax: 32,
            interests: ["Kunst", "Reisen", "Konzerte", "Cafes"],
            dealbreaker: "Unklare Absichten",
            matchTime: "09:00",
            conversationStyle: "direct",
            avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
            photoUrls: [
              "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80",
            ],
          },
        },
      },
    },
  });

  const reviewPartner = await prisma.user.upsert({
    where: { email: REVIEW_PARTNER_EMAIL },
    create: {
      email: REVIEW_PARTNER_EMAIL,
      authProvider: AuthProvider.EMAIL,
      emailVerifiedAt: now,
      profileCompleted: true,
      profile: {
        create: {
          firstName: "Mila",
          age: 26,
          city: "Berlin",
          selfDescription: "Flohmaerkte, kleine Konzerte und Plaene, die spontan besser werden.",
          pronouns: "sie/ihr",
          identity: "hetero",
          lookingFor: "Männer",
          datingIntent: "intentional-dating",
          ageRangeMin: 26,
          ageRangeMax: 34,
          interests: ["Kunst", "Reisen", "Cafes", "Flohmaerkte"],
          dealbreaker: "Unklare Absichten",
          matchTime: "09:00",
          conversationStyle: "warm",
          avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
          photoUrls: [
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
          ],
        },
      },
    },
    update: {
      profileCompleted: true,
      suspendedAt: null,
      penaltySuspendedAt: null,
      bannedAt: null,
      profile: {
        upsert: {
          create: {
            firstName: "Mila",
            age: 26,
            city: "Berlin",
            selfDescription: "Flohmaerkte, kleine Konzerte und Plaene, die spontan besser werden.",
            pronouns: "sie/ihr",
            identity: "hetero",
            lookingFor: "Männer",
            datingIntent: "intentional-dating",
            ageRangeMin: 26,
            ageRangeMax: 34,
            interests: ["Kunst", "Reisen", "Cafes", "Flohmaerkte"],
            dealbreaker: "Unklare Absichten",
            matchTime: "09:00",
            conversationStyle: "warm",
            avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
            photoUrls: [
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
            ],
          },
          update: {
            firstName: "Mila",
            age: 26,
            city: "Berlin",
            selfDescription: "Flohmaerkte, kleine Konzerte und Plaene, die spontan besser werden.",
            pronouns: "sie/ihr",
            identity: "hetero",
            lookingFor: "Männer",
            datingIntent: "intentional-dating",
            ageRangeMin: 26,
            ageRangeMax: 34,
            interests: ["Kunst", "Reisen", "Cafes", "Flohmaerkte"],
            dealbreaker: "Unklare Absichten",
            matchTime: "09:00",
            conversationStyle: "warm",
            avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
            photoUrls: [
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
              "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
            ],
          },
        },
      },
    },
  });

  const [userAId, userBId] = [reviewUser.id, reviewPartner.id].sort();
  const existingMatch = await prisma.match.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { userAId: userBId, userBId: userAId },
      ],
      status: MatchStatus.KEPT,
      closedAt: null,
    },
  });

  const matchData = {
    scheduledFor,
    activatedAt: scheduledFor,
    closedAt: null,
    status: MatchStatus.KEPT,
    userAId,
    userBId,
    phaseOneStarterUserId: reviewUser.id,
    userADecision: ParticipantDecision.KEEP,
    userBDecision: ParticipantDecision.KEEP,
    phaseThreeUserADecision: ParticipantDecision.KEEP,
    phaseThreeUserBDecision: ParticipantDecision.KEEP,
    phaseTwoStarterUserId: reviewUser.id,
    phaseTwoPartnerUserId: reviewPartner.id,
    phaseTwoStage: PhaseTwoStage.RESULT,
    phaseTwoRoundIndex: reviewRounds.length - 1,
    phaseTwoRounds: reviewRounds as Prisma.InputJsonValue,
    phaseTwoResults: reviewResults as Prisma.InputJsonValue,
    compatibility: 0.92,
    rationale: {
      sharedInterests: ["Kunst", "Reisen", "Cafes"],
      generatedBy: "app-review-demo",
    },
  } satisfies Prisma.MatchUncheckedCreateInput;

  const reviewMatch = existingMatch
    ? await prisma.match.update({ where: { id: existingMatch.id }, data: matchData })
    : await prisma.match.create({ data: matchData });

  const chat = await prisma.chat.upsert({
    where: { matchId: reviewMatch.id },
    create: {
      matchId: reviewMatch.id,
      members: {
        create: [{ userId: reviewUser.id }, { userId: reviewPartner.id }],
      },
    },
    update: {
      archivedAt: null,
    },
  });

  const messageCount = await prisma.message.count({ where: { chatId: chat.id } });

  if (messageCount === 0) {
    const messageStart = new Date(scheduledFor.getTime() + 30 * 60 * 1000);
    await prisma.message.createMany({
      data: [
        {
          chatId: chat.id,
          senderId: reviewPartner.id,
          kind: MessageKind.TEXT,
          body: "Hey Alex, deine spontanen Zugreisen haben mich direkt neugierig gemacht.",
          createdAt: messageStart,
        },
        {
          chatId: chat.id,
          senderId: reviewUser.id,
          kind: MessageKind.TEXT,
          body: "Dann hat Choice wohl ziemlich genau hingeschaut. Was war dein bestes spontanes Reiseziel?",
          createdAt: new Date(messageStart.getTime() + 3 * 60 * 1000),
        },
        {
          chatId: chat.id,
          senderId: reviewPartner.id,
          kind: MessageKind.TEXT,
          body: "Definitiv Kopenhagen. Freitag gebucht, Samstag im Zug. Und bei dir?",
          createdAt: new Date(messageStart.getTime() + 6 * 60 * 1000),
        },
        {
          chatId: chat.id,
          senderId: reviewUser.id,
          kind: MessageKind.TEXT,
          body: "Lissabon. Eigentlich nur fuer ein Wochenende, am Ende wurden es fuenf Tage.",
          createdAt: new Date(messageStart.getTime() + 9 * 60 * 1000),
        },
        {
          chatId: chat.id,
          senderId: reviewPartner.id,
          kind: MessageKind.TEXT,
          body: "Das klingt nach einer Geschichte, die ich bei einem Kaffee hoeren will.",
          createdAt: new Date(messageStart.getTime() + 12 * 60 * 1000),
        },
      ],
    });
  }
}
