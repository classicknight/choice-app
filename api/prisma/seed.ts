import {
  AuthProvider,
  MatchStatus,
  ParticipantDecision,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

type DemoProfileSeed = {
  id: string;
  firstName: string;
  age: number;
  city: string;
  imageUri: string;
  interests: string[];
};

type DemoSessionProfileSeed = {
  firstName: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  city: string;
  pronouns: string;
  identity: string;
  lookingFor: string;
  datingIntent: string;
  ageRangeMin: string;
  ageRangeMax: string;
  interests: string[];
  greenFlags: string[];
  dealbreakers: string[];
  matchTime: string;
  conversationStyle: string;
};

type SeedCandidateConfig = {
  email: string;
  phoneNumber: string;
  pronouns: string;
  identity: string;
  lookingFor: string;
  datingIntent: string;
  ageRangeMin: number;
  ageRangeMax: number;
  greenFlags: string[];
  dealbreakers: string[];
  conversationStyle: string;
};

const primaryDemoUser = {
  email: "alex.demo@choice.local",
  phoneNumber: "+4915500001000",
};

const demoProfiles: DemoProfileSeed[] = [
  {
    id: "mila",
    firstName: "Mila",
    age: 26,
    city: "Berlin",
    imageUri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
    interests: ["Kunst", "Flohmaerkte", "Cafes"],
  },
  {
    id: "lina",
    firstName: "Lina",
    age: 24,
    city: "Koeln",
    imageUri: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
    interests: ["Lesen", "Kunst", "Filme"],
  },
  {
    id: "zoe",
    firstName: "Zoe",
    age: 27,
    city: "Hamburg",
    imageUri: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    interests: ["Running", "Cafes", "Reisen"],
  },
  {
    id: "clara",
    firstName: "Clara",
    age: 29,
    city: "Muenchen",
    imageUri: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
    interests: ["Kochen", "Museen", "Spaziergaenge"],
  },
  {
    id: "paula",
    firstName: "Paula",
    age: 25,
    city: "Leipzig",
    imageUri: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    interests: ["Konzerte", "Filme", "Fotografie"],
  },
  {
    id: "nika",
    firstName: "Nika",
    age: 28,
    city: "Frankfurt",
    imageUri: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80",
    interests: ["Museen", "Tech", "Yoga"],
  },
  {
    id: "jule",
    firstName: "Jule",
    age: 27,
    city: "Duesseldorf",
    imageUri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80",
    interests: ["Konzerte", "Kochen", "Spaziergaenge"],
  },
];

const demoSessionProfile: DemoSessionProfileSeed = {
  firstName: "Alex",
  birthDay: "14",
  birthMonth: "08",
  birthYear: "1998",
  city: "Berlin",
  pronouns: "er/ihm",
  identity: "hetero",
  lookingFor: "Frauen",
  datingIntent: "intentional-dating",
  ageRangeMin: "24",
  ageRangeMax: "31",
  interests: ["Kunst", "Reisen", "Konzerte", "Cafes"],
  greenFlags: ["Stellt gute Fragen", "Plant ein echtes Date", "Meldet sich von selbst"],
  dealbreakers: ["Antwortet tagelang nicht", "Unklare Absichten"],
  matchTime: "09:00",
  conversationStyle: "direct",
};

const demoSessionPhotoUris = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1200&q=80",
];

const demoRunthroughMessages = [
  "Hey, du hast auch Kunst und Flohmaerkte gewaehlt?",
  "Ja total. Wo gehst du in Berlin am liebsten?",
  "Sonntag oft Mauerpark oder kleinere Vintage-Spots.",
  "Okay, das klingt gefaehrlich gut. Da waere ich sofort dabei.",
];

const candidateConfigById: Record<string, SeedCandidateConfig> = {
  mila: {
    email: "mila.demo@choice.local",
    phoneNumber: "+4915500001001",
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "intentional-dating",
    ageRangeMin: 26,
    ageRangeMax: 34,
    greenFlags: ["Stellt gute Fragen", "Plant ein echtes Date"],
    dealbreakers: ["Unklare Absichten"],
    conversationStyle: "warm",
  },
  lina: {
    email: "lina.demo@choice.local",
    phoneNumber: "+4915500001002",
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "relationship",
    ageRangeMin: 25,
    ageRangeMax: 33,
    greenFlags: ["Meldet sich von selbst", "Kann über sich lachen"],
    dealbreakers: ["Direkt sexualisiert"],
    conversationStyle: "thoughtful",
  },
  zoe: {
    email: "zoe.demo@choice.local",
    phoneNumber: "+4915500001003",
    pronouns: "sie/ihr",
    identity: "bi-pan",
    lookingFor: "Alle",
    datingIntent: "open-minded",
    ageRangeMin: 24,
    ageRangeMax: 34,
    greenFlags: ["Hat ein eigenes Leben", "Antwortet klar"],
    dealbreakers: ["Lovebombing"],
    conversationStyle: "playful",
  },
  clara: {
    email: "clara.demo@choice.local",
    phoneNumber: "+4915500001004",
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "relationship",
    ageRangeMin: 28,
    ageRangeMax: 37,
    greenFlags: ["Plant ein echtes Date", "Hält sein Wort"],
    dealbreakers: ["Sagt in letzter Minute ab"],
    conversationStyle: "clear",
  },
  paula: {
    email: "paula.demo@choice.local",
    phoneNumber: "+4915500001005",
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "intentional-dating",
    ageRangeMin: 24,
    ageRangeMax: 32,
    greenFlags: ["Kann gut flirten", "Zeigt echtes Interesse"],
    dealbreakers: ["Schreibt nur wenn langweilig"],
    conversationStyle: "energetic",
  },
  nika: {
    email: "nika.demo@choice.local",
    phoneNumber: "+4915500001006",
    pronouns: "she/they",
    identity: "queer",
    lookingFor: "Alle",
    datingIntent: "intentional-dating",
    ageRangeMin: 25,
    ageRangeMax: 35,
    greenFlags: ["Ist freundlich zu anderen", "Macht Vorschläge"],
    dealbreakers: ["Spricht nur über sich"],
    conversationStyle: "direct",
  },
  jule: {
    email: "jule.demo@choice.local",
    phoneNumber: "+4915500001007",
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "open-minded",
    ageRangeMin: 25,
    ageRangeMax: 34,
    greenFlags: ["Humor ohne Cringe", "Meldet sich von selbst"],
    dealbreakers: ["Antwortet tagelang nicht"],
    conversationStyle: "light",
  },
};

function buildPreferenceNotes(greenFlags: string[], dealbreakers: string[]) {
  return [
    greenFlags.length ? `Pro: ${greenFlags.join(", ")}` : "",
    dealbreakers.length ? `No-Gos: ${dealbreakers.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function createPhotoVariants(uri: string) {
  return [
    uri,
    `${uri}&sat=-8`,
    `${uri}&h=1600`,
  ];
}

function shiftDays(base: Date, dayOffset: number, hour: number) {
  const value = new Date(base);
  value.setDate(value.getDate() + dayOffset);
  value.setHours(hour, 0, 0, 0);
  return value;
}

function calculateAgeFromBirthday(dayValue: string, monthValue: string, yearValue: string) {
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const birthDate = new Date(year, month - 1, day);

  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

async function main() {
  const seedPhones = [primaryDemoUser.phoneNumber, ...Object.values(candidateConfigById).map((entry) => entry.phoneNumber)];
  const seedEmails = [primaryDemoUser.email, ...Object.values(candidateConfigById).map((entry) => entry.email)];

  await prisma.user.deleteMany({
    where: {
      OR: [
        { phoneNumber: { in: seedPhones } },
        { email: { in: seedEmails } },
      ],
    },
  });

  const now = new Date();
  const primaryAge = calculateAgeFromBirthday(
    demoSessionProfile.birthDay,
    demoSessionProfile.birthMonth,
    demoSessionProfile.birthYear,
  );

  if (primaryAge === null) {
    throw new Error("Demo session profile has an invalid birthday.");
  }

  const primaryUser = await prisma.user.create({
    data: {
      email: primaryDemoUser.email,
      phoneNumber: primaryDemoUser.phoneNumber,
      authProvider: AuthProvider.PHONE,
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
      profileCompleted: true,
      profile: {
        create: {
          firstName: demoSessionProfile.firstName,
          age: primaryAge,
          city: demoSessionProfile.city,
          pronouns: demoSessionProfile.pronouns,
          identity: demoSessionProfile.identity,
          lookingFor: demoSessionProfile.lookingFor,
          datingIntent: demoSessionProfile.datingIntent,
          ageRangeMin: Number(demoSessionProfile.ageRangeMin),
          ageRangeMax: Number(demoSessionProfile.ageRangeMax),
          interests: [...demoSessionProfile.interests],
          dealbreaker: buildPreferenceNotes(demoSessionProfile.greenFlags, demoSessionProfile.dealbreakers),
          avatarUrl: demoSessionPhotoUris[0],
          photoUrls: [...demoSessionPhotoUris],
          matchTime: demoSessionProfile.matchTime,
          conversationStyle: demoSessionProfile.conversationStyle,
        },
      },
    },
  });

  const seededCandidates = new Map<string, { userId: string; firstName: string }>();

  for (const demoProfile of demoProfiles) {
    const candidateConfig = candidateConfigById[demoProfile.id];

    if (!candidateConfig) {
      throw new Error(`Missing seed config for demo profile ${demoProfile.id}.`);
    }

    const candidateUser = await prisma.user.create({
      data: {
        email: candidateConfig.email,
        phoneNumber: candidateConfig.phoneNumber,
        authProvider: AuthProvider.PHONE,
        emailVerifiedAt: now,
        phoneVerifiedAt: now,
        profileCompleted: true,
        profile: {
          create: {
            firstName: demoProfile.firstName,
            age: demoProfile.age,
            city: demoProfile.city,
            pronouns: candidateConfig.pronouns,
            identity: candidateConfig.identity,
            lookingFor: candidateConfig.lookingFor,
            datingIntent: candidateConfig.datingIntent,
            ageRangeMin: candidateConfig.ageRangeMin,
            ageRangeMax: candidateConfig.ageRangeMax,
            interests: [...demoProfile.interests],
            dealbreaker: buildPreferenceNotes(candidateConfig.greenFlags, candidateConfig.dealbreakers),
            avatarUrl: demoProfile.imageUri,
            photoUrls: createPhotoVariants(demoProfile.imageUri),
            matchTime: "09:00",
            conversationStyle: candidateConfig.conversationStyle,
          },
        },
      },
    });

    seededCandidates.set(demoProfile.id, {
      userId: candidateUser.id,
      firstName: demoProfile.firstName,
    });
  }

  const milaUserId = seededCandidates.get("mila")?.userId;
  const linaUserId = seededCandidates.get("lina")?.userId;
  const zoeUserId = seededCandidates.get("zoe")?.userId;
  const claraUserId = seededCandidates.get("clara")?.userId;
  const paulaUserId = seededCandidates.get("paula")?.userId;
  const nikaUserId = seededCandidates.get("nika")?.userId;
  const juleUserId = seededCandidates.get("jule")?.userId;

  if (!milaUserId || !linaUserId || !zoeUserId || !claraUserId || !paulaUserId || !nikaUserId || !juleUserId) {
    throw new Error("Not all demo candidates were created.");
  }

  const activeMatchAt = shiftDays(now, 0, 9);
  const activeMatch = await prisma.match.create({
    data: {
      scheduledFor: activeMatchAt,
      activatedAt: activeMatchAt,
      status: MatchStatus.ACTIVE,
      userAId: primaryUser.id,
      userBId: milaUserId,
      compatibility: 0.93,
      rationale: {
        sharedInterests: ["Kunst", "Cafés"],
        tone: "direct-but-warm",
      },
    },
  });

  await prisma.chat.create({
    data: {
      matchId: activeMatch.id,
      members: {
        create: [
          { userId: primaryUser.id },
          { userId: milaUserId },
        ],
      },
      messages: {
        create: [
          {
            senderId: primaryUser.id,
            kind: "SYSTEM",
            body: "Choice hat euren Chat geöffnet.",
            createdAt: new Date(activeMatchAt.getTime() + 2 * 60 * 1000),
          },
          {
            senderId: milaUserId,
            body: demoRunthroughMessages[0] ?? "Hey, schoen dass wir gematcht wurden.",
            createdAt: new Date(activeMatchAt.getTime() + 9 * 60 * 1000),
          },
          {
            senderId: primaryUser.id,
            body: demoRunthroughMessages[1] ?? "Ja, freut mich auch.",
            createdAt: new Date(activeMatchAt.getTime() + 16 * 60 * 1000),
          },
          {
            senderId: milaUserId,
            body: demoRunthroughMessages[2] ?? "Das klingt nach einem guten Start.",
            createdAt: new Date(activeMatchAt.getTime() + 28 * 60 * 1000),
          },
          {
            senderId: primaryUser.id,
            body: demoRunthroughMessages[3] ?? "Dann lass uns das morgen konkret machen.",
            createdAt: new Date(activeMatchAt.getTime() + 36 * 60 * 1000),
          },
        ],
      },
    },
  });

  await prisma.match.create({
    data: {
      scheduledFor: shiftDays(now, -6, 9),
      activatedAt: shiftDays(now, -6, 9),
      closedAt: shiftDays(now, -6, 21),
      status: MatchStatus.KEPT,
      userAId: primaryUser.id,
      userBId: linaUserId,
      userADecision: ParticipantDecision.KEEP,
      userBDecision: ParticipantDecision.KEEP,
      compatibility: 0.88,
    },
  });

  await prisma.match.create({
    data: {
      scheduledFor: shiftDays(now, -4, 9),
      activatedAt: shiftDays(now, -4, 9),
      closedAt: shiftDays(now, -4, 21),
      status: MatchStatus.DISCARDED,
      userAId: primaryUser.id,
      userBId: zoeUserId,
      userADecision: ParticipantDecision.DISCARD,
      userBDecision: ParticipantDecision.KEEP,
      compatibility: 0.74,
    },
  });

  await prisma.match.create({
    data: {
      scheduledFor: shiftDays(now, -2, 9),
      activatedAt: shiftDays(now, -2, 9),
      closedAt: shiftDays(now, -2, 21),
      status: MatchStatus.EXPIRED,
      userAId: primaryUser.id,
      userBId: claraUserId,
      userADecision: ParticipantDecision.UNDECIDED,
      userBDecision: ParticipantDecision.UNDECIDED,
      compatibility: 0.79,
    },
  });

  await prisma.match.createMany({
    data: [
      {
        scheduledFor: shiftDays(now, 1, 9),
        status: MatchStatus.PENDING,
        userAId: primaryUser.id,
        userBId: paulaUserId,
        compatibility: 0.82,
      },
      {
        scheduledFor: shiftDays(now, 2, 9),
        status: MatchStatus.PENDING,
        userAId: primaryUser.id,
        userBId: nikaUserId,
        compatibility: 0.86,
      },
      {
        scheduledFor: shiftDays(now, 3, 9),
        status: MatchStatus.PENDING,
        userAId: primaryUser.id,
        userBId: juleUserId,
        compatibility: 0.81,
      },
    ],
  });

  console.log("Seeded Choice demo run-through");
  console.log(`Primary demo user: ${primaryDemoUser.phoneNumber}`);
  console.log(`Fake match profiles: ${demoProfiles.length}`);
  console.log("Current state: 1 active match, 1 active chat, 3 completed matches, 3 pending matches");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
