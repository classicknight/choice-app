export type RegistrationProfile = {
  firstName: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  city: string;
  selfDescription: string;
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
  consent: boolean;
};

export const datingIntentOptions = [
  { value: "relationship", label: "Ernst" },
  { value: "intentional-dating", label: "Offen" },
  { value: "open-minded", label: "Leicht" },
] as const;

export const pronounOptions = [
  { value: "sie/ihr", label: "sie/ihr" },
  { value: "er/ihm", label: "er/ihm" },
  { value: "they/them", label: "they/them" },
  { value: "keine-angabe", label: "Keine Angabe" },
] as const;

export const lookingForOptions = [
  "Frauen",
  "Männer",
  "Alle",
] as const;

export const identityOptions = [
  { value: "hetero", label: "Hetero" },
  { value: "queer", label: "Queer" },
  { value: "bi-pan", label: "Bi / Pan" },
  { value: "lesbisch", label: "Lesbisch" },
  { value: "schwul", label: "Schwul" },
  { value: "non-binary", label: "Non-binary" },
  { value: "trans", label: "Trans" },
  { value: "offen", label: "Offen" },
] as const;

export const selfDescriptionOptions = [
  { value: "direct", label: "Ich bin eher direkt und sage, was ich denke." },
  { value: "warm", label: "Ich bin offen, warm und schnell im Gespräch." },
  { value: "calm", label: "Ich bin eher ruhig und beobachte erst einmal." },
  { value: "deep", label: "Ich mag Tiefe mehr als oberflächlichen Small Talk." },
  { value: "playful", label: "Ich bin spontan, locker und gern für Quatsch zu haben." },
  { value: "slow-burn", label: "Ich brauche kurz, taue dann aber richtig auf." },
] as const;

export const interestOptions = [
  "Kunst",
  "Musik",
  "Kochen",
  "Bouldern",
  "Tech",
  "Lesen",
  "Filme",
  "Reisen",
  "Flohmärkte",
  "Running",
  "Konzerte",
  "Yoga",
  "Gaming",
  "Fotografie",
  "Cafés",
  "Spaziergänge",
  "Museen",
] as const;

export const greenFlagOptions = [
  "Plant ein echtes Date",
  "Stellt gute Fragen",
  "Antwortet klar",
  "Macht Vorschläge",
  "Humor ohne Cringe",
  "Kann gut flirten",
  "Hält sein Wort",
  "Hat ein eigenes Leben",
  "Meldet sich von selbst",
  "Zeigt echtes Interesse",
  "Kann über sich lachen",
  "Ist freundlich zu anderen",
] as const;

export const dealbreakerOptions = [
  "Nur late-night Texts",
  "Antwortet tagelang nicht",
  "Spricht nur über sich",
  "Direkt sexualisiert",
  "Will nie etwas planen",
  "Unklare Absichten",
  "Lovebombing",
  "Ex-Themen nonstop",
  "Sagt in letzter Minute ab",
  "Ist unfreundlich zu anderen",
  "Noch nicht über Ex hinweg",
  "Schreibt nur wenn langweilig",
] as const;

export const initialRegistrationProfile: RegistrationProfile = {
  firstName: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  city: "",
  selfDescription: "",
  pronouns: "",
  identity: "",
  lookingFor: "",
  datingIntent: "",
  ageRangeMin: "",
  ageRangeMax: "",
  interests: [],
  greenFlags: [],
  dealbreakers: [],
  matchTime: "19:00",
  conversationStyle: "direct",
  consent: false,
};

function getBirthDate(profile: Pick<RegistrationProfile, "birthDay" | "birthMonth" | "birthYear">) {
  const day = Number(profile.birthDay);
  const month = Number(profile.birthMonth);
  const year = Number(profile.birthYear);

  if (!profile.birthDay.trim() || !profile.birthMonth.trim() || !profile.birthYear.trim()) {
    return null;
  }

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
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

  return birthDate;
}

export function calculateAgeFromProfile(profile: Pick<RegistrationProfile, "birthDay" | "birthMonth" | "birthYear">) {
  const birthDate = getBirthDate(profile);

  if (!birthDate) {
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

export function validateStep(profile: RegistrationProfile, step: number) {
  if (step === 0) {
    if (
      !profile.firstName.trim() ||
      !profile.birthDay.trim() ||
      !profile.birthMonth.trim() ||
      !profile.birthYear.trim() ||
      !profile.city.trim()
    ) {
      return "Bitte fülle Vorname, Geburtstag und Stadt aus.";
    }

    const age = calculateAgeFromProfile(profile);
    if (age === null || age < 18 || age > 99) {
      return "Bitte gib einen gültigen Geburtstag an.";
    }
  }

  if (step === 1) {
    if (!profile.identity.trim() || !profile.lookingFor || !profile.datingIntent) {
      return "Bitte vervollständige dein Suchprofil.";
    }

    const ageRangeMin = Number(profile.ageRangeMin);
    const ageRangeMax = Number(profile.ageRangeMax);
    if (
      !profile.ageRangeMin.trim() ||
      !profile.ageRangeMax.trim() ||
      Number.isNaN(ageRangeMin) ||
      Number.isNaN(ageRangeMax) ||
      ageRangeMin < 18 ||
      ageRangeMax > 99 ||
      ageRangeMin > ageRangeMax
    ) {
      return "Bitte gib ein sinnvolles Wunschalter an.";
    }

    if (profile.interests.length < 3) {
      return "Wähle mindestens drei Interessen aus, damit Choice gute erste Matches bauen kann.";
    }
  }

  if (step === 2) {
    if (!profile.consent) {
      return "Bitte stimme den Rechtstexten zu und willige auch in die Verarbeitung sensibler Profilangaben ein.";
    }
  }

  return null;
}

export function createProfileId() {
  return `choice_${Date.now().toString(36)}`;
}

export function buildSummary(profile: RegistrationProfile) {
  const interests = profile.interests.slice(0, 3).join(", ");
  return `${interests}.`;
}
