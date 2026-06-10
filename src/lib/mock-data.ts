import type { RegistrationProfile } from "./registration";

export type DemoProfile = {
  id: string;
  firstName: string;
  age: number;
  city: string;
  selfDescription: string;
  tagline: string;
  imageUri: string;
  photoUris: string[];
  introVideoUrl?: string | null;
  interests: string[];
  pronouns: string;
  identity: string;
  lookingFor: string;
  datingIntent: string;
  ageRangeMin: number;
  ageRangeMax: number;
  greenFlags: string[];
  dealbreakers: string[];
  time: string;
};

export type DemoChatMessage = {
  id: string;
  side: "left" | "right";
  text: string;
};

function createPhotoSet(uri: string) {
  return [
    uri,
    `${uri}&sat=-6`,
    `${uri}&h=1600`,
  ];
}

export const demoProfiles: DemoProfile[] = [
  {
    id: "mila",
    firstName: "Mila",
    age: 26,
    city: "Berlin",
    selfDescription: "deep",
    tagline: "Espresso, Flohmärkte, späte Spaziergänge.",
    imageUri:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
    photoUris: createPhotoSet("https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80"),
    introVideoUrl: null,
    interests: ["Kunst", "Flohmärkte", "Cafés"],
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "intentional-dating",
    ageRangeMin: 26,
    ageRangeMax: 34,
    greenFlags: ["Stellt gute Fragen", "Plant ein echtes Date", "Meldet sich von selbst"],
    dealbreakers: ["Unklare Absichten", "Antwortet tagelang nicht"],
    time: "Heute 20:00",
  },
  {
    id: "lina",
    firstName: "Lina",
    age: 24,
    city: "Köln",
    selfDescription: "playful",
    tagline: "Galerien, lange Texte und spontane Zugtickets.",
    imageUri:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80",
    photoUris: createPhotoSet("https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=80"),
    introVideoUrl: null,
    interests: ["Lesen", "Kunst", "Filme"],
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "relationship",
    ageRangeMin: 25,
    ageRangeMax: 33,
    greenFlags: ["Kann über sich lachen", "Plant ein echtes Date"],
    dealbreakers: ["Direkt sexualisiert", "Lovebombing"],
    time: "Morgen 09:00",
  },
  {
    id: "zoe",
    firstName: "Zoë",
    age: 27,
    city: "Hamburg",
    selfDescription: "warm",
    tagline: "Rennt gern am Wasser und bleibt dann zu lange auf einen Flat White.",
    imageUri:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    photoUris: createPhotoSet("https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80"),
    introVideoUrl: null,
    interests: ["Running", "Cafés", "Reisen"],
    pronouns: "sie/ihr",
    identity: "bi-pan",
    lookingFor: "Alle",
    datingIntent: "open-minded",
    ageRangeMin: 24,
    ageRangeMax: 34,
    greenFlags: ["Antwortet klar", "Hat ein eigenes Leben"],
    dealbreakers: ["Lovebombing", "Spricht nur über sich"],
    time: "Dienstag 09:00",
  },
  {
    id: "clara",
    firstName: "Clara",
    age: 29,
    city: "München",
    selfDescription: "calm",
    tagline: "Mag klare Fragen, gute Pasta und Sonntage ohne Hektik.",
    imageUri:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
    photoUris: createPhotoSet("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80"),
    introVideoUrl: null,
    interests: ["Kochen", "Museen", "Spaziergänge"],
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "relationship",
    ageRangeMin: 28,
    ageRangeMax: 37,
    greenFlags: ["Hält sein Wort", "Plant ein echtes Date"],
    dealbreakers: ["Sagt in letzter Minute ab", "Unklare Absichten"],
    time: "Mittwoch 09:00",
  },
  {
    id: "paula",
    firstName: "Paula",
    age: 25,
    city: "Leipzig",
    selfDescription: "playful",
    tagline: "Plattenläden, Filmabende und ein bisschen zu viel Matcha.",
    imageUri:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    photoUris: createPhotoSet("https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80"),
    introVideoUrl: null,
    interests: ["Konzerte", "Filme", "Fotografie"],
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "intentional-dating",
    ageRangeMin: 24,
    ageRangeMax: 32,
    greenFlags: ["Zeigt echtes Interesse", "Kann gut flirten"],
    dealbreakers: ["Schreibt nur wenn langweilig", "Antwortet tagelang nicht"],
    time: "Donnerstag 09:00",
  },
  {
    id: "nika",
    firstName: "Nika",
    age: 28,
    city: "Frankfurt",
    selfDescription: "direct",
    tagline: "Sehr direkt, sehr freundlich und fast immer für ein Museum zu haben.",
    imageUri:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80",
    photoUris: createPhotoSet("https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80"),
    introVideoUrl: null,
    interests: ["Museen", "Tech", "Yoga"],
    pronouns: "they/them",
    identity: "queer",
    lookingFor: "Alle",
    datingIntent: "intentional-dating",
    ageRangeMin: 25,
    ageRangeMax: 35,
    greenFlags: ["Ist freundlich zu anderen", "Macht Vorschläge"],
    dealbreakers: ["Spricht nur über sich", "Direkt sexualisiert"],
    time: "Freitag 09:00",
  },
  {
    id: "jule",
    firstName: "Jule",
    age: 27,
    city: "Düsseldorf",
    selfDescription: "warm",
    tagline: "Humor zuerst, dann ein echtes Date und bitte kein ewiges Schreiben.",
    imageUri:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80",
    photoUris: createPhotoSet("https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80"),
    introVideoUrl: null,
    interests: ["Konzerte", "Kochen", "Spaziergänge"],
    pronouns: "sie/ihr",
    identity: "hetero",
    lookingFor: "Männer",
    datingIntent: "open-minded",
    ageRangeMin: 25,
    ageRangeMax: 34,
    greenFlags: ["Humor ohne Cringe", "Meldet sich von selbst"],
    dealbreakers: ["Antwortet tagelang nicht", "Will nie etwas planen"],
    time: "Samstag 09:00",
  },
];

export const demoSessionProfile: RegistrationProfile = {
  firstName: "Alex",
  birthDay: "14",
  birthMonth: "08",
  birthYear: "1998",
  city: "Berlin",
  selfDescription: "direct",
  pronouns: "er/ihm",
  identity: "hetero",
  lookingFor: "Frauen",
  datingIntent: "intentional-dating",
  ageRangeMin: "24",
  ageRangeMax: "31",
  interests: ["Kunst", "Reisen", "Konzerte", "Cafés"],
  greenFlags: ["Stellt gute Fragen", "Plant ein echtes Date", "Meldet sich von selbst"],
  dealbreakers: ["Antwortet tagelang nicht", "Unklare Absichten"],
  matchTime: "09:00",
  conversationStyle: "direct",
  consent: true,
};

export const demoSessionPhotoUris = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1200&q=80",
];

export const demoRunthrough = {
  currentMatchProfileId: "mila",
  completedMatchCount: 3,
  includedMatchLimit: 8,
  penaltyPoints: 0,
  hasActiveChat: true,
  activeChatMessages: [] satisfies DemoChatMessage[],
  upcomingChatExampleMessages: [
    { id: "u1", side: "left", text: "Hey, ich hab gesehen du magst auch Cafés und Spaziergänge." },
    { id: "u2", side: "right", text: "Ja voll. Gerade bei gutem Wetter ist das mein Lieblingsdate." },
    { id: "u3", side: "left", text: "Dann klingt morgen schon mal nach einem ziemlich guten Start." },
  ] satisfies DemoChatMessage[],
};

export const demoChatPreview = [
  "Du hast Kunst und Flohmärkte gewählt.",
  "Choice hat schon ein gutes erstes Match für dich.",
];
