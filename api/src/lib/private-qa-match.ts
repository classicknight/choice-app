import {
  AuthProvider,
  MatchStatus,
  ParticipantDecision,
  Prisma,
} from "@prisma/client";
import {
  getBerlinDateAtTime,
  getBerlinDateKey,
  getNextBerlinDateAtTime,
} from "./berlin-time.js";
import { prisma } from "./prisma.js";
import { sendPushNotificationOnce } from "./push-notifications.js";
import {
  PRIVATE_QA_EMAIL_SUFFIX,
  isPrivateQaAccountEmail,
  isSyntheticMatchingAccountEmail,
} from "./synthetic-accounts.js";

type PrivateQaProfileTemplate = {
  id: string;
  firstName: string;
  age: number;
  city: string;
  selfDescription: string;
  interests: string[];
  dealbreaker: string;
  conversationStyle: string;
  imageUri: string;
};

type PrivateQaOwner = Prisma.UserGetPayload<{ include: { profile: true } }>;
type EligiblePrivateQaOwner = PrivateQaOwner & { profile: NonNullable<PrivateQaOwner["profile"]> };

const PRIVATE_QA_PROFILES: PrivateQaProfileTemplate[] = [
  {
    id: "mara",
    firstName: "Mara",
    age: 25,
    city: "Dortmund",
    selfDescription: "Konzerte, kleine Cafes und spontane Ausfluege. Ich mag offene Gespraeche und Menschen, die herzlich lachen koennen.",
    interests: ["Musik", "Reisen", "Konzerte", "Cafes"],
    dealbreaker: "Pro: Ehrlichkeit, Humor, echtes Interesse | No-Gos: Respektlosigkeit, unklare Absichten",
    conversationStyle: "warm",
    imageUri: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "mila",
    firstName: "Mila",
    age: 26,
    city: "Berlin",
    selfDescription: "Kunst, Flohmaerkte und lange Sonntage im Cafe. Ich mag Menschen, die neugierig bleiben und konkrete Plaene machen.",
    interests: ["Kunst", "Flohmaerkte", "Cafes", "Reisen"],
    dealbreaker: "Pro: Neugier, Verlaesslichkeit, Humor | No-Gos: Unklare Absichten, Ghosting",
    conversationStyle: "playful",
    imageUri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "lina",
    firstName: "Lina",
    age: 24,
    city: "Koeln",
    selfDescription: "Buecher, kleine Ausstellungen und gute Filme. Ich freue mich ueber Gespraeche, die nicht nach drei Nachrichten enden.",
    interests: ["Lesen", "Kunst", "Filme", "Cafes"],
    dealbreaker: "Pro: Gute Fragen, Empathie, Initiative | No-Gos: Respektlosigkeit, direkt sexualisieren",
    conversationStyle: "thoughtful",
    imageUri: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "zoe",
    firstName: "Zoe",
    age: 27,
    city: "Hamburg",
    selfDescription: "Laufen am Wasser, Wochenendtrips und Espresso. Ich bin spontan, aber bei wichtigen Dingen ziemlich klar.",
    interests: ["Running", "Reisen", "Cafes", "Spaziergaenge"],
    dealbreaker: "Pro: Offenheit, Eigenstaendigkeit, klare Kommunikation | No-Gos: Lovebombing, Spielchen",
    conversationStyle: "direct",
    imageUri: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "clara",
    firstName: "Clara",
    age: 29,
    city: "Muenchen",
    selfDescription: "Ich koche gern fuer Freunde, gehe in Museen und brauche regelmaessig eine Runde an der frischen Luft.",
    interests: ["Kochen", "Museen", "Spaziergaenge", "Fotografie"],
    dealbreaker: "Pro: Verbindlichkeit, Freundlichkeit, Humor | No-Gos: Kurzfristige Absagen, Arroganz",
    conversationStyle: "clear",
    imageUri: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "nika",
    firstName: "Nika",
    age: 28,
    city: "Frankfurt",
    selfDescription: "Zwischen Yoga, Tech und neuen Ausstellungen bleibt immer Zeit fuer einen Kaffee und ein gutes Gespraech.",
    interests: ["Museen", "Tech", "Yoga", "Cafes"],
    dealbreaker: "Pro: Eigene Interessen, Offenheit, Initiative | No-Gos: Nur ueber sich sprechen, Unhoeflichkeit",
    conversationStyle: "energetic",
    imageUri: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "jule",
    firstName: "Jule",
    age: 27,
    city: "Duesseldorf",
    selfDescription: "Gutes Essen, Konzerte und Spaziergaenge ohne festes Ziel. Ich mag Leichtigkeit, solange man trotzdem ehrlich bleibt.",
    interests: ["Konzerte", "Kochen", "Spaziergaenge", "Reisen"],
    dealbreaker: "Pro: Humor, Ehrlichkeit, Verbindlichkeit | No-Gos: Tagelang nicht antworten, Spielchen",
    conversationStyle: "light",
    imageUri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "emma",
    firstName: "Emma",
    age: 25,
    city: "Leipzig",
    selfDescription: "Live-Musik, neue Restaurants und kleine Reisen am Wochenende. Ich mag Humor, aber auch Gespraeche mit etwas Tiefe.",
    interests: ["Musik", "Restaurants", "Reisen", "Konzerte"],
    dealbreaker: "Pro: Humor, Aufmerksamkeit, Eigeninitiative | No-Gos: Respektlosigkeit, staendiges Absagen",
    conversationStyle: "warm",
    imageUri: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "sophie",
    firstName: "Sophie",
    age: 28,
    city: "Hannover",
    selfDescription: "Fotografie, gutes Fruehstueck und Abende mit Freunden. Ich finde es schoen, wenn Interesse nicht nur behauptet, sondern gezeigt wird.",
    interests: ["Fotografie", "Cafes", "Freunde", "Reisen"],
    dealbreaker: "Pro: Verlaesslichkeit, Waerme, gute Fragen | No-Gos: Ghosting, abwertende Kommentare",
    conversationStyle: "thoughtful",
    imageUri: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "lea",
    firstName: "Lea",
    age: 26,
    city: "Muenster",
    selfDescription: "Fahrradtouren, Podcasts und Flohmaerkte. Ich bin gern spontan, solange man ehrlich miteinander umgeht.",
    interests: ["Podcasts", "Flohmaerkte", "Spaziergaenge", "Cafes"],
    dealbreaker: "Pro: Offenheit, Humor, klare Kommunikation | No-Gos: Spielchen, Unpuenktlichkeit ohne Nachricht",
    conversationStyle: "playful",
    imageUri: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "amira",
    firstName: "Amira",
    age: 27,
    city: "Essen",
    selfDescription: "Kochen, Design und lange Spaziergaenge mit einem Kaffee in der Hand. Ich schaetze Menschen, die wissen, was sie wollen.",
    interests: ["Kochen", "Design", "Spaziergaenge", "Cafes"],
    dealbreaker: "Pro: Klarheit, Empathie, Verbindlichkeit | No-Gos: Unehrlichkeit, Druck machen",
    conversationStyle: "clear",
    imageUri: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "hannah",
    firstName: "Hannah",
    age: 29,
    city: "Bremen",
    selfDescription: "Buecher, Kino und Ausfluege ans Wasser. Ich mag ruhige Souveraenitaet und Menschen, die auch ueber sich selbst lachen koennen.",
    interests: ["Lesen", "Filme", "Reisen", "Spaziergaenge"],
    dealbreaker: "Pro: Selbstreflexion, Humor, Ehrlichkeit | No-Gos: Arroganz, widerspruechliche Absichten",
    conversationStyle: "calm",
    imageUri: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?auto=format&fit=crop&w=1200&q=80",
  },
];

export class PrivateQaMatchError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PrivateQaMatchError";
  }
}

function stableHash(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function getRotationOffset(rotationKey?: string) {
  if (!rotationKey) {
    return 0;
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rotationKey);

  if (!dateMatch) {
    return stableHash(rotationKey);
  }

  return Math.floor(Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
  ) / 86_400_000);
}

export function getPrivateQaProfileForOwner(ownerUserId: string, rotationKey?: string) {
  return PRIVATE_QA_PROFILES[
    (stableHash(ownerUserId) + getRotationOffset(rotationKey)) % PRIVATE_QA_PROFILES.length
  ];
}

export function getUnseenPrivateQaProfileForOwner(
  ownerUserId: string,
  rotationKey: string,
  previouslyMatchedProfileIds: ReadonlySet<string>,
) {
  const startIndex = (stableHash(ownerUserId) + getRotationOffset(rotationKey)) % PRIVATE_QA_PROFILES.length;

  for (let offset = 0; offset < PRIVATE_QA_PROFILES.length; offset += 1) {
    const template = PRIVATE_QA_PROFILES[(startIndex + offset) % PRIVATE_QA_PROFILES.length];

    if (!previouslyMatchedProfileIds.has(template.id)) {
      return template;
    }
  }

  return null;
}

export function getPrivateQaPartnerEmail(ownerUserId: string, profileTemplateId?: string) {
  const safeOwnerId = ownerUserId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const safeProfileId = profileTemplateId?.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return `tester-${safeOwnerId}${safeProfileId ? `-${safeProfileId}` : ""}.qa@choice.local`;
}

export function getPrivateQaRepeatUntilDate(now: Date, repeatDays: number) {
  return getBerlinDateKey(getBerlinDateAtTime(now, 9, 0, repeatDays));
}

function clampProfileAge(templateAge: number, ageRangeMin: number, ageRangeMax: number) {
  return Math.min(Math.max(templateAge, ageRangeMin), ageRangeMax);
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

async function loadEligiblePrivateQaOwner(ownerUserId: string) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    include: { profile: true },
  });

  if (!owner) {
    throw new PrivateQaMatchError("USER_NOT_FOUND");
  }

  if (isSyntheticMatchingAccountEmail(owner.email)) {
    throw new PrivateQaMatchError("SYNTHETIC_OWNER_NOT_ALLOWED");
  }

  if (!owner.profile || !owner.profileCompleted) {
    throw new PrivateQaMatchError("PROFILE_NOT_COMPLETED");
  }

  if (owner.suspendedAt || owner.penaltySuspendedAt || owner.bannedAt) {
    throw new PrivateQaMatchError("ACCOUNT_NOT_ACTIVE");
  }

  return owner as EligiblePrivateQaOwner;
}

export async function getOrCreatePrivateQaPartner({
  ownerUserId,
  rotationKey,
  now = new Date(),
}: {
  ownerUserId: string;
  rotationKey: string;
  now?: Date;
}) {
  const owner = await loadEligiblePrivateQaOwner(ownerUserId);
  const previousQaMatches = await prisma.match.findMany({
    where: {
      AND: [
        { OR: [{ userAId: owner.id }, { userBId: owner.id }] },
        {
          OR: [
            { userA: { email: { endsWith: PRIVATE_QA_EMAIL_SUFFIX } } },
            { userB: { email: { endsWith: PRIVATE_QA_EMAIL_SUFFIX } } },
          ],
        },
      ],
    },
    select: {
      userAId: true,
      userBId: true,
      userA: { select: { email: true } },
      userB: { select: { email: true } },
    },
  });
  const previouslyMatchedProfileIds = new Set<string>();

  for (const previousMatch of previousQaMatches) {
    const partnerEmail = previousMatch.userAId === owner.id
      ? previousMatch.userB.email
      : previousMatch.userA.email;

    for (const profile of PRIVATE_QA_PROFILES) {
      if (partnerEmail === getPrivateQaPartnerEmail(owner.id, profile.id)) {
        previouslyMatchedProfileIds.add(profile.id);
      }
    }
  }

  const template = getUnseenPrivateQaProfileForOwner(owner.id, rotationKey, previouslyMatchedProfileIds);

  if (!template) {
    throw new PrivateQaMatchError("NO_UNSEEN_PRIVATE_QA_PROFILE");
  }

  const qaPartnerEmail = getPrivateQaPartnerEmail(owner.id, template.id);
  const qaPartnerAge = clampProfileAge(template.age, owner.profile.ageRangeMin, owner.profile.ageRangeMax);
  const ownerTarget = owner.profile.pronouns === "er/ihm"
    ? "Männer"
    : owner.profile.pronouns === "sie/ihr"
      ? "Frauen"
      : "Alle";
  const photoUrls = [
    template.imageUri,
    `${template.imageUri}&sat=-8`,
    `${template.imageUri}&h=1600`,
  ];
  const partner = await prisma.user.upsert({
    where: { email: qaPartnerEmail },
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
            firstName: template.firstName,
            age: qaPartnerAge,
            city: template.city,
            selfDescription: `${template.selfDescription} Choice-Testprofil fuer die geschlossene Testphase.`,
            pronouns: "sie/ihr",
            identity: "hetero",
            lookingFor: ownerTarget,
            datingIntent: "intentional-dating",
            ageRangeMin: Math.max(18, owner.profile.age - 4),
            ageRangeMax: owner.profile.age + 4,
            interests: template.interests,
            dealbreaker: template.dealbreaker,
            matchTime: "09:00",
            conversationStyle: template.conversationStyle,
            avatarUrl: template.imageUri,
            photoUrls,
          },
          create: {
            firstName: template.firstName,
            age: qaPartnerAge,
            city: template.city,
            selfDescription: `${template.selfDescription} Choice-Testprofil fuer die geschlossene Testphase.`,
            pronouns: "sie/ihr",
            identity: "hetero",
            lookingFor: ownerTarget,
            datingIntent: "intentional-dating",
            ageRangeMin: Math.max(18, owner.profile.age - 4),
            ageRangeMax: owner.profile.age + 4,
            interests: template.interests,
            dealbreaker: template.dealbreaker,
            matchTime: "09:00",
            conversationStyle: template.conversationStyle,
            avatarUrl: template.imageUri,
            photoUrls,
          },
        },
      },
    },
    create: {
      email: qaPartnerEmail,
      authProvider: AuthProvider.EMAIL,
      emailVerifiedAt: now,
      profileCompleted: true,
      profile: {
        create: {
          firstName: template.firstName,
          age: qaPartnerAge,
          city: template.city,
          selfDescription: `${template.selfDescription} Choice-Testprofil fuer die geschlossene Testphase.`,
          pronouns: "sie/ihr",
          identity: "hetero",
          lookingFor: ownerTarget,
          datingIntent: "intentional-dating",
          ageRangeMin: Math.max(18, owner.profile.age - 4),
          ageRangeMax: owner.profile.age + 4,
          interests: template.interests,
          dealbreaker: template.dealbreaker,
          matchTime: "09:00",
          conversationStyle: template.conversationStyle,
          avatarUrl: template.imageUri,
          photoUrls,
        },
      },
    },
  });
  const sharedInterests = owner.profile.interests.filter((interest) => template.interests.includes(interest));

  return { owner, partner, template, sharedInterests };
}

export async function preparePrivateQaMatch({
  ownerUserId,
  repeatUntilBerlinDate,
  now = new Date(),
}: {
  ownerUserId: string;
  repeatUntilBerlinDate: string | null;
  now?: Date;
}) {
  const scheduledFor = getNextBerlinDateAtTime(now, 9, 0);
  const { owner, partner: qaPartner, template, sharedInterests } = await getOrCreatePrivateQaPartner({
    ownerUserId,
    rotationKey: getBerlinDateKey(scheduledFor),
    now,
  });

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
    return !isSyntheticMatchingAccountEmail(partnerEmail);
  });

  if (realOpenMatch) {
    throw new PrivateQaMatchError("REAL_OPEN_MATCH_EXISTS");
  }

  const [userAId, userBId] = [owner.id, qaPartner.id].sort();
  const decisions = getParticipantDecisions(owner.id, userAId);
  const privateOpenMatchIds = openMatches
    .filter((match) => {
      const partnerEmail = match.userAId === owner.id ? match.userB.email : match.userA.email;
      return isPrivateQaAccountEmail(partnerEmail);
    })
    .map((match) => match.id);
  const match = await prisma.$transaction(async (transaction) => {
    if (privateOpenMatchIds.length) {
      await transaction.match.deleteMany({ where: { id: { in: privateOpenMatchIds } } });
    }

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
        compatibility: 0.88 + (stableHash(owner.id) % 7) / 100,
        rationale: {
          generatedBy: "private-qa-match",
          ownerUserId: owner.id,
          repeatUntilBerlinDate,
          profileTemplateId: template.id,
          testProfile: true,
          sharedInterests,
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
      title: "Dein Test-Match ist vorbereitet",
      body: `Dein Match wird ${releaseDayLabel} um 09:00 Uhr freigeschaltet.`,
      channelId: "match-releases",
      data: {
        type: "private-qa-match-prepared",
        matchId: match.id,
      },
    },
  });

  return {
    matchId: match.id,
    partnerName: template.firstName,
    profileTemplateId: template.id,
    scheduledFor: match.scheduledFor,
    repeatUntilBerlinDate,
    replacedPrivateMatchCount: privateOpenMatchIds.length,
    pushSent: push.sent,
  };
}
