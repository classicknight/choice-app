import {
  MatchStatus,
  MessageKind,
  ParticipantDecision,
  PhaseTwoStage,
  Prisma,
} from "@prisma/client";
import { sendPushNotificationOnce, sendPushNotificationToUser } from "./push-notifications.js";
import { applySystemPenalty } from "./system-penalties.js";
import { prisma } from "./prisma.js";

const PHASE_THREE_THRESHOLD = 50;
const PHASE_TWO_ROUNDS_PER_SESSION = 3;
const MATCH_RELEASE_HOUR = 15;
const MATCH_RELEASE_MINUTE = 0;
const PHASE_INTERVAL_MINUTES = 20;
const PHASE_WARNING_LEAD_MS = 5 * 60 * 1000;

export type JourneyPhaseTwoResponseOption = {
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
};

export type JourneyPhaseTwoAnswerBranch = {
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
  followUpPrompt: string;
  followUpOptions: JourneyPhaseTwoResponseOption[];
};

export type JourneyPhaseTwoRoundConfig = {
  id: string;
  prompt: string;
  answerOptions: JourneyPhaseTwoAnswerBranch[];
};

export type JourneyPhaseTwoRoundResult = {
  roundId: string;
  prompt: string;
  personALabel: string;
  personAScore: number;
  followUpPrompt: string;
  followUpOptions: JourneyPhaseTwoResponseOption[];
  personBLabel: string;
  personBScore: number;
  compatibility: number;
};

export type JourneyPartnerProfile = {
  userId: string;
  phoneNumber: string | null;
  firstName: string;
  age: number;
  city: string;
  selfDescription: string;
  pronouns: string;
  identity: string;
  lookingFor: string;
  datingIntent: string;
  ageRangeMin: number;
  ageRangeMax: number;
  interests: string[];
  greenFlags: string[];
  dealbreakers: string[];
  avatarUrl: string | null;
  photoUrls: string[];
  introVideoUrl: string | null;
  matchTime: string;
  conversationStyle: string;
};

export type JourneyMessage = {
  id: string;
  senderUserId: string;
  kind: "text" | "image" | "system";
  text?: string;
  imageUri?: string;
  createdAt: string;
};

export type JourneyState = {
  ownerUserId: string;
  matchId: string | null;
  releaseAt: string | null;
  decisionDeadlineAt: string | null;
  phaseTwoStartAt: string | null;
  phaseThreeStartAt: string | null;
  phaseFourStartAt: string | null;
  phaseFiveStartAt: string | null;
  status: MatchStatus | null;
  partner: JourneyPartnerProfile | null;
  sharedChatMessages: JourneyMessage[];
  phaseOneStarterUserId: string | null;
  phaseOneStarterPenaltyAppliedAt: string | null;
  phaseTwoPenaltyAppliedAt: string | null;
  phaseOneDecisions: Record<string, "continue" | "new-match">;
  phaseThreeDecisions: Record<string, "stay" | "new-match">;
  phaseTwoRounds: JourneyPhaseTwoRoundConfig[];
  phaseTwoRoundIndex: number;
  phaseTwoStage: "starter" | "partner" | "result";
  phaseTwoResults: JourneyPhaseTwoRoundResult[];
  phaseTwoStarterUserId: string | null;
  phaseTwoPartnerUserId: string | null;
  phaseTwoStarterName: string;
  phaseTwoPartnerName: string;
};

type MatchWithRelations = Prisma.MatchGetPayload<{
  include: {
    userA: { include: { profile: true } };
    userB: { include: { profile: true } };
    chat: { include: { messages: { orderBy: { createdAt: "asc" } } } };
  };
}>;

type CandidateProfile = {
  userId: string;
  age: number;
  city: string;
  identity: string;
  pronouns: string;
  lookingFor: string;
  datingIntent: string;
  ageRangeMin: number;
  ageRangeMax: number;
  interests: string[];
};

function chooseStableStarterUserId(userA: string, userB: string) {
  const [left, right] = [userA, userB].sort();
  const key = `${left}:${right}`;
  const sum = [...key].reduce((current, character) => current + character.charCodeAt(0), 0);
  return sum % 2 === 0 ? left : right;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function setTimeOfDay(date: Date, hour: number, minute: number) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function getNextMatchReleaseAt(now: Date) {
  const release = new Date(now);
  release.setHours(MATCH_RELEASE_HOUR, MATCH_RELEASE_MINUTE, 0, 0);
  const currentDecisionDeadline = addMinutes(release, PHASE_INTERVAL_MINUTES);

  if (now < currentDecisionDeadline) {
    return release;
  }

  release.setDate(release.getDate() + 1);

  return release;
}

function buildPhaseSchedule(releaseAt: Date) {
  return {
    release: releaseAt,
    decisionDeadline: addMinutes(releaseAt, PHASE_INTERVAL_MINUTES),
    phaseTwoStart: addMinutes(releaseAt, PHASE_INTERVAL_MINUTES),
    phaseThreeStart: addMinutes(releaseAt, PHASE_INTERVAL_MINUTES * 2),
    phaseFourStart: addMinutes(releaseAt, PHASE_INTERVAL_MINUTES * 3),
    phaseFiveStart: addMinutes(releaseAt, PHASE_INTERVAL_MINUTES * 4),
  };
}

function getCompatibilityPoints(scoreA: number, scoreB: number) {
  const difference = Math.abs(scoreA - scoreB);
  return Math.max(0, 100 - difference * 25);
}

function getParticipantProfileName(match: MatchWithRelations, userId: string) {
  if (match.userAId === userId) {
    return match.userA.profile?.firstName?.trim() || "Choice";
  }

  if (match.userBId === userId) {
    return match.userB.profile?.firstName?.trim() || "Choice";
  }

  return "Choice";
}

function getPartnerProfileName(match: MatchWithRelations, userId: string) {
  if (match.userAId === userId) {
    return match.userB.profile?.firstName?.trim() || "dein Match";
  }

  if (match.userBId === userId) {
    return match.userA.profile?.firstName?.trim() || "dein Match";
  }

  return "dein Match";
}

function getPhaseTwoStarterUserId(match: MatchWithRelations) {
  return match.phaseTwoStarterUserId ?? chooseStableStarterUserId(match.userAId, match.userBId);
}

function getPhaseTwoPartnerUserId(match: MatchWithRelations) {
  return match.phaseTwoPartnerUserId ?? (getPhaseTwoStarterUserId(match) === match.userAId ? match.userBId : match.userAId);
}

async function sendJourneyNotificationToUser(input: {
  userId: string;
  matchId: string;
  kind: string;
  contextKey: string;
  title: string;
  body: string;
  channelId: string;
  data?: Record<string, string | number | boolean | null>;
}) {
  await sendPushNotificationOnce({
    userId: input.userId,
    matchId: input.matchId,
    kind: input.kind,
    contextKey: input.contextKey,
    payload: {
      title: input.title,
      body: input.body,
      channelId: input.channelId,
      data: input.data,
    },
  });
}

async function syncJourneyPhaseNotifications(
  match: MatchWithRelations,
  now: Date,
  userMessages: NonNullable<MatchWithRelations["chat"]>["messages"],
  schedule: ReturnType<typeof buildPhaseSchedule>,
) {
  if (match.status !== MatchStatus.ACTIVE) {
    return;
  }

  const phaseOneStarterUserId = match.phaseOneStarterUserId ?? chooseStableStarterUserId(match.userAId, match.userBId);
  const phaseOneWarningAt = new Date(schedule.decisionDeadline.getTime() - PHASE_WARNING_LEAD_MS);
  const phaseOneChatStarted = userMessages.length > 0;
  const phaseOneBothContinue =
    match.userADecision === ParticipantDecision.KEEP && match.userBDecision === ParticipantDecision.KEEP;

  const phaseTwoResults = parseJsonList<JourneyPhaseTwoRoundResult>(match.phaseTwoResults);
  const phaseTwoReady = match.phaseTwoStage === PhaseTwoStage.RESULT && phaseTwoResults.length > 0;
  const phaseTwoCompatibility = phaseTwoReady
    ? Math.round(
        phaseTwoResults.reduce((sum, entry) => sum + entry.compatibility, 0) / phaseTwoResults.length,
      )
    : 0;
  const phaseThreeQualified = phaseTwoReady && phaseTwoCompatibility > PHASE_THREE_THRESHOLD;
  const phaseThreeAnyLeave =
    match.phaseThreeUserADecision === ParticipantDecision.DISCARD
    || match.phaseThreeUserBDecision === ParticipantDecision.DISCARD;
  const phaseThreeBothStay =
    match.phaseThreeUserADecision === ParticipantDecision.KEEP
    && match.phaseThreeUserBDecision === ParticipantDecision.KEEP;

  if (
    phaseOneStarterUserId
    && !phaseOneChatStarted
    && now >= match.scheduledFor
    && now < schedule.decisionDeadline
    && now >= phaseOneWarningAt
  ) {
    await sendJourneyNotificationToUser({
      userId: phaseOneStarterUserId,
      matchId: match.id,
      kind: "phase-one-warning",
      contextKey: `phase-one-warning:${match.id}:${phaseOneStarterUserId}`,
      title: "Es droht ein Strafpunkt",
      body: `Choice hat dich ausgewählt, den Chat mit ${getPartnerProfileName(match, phaseOneStarterUserId)} zu eröffnen. Wenn du heute nichts schreibst, droht ein Strafpunkt.`,
      channelId: "fair-play",
      data: {
        type: "phase-one-warning",
        matchId: match.id,
      },
    });
  }

  if (phaseOneBothContinue && now >= schedule.phaseTwoStart && now < schedule.phaseThreeStart) {
    const phaseTwoStarterUserId = getPhaseTwoStarterUserId(match);
    const phaseTwoPartnerUserId = getPhaseTwoPartnerUserId(match);

    await Promise.allSettled([
      sendJourneyNotificationToUser({
        userId: phaseTwoStarterUserId,
        matchId: match.id,
        kind: "phase-two-start",
        contextKey: `phase-two-start:${match.id}:${phaseTwoStarterUserId}`,
        title: "Ihr seid jetzt in Phase 2",
        body: "Du beginnst diese Runde. Beantworte zuerst alle 3 Fragen.",
        channelId: "phase-updates",
        data: {
          type: "phase-two-start",
          matchId: match.id,
        },
      }),
      sendJourneyNotificationToUser({
        userId: phaseTwoPartnerUserId,
        matchId: match.id,
        kind: "phase-two-start",
        contextKey: `phase-two-start:${match.id}:${phaseTwoPartnerUserId}`,
        title: "Ihr seid jetzt in Phase 2",
        body: `${getParticipantProfileName(match, phaseTwoStarterUserId)} beginnt diese Runde. Danach bist du dran.`,
        channelId: "phase-updates",
        data: {
          type: "phase-two-start",
          matchId: match.id,
        },
      }),
    ]);

    if (!phaseTwoReady) {
      const currentResponderUserId =
        match.phaseTwoStage === PhaseTwoStage.PARTNER
          ? getPhaseTwoPartnerUserId(match)
          : phaseTwoStarterUserId;
      const phaseTwoWarningAt = new Date(schedule.phaseThreeStart.getTime() - PHASE_WARNING_LEAD_MS);

      if (now >= phaseTwoWarningAt && now < schedule.phaseThreeStart) {
        await sendJourneyNotificationToUser({
          userId: currentResponderUserId,
          matchId: match.id,
          kind: "phase-two-warning",
          contextKey: `phase-two-warning:${match.id}:${currentResponderUserId}`,
          title: "Es droht ein Strafpunkt",
          body: "Du bist gerade mit Phase 2 dran. Wenn du jetzt nicht mitmachst, droht ein Strafpunkt.",
          channelId: "fair-play",
          data: {
            type: "phase-two-warning",
            matchId: match.id,
          },
        });
      }
    }
  }

  if (phaseTwoReady && phaseThreeQualified && now >= schedule.phaseThreeStart && now < schedule.phaseFourStart) {
    await Promise.allSettled([
      sendJourneyNotificationToUser({
        userId: match.userAId,
        matchId: match.id,
        kind: "phase-three-start",
        contextKey: `phase-three-start:${match.id}:${match.userAId}`,
        title: "Ihr seid jetzt in Phase 3",
        body: "Jetzt entscheidet ihr, ob ihr hier bleibt oder ein neues Match wollt.",
        channelId: "phase-updates",
        data: {
          type: "phase-three-start",
          matchId: match.id,
        },
      }),
      sendJourneyNotificationToUser({
        userId: match.userBId,
        matchId: match.id,
        kind: "phase-three-start",
        contextKey: `phase-three-start:${match.id}:${match.userBId}`,
        title: "Ihr seid jetzt in Phase 3",
        body: "Jetzt entscheidet ihr, ob ihr hier bleibt oder ein neues Match wollt.",
        channelId: "phase-updates",
        data: {
          type: "phase-three-start",
          matchId: match.id,
        },
      }),
    ]);

    const phaseThreeReminderAt = new Date(schedule.phaseFourStart.getTime() - PHASE_WARNING_LEAD_MS);
    if (now >= phaseThreeReminderAt && now < schedule.phaseFourStart) {
      if (match.phaseThreeUserADecision === ParticipantDecision.UNDECIDED) {
        await sendJourneyNotificationToUser({
          userId: match.userAId,
          matchId: match.id,
          kind: "phase-three-reminder",
          contextKey: `phase-three-reminder:${match.id}:${match.userAId}`,
          title: "Treffe jetzt deine Entscheidung",
          body: "Sage heute noch, ob du bleiben oder ein neues Match willst.",
          channelId: "fair-play",
          data: {
            type: "phase-three-reminder",
            matchId: match.id,
          },
        });
      }

      if (match.phaseThreeUserBDecision === ParticipantDecision.UNDECIDED) {
        await sendJourneyNotificationToUser({
          userId: match.userBId,
          matchId: match.id,
          kind: "phase-three-reminder",
          contextKey: `phase-three-reminder:${match.id}:${match.userBId}`,
          title: "Treffe jetzt deine Entscheidung",
          body: "Sage heute noch, ob du bleiben oder ein neues Match willst.",
          channelId: "fair-play",
          data: {
            type: "phase-three-reminder",
            matchId: match.id,
          },
        });
      }
    }
  }

  if (phaseThreeQualified && phaseThreeBothStay && now >= schedule.phaseFourStart && now < schedule.phaseFiveStart) {
    await Promise.allSettled([
      sendJourneyNotificationToUser({
        userId: match.userAId,
        matchId: match.id,
        kind: "phase-four-start",
        contextKey: `phase-four-start:${match.id}:${match.userAId}`,
        title: "Ihr seid jetzt in Phase 4",
        body: "Choice pausiert euren Chat jetzt bewusst.",
        channelId: "phase-updates",
        data: {
          type: "phase-four-start",
          matchId: match.id,
        },
      }),
      sendJourneyNotificationToUser({
        userId: match.userBId,
        matchId: match.id,
        kind: "phase-four-start",
        contextKey: `phase-four-start:${match.id}:${match.userBId}`,
        title: "Ihr seid jetzt in Phase 4",
        body: "Choice pausiert euren Chat jetzt bewusst.",
        channelId: "phase-updates",
        data: {
          type: "phase-four-start",
          matchId: match.id,
        },
      }),
    ]);
  }

  if (phaseThreeQualified && phaseThreeBothStay && now >= schedule.phaseFiveStart) {
    await Promise.allSettled([
      sendJourneyNotificationToUser({
        userId: match.userAId,
        matchId: match.id,
        kind: "phase-five-start",
        contextKey: `phase-five-start:${match.id}:${match.userAId}`,
        title: "Phase 5 ist jetzt da",
        body: "Euer Choice Award wartet auf euch.",
        channelId: "phase-updates",
        data: {
          type: "phase-five-start",
          matchId: match.id,
        },
      }),
      sendJourneyNotificationToUser({
        userId: match.userBId,
        matchId: match.id,
        kind: "phase-five-start",
        contextKey: `phase-five-start:${match.id}:${match.userBId}`,
        title: "Phase 5 ist jetzt da",
        body: "Euer Choice Award wartet auf euch.",
        channelId: "phase-updates",
        data: {
          type: "phase-five-start",
          matchId: match.id,
        },
      }),
    ]);
  }

  if (phaseThreeAnyLeave) {
    return;
  }
}

function createResponseOptions(
  labels: [string, string, string, string, string],
): JourneyPhaseTwoResponseOption[] {
  return labels.map((label, index) => ({
    label,
    score: (index + 1) as 1 | 2 | 3 | 4 | 5,
  }));
}

function createAnswerBranches(
  labels: [string, string, string, string, string],
  followUpPrompts: [string, string, string, string, string],
  followUpOptions: JourneyPhaseTwoResponseOption[],
): JourneyPhaseTwoAnswerBranch[] {
  return labels.map((label, index) => ({
    label,
    score: (index + 1) as 1 | 2 | 3 | 4 | 5,
    followUpPrompt: followUpPrompts[index],
    followUpOptions,
  }));
}

export function buildPhaseTwoRounds(selfName: string, partnerName: string): JourneyPhaseTwoRoundConfig[] {
  const questionBank: JourneyPhaseTwoRoundConfig[] = [
    {
      id: "flirting",
      prompt: `${selfName}, du bist in einer Beziehung und jemand flirtet offen mit dir. Wie reagierst du?`,
      answerOptions: createAnswerBranches(
        [
          "Ich ignoriere es komplett.",
          "Ich bleibe höflich, aber klar distanziert.",
          "Etwas harmlose Aufmerksamkeit finde ich okay.",
          "Ich flirte leicht zurück, solange es harmlos bleibt.",
          "Es kommt für mich ganz auf die Situation an.",
        ],
        [
          "Wie wichtig ist dir eine sehr klare Grenze bei Flirts von außen?",
          "Würde dir höfliche Distanz in so einer Situation Sicherheit geben?",
          "Wie gut kannst du mit harmloser Aufmerksamkeit von außen umgehen?",
          "Wo wäre für dich beim Flirten die Grenze?",
          "Kannst du mit Grauzonen beim Flirten in Beziehungen gut umgehen?",
        ],
        createResponseOptions([
          "Schon bewusstes Flirten wäre für mich zu viel.",
          "Kurzer Smalltalk ist okay, aber mehr nicht.",
          "Mit klaren Grenzen könnte ich damit umgehen.",
          "Leichtes Flirten finde ich nicht schlimm.",
          "Ich sehe Flirten grundsätzlich sehr entspannt.",
        ]),
      ),
    },
    {
      id: "conflict",
      prompt: `${selfName}, nach einem Streit merkst du, dass dich etwas wirklich verletzt hat. Wie gehst du am ehesten damit um?`,
      answerOptions: createAnswerBranches(
        [
          "Ich spreche es ruhig an, bevor es größer wird.",
          "Ich brauche kurz Abstand und suche dann das Gespräch.",
          "Ich schaue erst, ob es sich von selbst legt.",
          "Ich ziehe mich erst einmal zurück.",
          "Ich spreche es direkt und ohne Umweg an.",
        ],
        [
          "Wie wichtig ist dir, dass Verletzungen früh und ruhig angesprochen werden?",
          "Wie passend fühlt sich eine kurze Pause vor dem Gespräch für dich an?",
          "Kannst du nachvollziehen, Dinge erst einmal etwas sacken zu lassen?",
          "Wie gut könntest du mit Rückzug nach einem Streit umgehen?",
          "Wie gut passt sehr direkte Konfrontation für dich?",
        ],
        createResponseOptions([
          "Ich würde Verletzungen auch früh und ruhig ansprechen.",
          "Kurz Abstand und dann reden fühlt sich für mich richtig an.",
          "Ich lasse manches lieber erst einmal etwas sacken.",
          "Ich ziehe mich in so einem Moment eher zurück.",
          "Ich spreche Probleme lieber sofort und direkt an.",
        ]),
      ),
    },
    {
      id: "cancellation",
      prompt: `${selfName}, ihr habt ein Date geplant und ${partnerName} sagt zwei Stunden vorher ab. Was macht das am ehesten mit dir?`,
      answerOptions: createAnswerBranches(
        [
          "Wenn es ehrlich kommuniziert ist, bleibe ich entspannt.",
          "Ich bin kurz enttäuscht, bleibe aber offen.",
          "Es kommt für mich stark auf den Grund an.",
          "Ich verliere dann ziemlich schnell Interesse.",
          "Danach bin ich eher raus.",
        ],
        [
          "Wie wichtig ist dir Gelassenheit, wenn eine Absage ehrlich begründet ist?",
          "Wie fair wirkt für dich eine kurze Enttäuschung mit offenem Blick nach vorn?",
          "Wie stark hängt dein Urteil bei einer Absage vom Grund ab?",
          "Wie schnell würdest du nach einer späten Absage Distanz aufbauen?",
          "Wann wäre eine späte Absage für dich ein echter Schlussstrich?",
        ],
        createResponseOptions([
          "Eine ehrliche Absage würde ich ziemlich entspannt nehmen.",
          "Ich wäre kurz enttäuscht, bliebe aber offen.",
          "Für mich hängt fast alles vom Grund ab.",
          "Ich würde dadurch eher schnell Distanz aufbauen.",
          "Nach so etwas wäre ich wahrscheinlich eher raus.",
        ]),
      ),
    },
    {
      id: "ex-contact",
      prompt: `${selfName}, dein Gegenüber hat noch regelmäßig Kontakt zur Ex-Person. Wie fühlst du dich damit?`,
      answerOptions: createAnswerBranches(
        [
          "Solange alles transparent ist, stört es mich kaum.",
          "Es ist okay, wenn die Grenzen klar sind.",
          "Ich beobachte erst einmal, wie sich das anfühlt.",
          "Ich wäre damit eher vorsichtig.",
          "Das wäre für mich fast immer ein Problem.",
        ],
        [
          "Wie unproblematisch ist Ex-Kontakt für dich, wenn alles offen ist?",
          "Wie wichtig wären dir klare Grenzen bei Kontakt zur Ex-Person?",
          "Wie sehr würdest du so etwas erst einmal beobachten wollen?",
          "Wie vorsichtig wärst du selbst bei regelmäßigem Ex-Kontakt?",
          "Ab wann wäre Ex-Kontakt für dich ein echtes Problem?",
        ],
        createResponseOptions([
          "Transparenter Ex-Kontakt ist für mich grundsätzlich okay.",
          "Mit klaren Grenzen könnte ich gut leben.",
          "Ich müsste erst sehen, wie es sich konkret anfühlt.",
          "Regelmäßiger Ex-Kontakt würde mich eher vorsichtig machen.",
          "Das wäre für mich ziemlich schnell ein Problem.",
        ]),
      ),
    },
    {
      id: "party-alone",
      prompt: `${selfName}, deine Person geht feiern und du bist nicht dabei. Was ist für dich am stimmigsten?`,
      answerOptions: createAnswerBranches(
        [
          "Ich brauche da kaum Updates, ich vertraue einfach.",
          "Eine kurze Nachricht zwischendurch finde ich schön.",
          "Einmal kurz hören reicht mir meistens.",
          "Ich merke, dass mir das eher Unsicherheit gibt.",
          "Ohne enge Abstimmung fände ich das schwierig.",
        ],
        [
          "Wie leicht fällt dir Vertrauen, wenn die andere Person ohne dich feiern geht?",
          "Wie schön wäre für dich eine kleine Nachricht zwischendurch?",
          "Wie sehr reicht dir in so einer Nacht ein kurzes Lebenszeichen?",
          "Wie schnell würde so eine Situation dir Unsicherheit geben?",
          "Wie eng abgestimmt müsstest du dich in so einer Nacht fühlen?",
        ],
        createResponseOptions([
          "Ich brauche da kaum Rückversicherung.",
          "Eine kleine Nachricht zwischendurch finde ich schön.",
          "Ein kurzes Lebenszeichen würde mir reichen.",
          "Ohne Rückmeldung wäre ich eher angespannt.",
          "Ich bräuchte in so einer Situation viel Sicherheit.",
        ]),
      ),
    },
    {
      id: "phone-privacy",
      prompt: `${selfName}, wie gehst du in einer Beziehung mit Handy und Privatsphäre um?`,
      answerOptions: createAnswerBranches(
        [
          "Vertrauen heißt für mich: gar nicht kontrollieren.",
          "Offenheit ist gut, aber jeder darf seinen Raum haben.",
          "Ich finde gemeinsame Regeln sinnvoll.",
          "Ich wäre bei dem Thema eher sensibel.",
          "Wenn etwas komisch wirkt, würde ich Klarheit wollen.",
        ],
        [
          "Wie sehr heißt Vertrauen für dich auch, Privatsphäre ganz unangetastet zu lassen?",
          "Wie passend ist für dich Offenheit bei gleichzeitig klaren eigenen Räumen?",
          "Wie hilfreich fändest du feste Regeln rund ums Handy?",
          "Wie sensibel bist du selbst beim Thema Privatsphäre im Handy?",
          "Wann würdest du bei komischem Gefühl aktiv Klarheit einfordern?",
        ],
        createResponseOptions([
          "Kontrolle wäre für mich gar kein Thema.",
          "Offenheit ja, aber jedes Handy bleibt privat.",
          "Gemeinsame Regeln dazu fände ich sinnvoll.",
          "Wenn etwas komisch wirkt, würde ich nachhaken.",
          "Bei dem Thema hätte ich schnell ein Problem.",
        ]),
      ),
    },
    {
      id: "physical-pace",
      prompt: `${selfName}, wenn es körperlich schnell intensiv wird, was beschreibt dich am ehesten?`,
      answerOptions: createAnswerBranches(
        [
          "Ich brauche dafür Zeit und echtes Vertrauen.",
          "Ich lasse es ruhig entstehen.",
          "Wenn es sich gut anfühlt, bin ich offen.",
          "Ich bin da eher spontan.",
          "Ich entscheide das sehr aus dem Moment heraus.",
        ],
        [
          "Wie wichtig sind dir Zeit und Vertrauen bei körperlicher Nähe?",
          "Wie stimmig fühlt sich für dich ein ruhiges Tempo an?",
          "Wie offen bist du, wenn es sich einfach gut anfühlt?",
          "Wie spontan darf körperliche Nähe für dich entstehen?",
          "Wie stark entscheidest du so etwas aus dem Moment heraus?",
        ],
        createResponseOptions([
          "Ich brauche dabei viel Zeit und Vertrauen.",
          "Langsam und ruhig fühlt sich für mich richtig an.",
          "Wenn es passt, darf es sich natürlich entwickeln.",
          "Ich bin bei Nähe eher offen und spontan.",
          "Ich entscheide so etwas stark aus dem Moment heraus.",
        ]),
      ),
    },
    {
      id: "social-media",
      prompt: `${selfName}, jemand schreibt deiner Person regelmäßig auf Social Media. Was wäre für dich okay?`,
      answerOptions: createAnswerBranches(
        [
          "Solange alles offen ist, sehe ich darin kein Problem.",
          "Unproblematisch, solange die Grenzen klar sind.",
          "Kommt auf Ton und Häufigkeit an.",
          "Ich fände das eher unangenehm.",
          "Das wäre schnell ein klares Thema für mich.",
        ],
        [
          "Wie entspannt bist du bei Nachrichten von außen, wenn alles offen ist?",
          "Wie wichtig sind dir klare Grenzen bei Kontakt von außen?",
          "Wie sehr hängt es für dich von Ton und Häufigkeit ab?",
          "Wie unangenehm würdest du regelmäßige Nachrichten von außen finden?",
          "Wann würde so etwas für dich ein klares Thema werden?",
        ],
        createResponseOptions([
          "Nachrichten von außen stören mich kaum.",
          "Solange Grenzen klar sind, ist das okay.",
          "Das hängt für mich stark von Ton und Intensität ab.",
          "Ich fände regelmäßiges Schreiben eher unangenehm.",
          "Das wäre ziemlich schnell ein rotes Tuch für mich.",
        ]),
      ),
    },
    {
      id: "apology",
      prompt: `${selfName}, du merkst, dass du einen Fehler gemacht hast. Wie entschuldigst du dich am ehesten?`,
      answerOptions: createAnswerBranches(
        [
          "Klar, direkt und ohne Ausreden.",
          "Ich suche schnell das Gespräch und erkläre mich.",
          "Ich brauche kurz, um es richtig einzuordnen.",
          "Ich tue mich mit Entschuldigungen eher schwer.",
          "Ich brauche oft länger, bis ich das zugebe.",
        ],
        [
          "Wie wichtig ist dir eine klare, direkte Entschuldigung ohne Ausreden?",
          "Wie gut fühlt sich eine schnelle Erklärung im Gespräch für dich an?",
          "Wie viel Verständnis hast du dafür, wenn jemand kurz sortieren muss?",
          "Wie schwer wäre für dich eine Person, die sich mit Entschuldigungen schwertut?",
          "Wie lange könntest du damit umgehen, wenn Einsicht erst spät kommt?",
        ],
        createResponseOptions([
          "Eine klare direkte Entschuldigung brauche ich fast immer.",
          "Schnell das Gespräch zu suchen fühlt sich für mich richtig an.",
          "Kurzes Sortieren ist okay, solange danach Klarheit kommt.",
          "Ich kann auch mit längerer Verarbeitung noch umgehen.",
          "Späte Einsicht wäre für mich nicht automatisch ein Problem.",
        ]),
      ),
    },
    {
      id: "family-intro",
      prompt: `${selfName}, wann würdest du eine neue Person ungefähr deinem Umfeld vorstellen?`,
      answerOptions: createAnswerBranches(
        [
          "Erst wenn ich wirklich sicher bin.",
          "Nach etwas gemeinsamer Zeit und Klarheit.",
          "Wenn es sich natürlich ergibt.",
          "Relativ früh, um zu sehen wie es passt.",
          "Ich bin da ziemlich spontan.",
        ],
        [
          "Wie spät würdest du eine Person erst deinem Umfeld zeigen?",
          "Wie viel gemeinsame Zeit und Klarheit brauchst du dafür meistens?",
          "Wie natürlich darf das Kennenlernen mit deinem Umfeld für dich entstehen?",
          "Wie offen wärst du für ein eher frühes Kennenlernen mit dem Umfeld?",
          "Wie spontan darf so ein Schritt für dich sein?",
        ],
        createResponseOptions([
          "Ich würde mein Umfeld erst sehr spät einbeziehen.",
          "Nach etwas Zeit und Sicherheit fühlt es sich richtig an.",
          "Wenn es sich natürlich ergibt, ist es gut.",
          "Ein frühes Kennenlernen finde ich eher positiv.",
          "Ich bin damit ziemlich locker und spontan.",
        ]),
      ),
    },
    {
      id: "move-away",
      prompt: `${selfName}, eine Person, die du magst, bekommt ein starkes Jobangebot in einer anderen Stadt. Wie denkst du zuerst darüber?`,
      answerOptions: createAnswerBranches(
        [
          "Ich schaue zuerst, wie wir gemeinsam eine Lösung finden.",
          "Ich bin offen, wenn die Verbindung stark ist.",
          "Ich würde es mir ehrlich offenhalten.",
          "Distanz macht mich eher skeptisch.",
          "Das wäre für mich fast direkt ein Stop.",
        ],
        [
          "Wie sehr suchst du zuerst nach einer gemeinsamen Lösung bei Distanz?",
          "Wie offen bist du für Distanz, wenn die Verbindung stark ist?",
          "Wie sehr würdest du dir das erst ehrlich offenhalten?",
          "Wie skeptisch macht dich räumliche Distanz generell?",
          "Ab wann wäre Distanz für dich fast direkt ein Schlussstrich?",
        ],
        createResponseOptions([
          "Ich würde zuerst nach einer gemeinsamen Lösung suchen.",
          "Wenn die Verbindung stark ist, wäre ich offen.",
          "Ich würde ehrlich prüfen, ob es tragbar ist.",
          "Distanz macht mich eher skeptisch.",
          "Für mich wäre das fast direkt ein Ende.",
        ]),
      ),
    },
    {
      id: "alone-time",
      prompt: `${selfName}, wie wichtig ist dir in einer Beziehung eigener Freiraum?`,
      answerOptions: createAnswerBranches(
        [
          "Sehr wichtig, ohne dass Nähe darunter leidet.",
          "Wichtig, aber gut abgestimmt.",
          "Ich mag eine gute Balance.",
          "Zu viel Abstand macht mich eher unsicher.",
          "Ich wünsche mir meistens sehr viel Nähe.",
        ],
        [
          "Wie wichtig ist eigener Raum für dich, ohne dass Nähe verloren geht?",
          "Wie gut passt für dich Freiraum, wenn er gut abgestimmt ist?",
          "Wie sehr suchst du selbst eine Balance aus Nähe und Eigenem?",
          "Wie schnell macht dich zu viel Abstand eher unsicher?",
          "Wie viel dauerhafte Nähe wünschst du dir meistens?",
        ],
        createResponseOptions([
          "Eigener Raum ist für mich sehr wichtig.",
          "Freiraum gehört für mich klar dazu.",
          "Ich mag eine gute Balance aus Nähe und Eigenem.",
          "Zu viel Abstand macht mich eher unsicher.",
          "Ich wünsche mir meistens sehr viel gemeinsame Zeit.",
        ]),
      ),
    },
    {
      id: "money-date",
      prompt: `${selfName}, beim ersten teureren Date: Wie gehst du am liebsten mit dem Bezahlen um?`,
      answerOptions: createAnswerBranches(
        [
          "Am liebsten ganz selbstverständlich teilen.",
          "Ich finde Abwechseln charmant.",
          "Mir ist wichtiger, dass es locker bleibt.",
          "Ich mag es, wenn eine Person übernimmt.",
          "Ich habe da eher ein klassisches Bild.",
        ],
        [
          "Wie selbstverständlich fühlt sich Teilen für dich bei einem Date an?",
          "Wie charmant findest du eher ein lockeres Abwechseln?",
          "Wie wichtig ist dir vor allem, dass es ohne Druck bleibt?",
          "Wie gern darf eine Person bei einem Date übernehmen?",
          "Wie klassisch ist dein Bild beim Bezahlen eher?",
        ],
        createResponseOptions([
          "Teilen fühlt sich für mich am besten an.",
          "Ich mag es, wenn man sich abwechselt.",
          "Hauptsache es bleibt locker und fair.",
          "Ich finde es schön, wenn eine Person öfter übernimmt.",
          "Ich mag da eher klassische Rollen.",
        ]),
      ),
    },
    {
      id: "stress",
      prompt: `${selfName}, wenn du beruflich oder privat stark unter Druck stehst, was passiert meistens mit dir?`,
      answerOptions: createAnswerBranches(
        [
          "Ich kommuniziere das offen und bleibe erreichbar.",
          "Ich ziehe mich etwas zurück, sage das aber klar.",
          "Ich funktioniere erst und rede später darüber.",
          "Ich werde dann schnell still.",
          "In Stressphasen bin ich kaum erreichbar.",
        ],
        [
          "Wie wichtig ist dir offene Kommunikation auch in Stressphasen?",
          "Wie verständlich ist für dich etwas Rückzug, wenn er klar benannt wird?",
          "Wie gut passt für dich erst funktionieren und später reden?",
          "Wie schwer wäre für dich eine Person, die dann schnell still wird?",
          "Wie gut könntest du mit kaum Erreichbarkeit in Stressphasen umgehen?",
        ],
        createResponseOptions([
          "Auch in Stressphasen bleibe ich eher offen und erreichbar.",
          "Ich ziehe mich etwas zurück, sage das aber klar.",
          "Oft funktioniere ich erst und rede später darüber.",
          "Unter Stress werde ich eher still.",
          "In Stressphasen bin ich häufig kaum erreichbar.",
        ]),
      ),
    },
    {
      id: "exclusive",
      prompt: `${selfName}, ab wann fühlt sich Dating für dich exklusiv an?`,
      answerOptions: createAnswerBranches(
        [
          "Erst wenn man es klar ausgesprochen hat.",
          "Relativ früh, wenn beide ernst wirken.",
          "Es entwickelt sich für mich eher schrittweise.",
          "Ich brauche dafür deutlich mehr Zeit.",
          "Exklusivität ist für mich sehr spät ein Thema.",
        ],
        [
          "Wie wichtig ist dir ein klares ausgesprochenes Exklusivitätsgespräch?",
          "Wie früh fühlst du Exklusivität, wenn beide ernst wirken?",
          "Wie natürlich entwickelt sich Exklusivität für dich eher schrittweise?",
          "Wie viel Zeit brauchst du selbst bis zu echter Exklusivität?",
          "Wie spät wird Exklusivität für dich überhaupt erst relevant?",
        ],
        createResponseOptions([
          "Exklusivität beginnt für mich erst nach einem klaren Gespräch.",
          "Wenn beide ernst wirken, darf es früh klar werden.",
          "Ich sehe das eher als fließenden Übergang.",
          "Ich brauche lange, bis ich Exklusivität wirklich fühle.",
          "Für mich ist Exklusivität erst sehr spät ein Thema.",
        ]),
      ),
    },
    {
      id: "doubt",
      prompt: `${selfName}, du merkst, dass du bei jemandem Zweifel hast. Wie gehst du damit am ehesten um?`,
      answerOptions: createAnswerBranches(
        [
          "Ich spreche es ehrlich an.",
          "Ich beobachte kurz und rede dann offen darüber.",
          "Ich will erst verstehen, ob es nur eine Phase ist.",
          "Ich ziehe mich eher zurück.",
          "Wenn ich zweifle, bin ich innerlich meist schon weg.",
        ],
        [
          "Wie schnell würdest du Zweifel ehrlich ansprechen?",
          "Wie passend ist für dich erst beobachten und dann offen reden?",
          "Wie sehr möchtest du Zweifel erst für dich einordnen?",
          "Wie gut könntest du mit Rückzug bei Zweifel umgehen?",
          "Wie endgültig fühlt sich innerer Rückzug für dich an?",
        ],
        createResponseOptions([
          "Zweifel würde ich früh offen ansprechen.",
          "Erst sortieren und dann ehrlich reden passt zu mir.",
          "Ich will Zweifel oft erst für mich verstehen.",
          "Ich ziehe mich bei Zweifel eher etwas zurück.",
          "Wenn ich innerlich stark zweifle, bin ich oft schnell weg.",
        ]),
      ),
    },
    {
      id: "friends-opinion",
      prompt: `${selfName}, dein enges Umfeld mag eine Person nicht, die du datest. Wie sehr beeinflusst dich das?`,
      answerOptions: createAnswerBranches(
        [
          "Ich höre es mir an, entscheide aber selbst.",
          "Ich nehme es ernst, ohne sofort zu kippen.",
          "Es würde mich schon nachdenklich machen.",
          "Das hätte für mich viel Gewicht.",
          "Ohne Rückhalt von meinem Umfeld wäre ich fast raus.",
        ],
        [
          "Wie unabhängig triffst du solche Entscheidungen trotz Gegenwind von außen?",
          "Wie ernst nimmst du Warnungen aus deinem Umfeld, ohne sofort zu kippen?",
          "Wie nachdenklich würde dich so ein Gegenwind machen?",
          "Wie viel Gewicht hätte das Urteil deines Umfelds für dich?",
          "Wie wichtig ist dir der Rückhalt deines Umfelds für ein Weitergehen?",
        ],
        createResponseOptions([
          "Ich höre mein Umfeld an, entscheide aber selbst.",
          "Warnungen nehme ich ernst, ohne sofort zu kippen.",
          "Mich würde das deutlich nachdenklich machen.",
          "Die Meinung meines Umfelds hätte viel Gewicht.",
          "Ohne Rückhalt von außen würde ich stark zweifeln.",
        ]),
      ),
    },
    {
      id: "holiday",
      prompt: `${selfName}, eine gemeinsame Reise steht im Raum. Wann fühlt sich das für dich richtig an?`,
      answerOptions: createAnswerBranches(
        [
          "Erst wenn schon viel Vertrauen da ist.",
          "Nach einer gewissen Stabilität.",
          "Wenn es sich natürlich ergibt.",
          "Ich bin dafür ziemlich offen.",
          "Ich mache so etwas eher spontan.",
        ],
        [
          "Wie viel Vertrauen brauchst du, bevor eine gemeinsame Reise passt?",
          "Wie wichtig ist dir erst eine gewisse Stabilität?",
          "Wie natürlich darf eine gemeinsame Reise für dich entstehen?",
          "Wie offen bist du selbst für eine frühere gemeinsame Reise?",
          "Wie spontan darf so ein Schritt für dich sein?",
        ],
        createResponseOptions([
          "Reisen würde ich erst mit viel Vertrauen angehen.",
          "Nach etwas Stabilität fühlt es sich gut an.",
          "Wenn es sich ergibt, bin ich offen dafür.",
          "Ich würde so etwas eher früh ausprobieren.",
          "Ich bin bei solchen Dingen ziemlich spontan.",
        ]),
      ),
    },
    {
      id: "late-replies",
      prompt: `${selfName}, eine Person antwortet immer wieder erst viele Stunden später. Was löst das bei dir aus?`,
      answerOptions: createAnswerBranches(
        [
          "Nicht viel, wenn der Kontakt sonst stimmig ist.",
          "Ich merke es, kann aber gut damit umgehen.",
          "Kommt auf Kontext und Verbindlichkeit an.",
          "Ich verliere dann eher Vertrauen.",
          "Das wäre für mich ziemlich schnell ein Problem.",
        ],
        [
          "Wie entspannt bist du bei langen Antwortzeiten, wenn sonst alles stimmig ist?",
          "Wie gut kannst du mit längeren Pausen im Schreiben umgehen?",
          "Wie sehr hängt das für dich von Kontext und Verbindlichkeit ab?",
          "Wie schnell schwächen lange Pausen dein Vertrauen?",
          "Ab wann wären späte Antworten für dich ein echtes Problem?",
        ],
        createResponseOptions([
          "Lange Antwortzeiten stressen mich kaum.",
          "Ich kann gut damit umgehen, wenn sonst alles klar ist.",
          "Für mich hängt es von Kontext und Verbindlichkeit ab.",
          "Auf Dauer würde es mein Vertrauen schwächen.",
          "Das wäre für mich ziemlich schnell zu wenig.",
        ]),
      ),
    },
    {
      id: "public-relationship",
      prompt: `${selfName}, wie schnell würdest du eine Beziehung öffentlich machen?`,
      answerOptions: createAnswerBranches(
        [
          "Sehr spät, das ist für mich etwas Privates.",
          "Wenn es sich stabil anfühlt.",
          "Es ist mir eher nicht so wichtig.",
          "Ich teile so etwas gern relativ früh.",
          "Wenn es schön ist, darf man es auch sofort zeigen.",
        ],
        [
          "Wie privat hältst du Beziehungen lieber am Anfang?",
          "Wie wichtig ist dir erst Stabilität, bevor etwas öffentlich wird?",
          "Wie egal oder wichtig ist Öffentlichkeit für dich grundsätzlich?",
          "Wie gern würdest du eine Beziehung eher früh sichtbar machen?",
          "Wie schnell dürfte eine schöne Beziehung für dich auch nach außen sichtbar sein?",
        ],
        createResponseOptions([
          "Ich halte Beziehungen lieber lange privat.",
          "Öffentlich würde es für mich erst bei Stabilität werden.",
          "Ob es sichtbar ist, ist mir nicht so wichtig.",
          "Ich teile schöne Dinge gern eher früh.",
          "Wenn es gut ist, dürfte man es auch schnell zeigen.",
        ]),
      ),
    },
  ];

  const shuffled = [...questionBank];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[randomIndex];
    shuffled[randomIndex] = current;
  }

  return shuffled.slice(0, Math.min(PHASE_TWO_ROUNDS_PER_SESSION, shuffled.length));
}

function parseJsonList<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function classifyProfileTarget(profile: CandidateProfile) {
  if (profile.lookingFor === "Alle") {
    return "Alle";
  }

  if (profile.pronouns === "sie/ihr") {
    return "Frauen";
  }

  if (profile.pronouns === "er/ihm") {
    return "Männer";
  }

  return "Alle";
}

function isMutuallyCompatible(viewer: CandidateProfile, candidate: CandidateProfile) {
  const viewerTarget = classifyProfileTarget(candidate);
  const candidateTarget = classifyProfileTarget(viewer);

  const viewerAccepts = viewer.lookingFor === "Alle" || viewer.lookingFor === viewerTarget;
  const candidateAccepts = candidate.lookingFor === "Alle" || candidate.lookingFor === candidateTarget;
  const viewerAgeOk = candidate.age >= viewer.ageRangeMin && candidate.age <= viewer.ageRangeMax;
  const candidateAgeOk = viewer.age >= candidate.ageRangeMin && viewer.age <= candidate.ageRangeMax;

  return viewerAccepts && candidateAccepts && viewerAgeOk && candidateAgeOk;
}

function calculateCandidateScore(viewer: CandidateProfile, candidate: CandidateProfile) {
  const sharedInterests = viewer.interests.filter((interest) => candidate.interests.includes(interest));
  const sameCity = viewer.city.trim().toLocaleLowerCase("de-DE") === candidate.city.trim().toLocaleLowerCase("de-DE");
  const sameIntent = viewer.datingIntent === candidate.datingIntent;
  const sameLookingFor = viewer.lookingFor === candidate.lookingFor;

  const score =
    sharedInterests.length * 18
    + (sameCity ? 12 : 0)
    + (sameIntent ? 10 : 0)
    + (sameLookingFor ? 6 : 0);

  return {
    score,
    sharedInterests,
  };
}

async function ensureChatForMatch(match: MatchWithRelations) {
  if (match.chat) {
    return match.chat;
  }

  return prisma.chat.create({
    data: {
      matchId: match.id,
      members: {
        create: [
          { userId: match.userAId },
          { userId: match.userBId },
        ],
      },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

async function getMatchById(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      userA: { include: { profile: true } },
      userB: { include: { profile: true } },
      chat: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
}

async function activatePendingMatch(match: MatchWithRelations, now: Date) {
  const activated = await prisma.match.update({
    where: { id: match.id },
    data: {
      status: MatchStatus.ACTIVE,
      activatedAt: match.activatedAt ?? now,
      phaseOneStarterUserId: match.phaseOneStarterUserId ?? chooseStableStarterUserId(match.userAId, match.userBId),
    },
  });

  const refreshed = await getMatchById(activated.id);

  if (!refreshed) {
    return null;
  }

  if (!refreshed.chat) {
    await ensureChatForMatch(refreshed);
  }

  const hydratedMatch = await getMatchById(activated.id);

  if (hydratedMatch) {
    const participantNotifications = [
      {
        recipientUserId: hydratedMatch.userAId,
        partnerName: hydratedMatch.userB.profile?.firstName?.trim() || "dein Match",
      },
      {
        recipientUserId: hydratedMatch.userBId,
        partnerName: hydratedMatch.userA.profile?.firstName?.trim() || "dein Match",
      },
    ];

    await Promise.allSettled(
      participantNotifications.map(({ recipientUserId, partnerName }) =>
        sendJourneyNotificationToUser({
          userId: recipientUserId,
          matchId: hydratedMatch.id,
          kind: "match-release",
          contextKey: `match-release:${hydratedMatch.id}:${recipientUserId}`,
          title: "Dein neues Match ist da",
          body:
            hydratedMatch.phaseOneStarterUserId === recipientUserId
              ? `${partnerName} wurde gerade für dich freigeschaltet. Choice hat dich ausgewählt, zuerst zu schreiben.`
              : `${partnerName} wurde gerade für dich freigeschaltet.`,
          channelId: "match-releases",
          data: {
            type: "match-release",
            matchId: hydratedMatch.id,
          },
        })),
    );
  }

  return hydratedMatch;
}

async function maybeCreateUpcomingMatch(userId: string, now: Date) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
    },
  });

  if (!user?.profile || !user.profileCompleted || user.suspendedAt || user.bannedAt) {
    return null;
  }

  const existingUpcoming = await prisma.match.findFirst({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      status: { in: [MatchStatus.PENDING, MatchStatus.ACTIVE, MatchStatus.KEPT] },
      closedAt: null,
    },
    orderBy: [{ status: "asc" }, { scheduledFor: "asc" }],
  });

  if (existingUpcoming) {
    return existingUpcoming.id;
  }

  const candidateUsers = await prisma.user.findMany({
    where: {
      id: { not: userId },
      profileCompleted: true,
      suspendedAt: null,
      bannedAt: null,
      profile: { isNot: null },
      matchesAsA: {
        none: {
          status: { in: [MatchStatus.PENDING, MatchStatus.ACTIVE, MatchStatus.KEPT] },
          closedAt: null,
        },
      },
      matchesAsB: {
        none: {
          status: { in: [MatchStatus.PENDING, MatchStatus.ACTIVE, MatchStatus.KEPT] },
          closedAt: null,
        },
      },
    },
    include: {
      profile: true,
    },
  });

  const viewerProfile: CandidateProfile = {
    userId: user.id,
    age: user.profile.age,
    city: user.profile.city,
    identity: user.profile.identity,
    pronouns: user.profile.pronouns,
    lookingFor: user.profile.lookingFor,
    datingIntent: user.profile.datingIntent,
    ageRangeMin: user.profile.ageRangeMin,
    ageRangeMax: user.profile.ageRangeMax,
    interests: user.profile.interests,
  };

  const existingPairs = await prisma.match.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: {
      userAId: true,
      userBId: true,
      scheduledFor: true,
    },
  });

  const candidateHistory = new Map<
    string,
    {
      timesMatched: number;
      lastMatchedAt: number | null;
    }
  >();

  for (const entry of existingPairs) {
    const partnerUserId = entry.userAId === userId ? entry.userBId : entry.userAId;
    const previous = candidateHistory.get(partnerUserId);
    const scheduledAt = entry.scheduledFor.getTime();

    if (!previous) {
      candidateHistory.set(partnerUserId, {
        timesMatched: 1,
        lastMatchedAt: scheduledAt,
      });
      continue;
    }

    candidateHistory.set(partnerUserId, {
      timesMatched: previous.timesMatched + 1,
      lastMatchedAt:
        previous.lastMatchedAt === null ? scheduledAt : Math.max(previous.lastMatchedAt, scheduledAt),
    });
  }

  const isBetterCandidate = (
    candidate: {
      score: number;
      timesMatched: number;
      lastMatchedAt: number | null;
    },
    current: {
      score: number;
      timesMatched: number;
      lastMatchedAt: number | null;
    } | null,
  ) => {
    if (!current) {
      return true;
    }

    if (candidate.timesMatched !== current.timesMatched) {
      return candidate.timesMatched < current.timesMatched;
    }

    const candidateLastMatchedAt = candidate.lastMatchedAt ?? Number.NEGATIVE_INFINITY;
    const currentLastMatchedAt = current.lastMatchedAt ?? Number.NEGATIVE_INFINITY;

    if (candidateLastMatchedAt !== currentLastMatchedAt) {
      return candidateLastMatchedAt < currentLastMatchedAt;
    }

    return candidate.score > current.score;
  };

  let bestCandidate:
    | {
        userId: string;
        score: number;
        sharedInterests: string[];
        timesMatched: number;
        lastMatchedAt: number | null;
      }
    | null = null;

  for (const candidateUser of candidateUsers) {
    if (!candidateUser.profile) {
      continue;
    }

    const candidateProfile: CandidateProfile = {
      userId: candidateUser.id,
      age: candidateUser.profile.age,
      city: candidateUser.profile.city,
      identity: candidateUser.profile.identity,
      pronouns: candidateUser.profile.pronouns,
      lookingFor: candidateUser.profile.lookingFor,
      datingIntent: candidateUser.profile.datingIntent,
      ageRangeMin: candidateUser.profile.ageRangeMin,
      ageRangeMax: candidateUser.profile.ageRangeMax,
      interests: candidateUser.profile.interests,
    };

    if (!isMutuallyCompatible(viewerProfile, candidateProfile)) {
      continue;
    }

    const score = calculateCandidateScore(viewerProfile, candidateProfile);
    const history = candidateHistory.get(candidateUser.id);
    const timesMatched = history?.timesMatched ?? 0;
    const lastMatchedAt = history?.lastMatchedAt ?? null;

    if (isBetterCandidate({ score: score.score, timesMatched, lastMatchedAt }, bestCandidate)) {
      bestCandidate = {
        userId: candidateUser.id,
        score: score.score,
        sharedInterests: score.sharedInterests,
        timesMatched,
        lastMatchedAt,
      };
    }
  }

  if (!bestCandidate) {
    return null;
  }

  const scheduledFor = getNextMatchReleaseAt(now);
  const compatibility = Math.max(0.55, Math.min(0.99, 0.55 + bestCandidate.score / 100));
  const [userAId, userBId] = [userId, bestCandidate.userId].sort();

  const match = await prisma.match.create({
    data: {
      scheduledFor,
      status: MatchStatus.PENDING,
      userAId,
      userBId,
      phaseOneStarterUserId: chooseStableStarterUserId(userAId, userBId),
      compatibility,
      rationale: {
        sharedInterests: bestCandidate.sharedInterests,
        generatedBy: "backend-basic-matchmaking",
      },
    },
  });

  return match.id;
}

async function findJourneyMatchForUser(userId: string, now: Date): Promise<MatchWithRelations | null> {
  const activeOrKept = await prisma.match.findFirst({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      status: { in: [MatchStatus.ACTIVE, MatchStatus.KEPT] },
      closedAt: null,
    },
    orderBy: { scheduledFor: "desc" },
    include: {
      userA: { include: { profile: true } },
      userB: { include: { profile: true } },
      chat: { include: { messages: { orderBy: { createdAt: "asc" } } } },
    },
  });

  if (activeOrKept) {
    return activeOrKept;
  }

  const pending = await prisma.match.findFirst({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      status: MatchStatus.PENDING,
      closedAt: null,
    },
    orderBy: { scheduledFor: "asc" },
    include: {
      userA: { include: { profile: true } },
      userB: { include: { profile: true } },
      chat: { include: { messages: { orderBy: { createdAt: "asc" } } } },
    },
  });

  if (pending) {
    const currentCycleRelease = setTimeOfDay(now, MATCH_RELEASE_HOUR, MATCH_RELEASE_MINUTE);
    const currentCycleDecisionDeadline = addMinutes(currentCycleRelease, PHASE_INTERVAL_MINUTES);

    if (
      pending.scheduledFor.getTime() > now.getTime()
      && now >= currentCycleRelease
      && now < currentCycleDecisionDeadline
    ) {
      await prisma.match.update({
        where: { id: pending.id },
        data: {
          scheduledFor: currentCycleRelease,
        },
      });

      const shiftedPending = await getMatchById(pending.id);
      if (shiftedPending) {
        return activatePendingMatch(shiftedPending, now);
      }
    }

    if (pending.scheduledFor.getTime() <= now.getTime()) {
      return activatePendingMatch(pending, now);
    }

    return pending;
  }

  const createdMatchId = await maybeCreateUpcomingMatch(userId, now);

  if (!createdMatchId) {
    return null;
  }

  return getMatchById(createdMatchId);
}

async function applyJourneyLifecycle(match: MatchWithRelations, now: Date) {
  const schedule = buildPhaseSchedule(match.scheduledFor);
  const chat = match.chat ?? await ensureChatForMatch(match);
  const userMessages = chat.messages.filter((message) => message.kind !== MessageKind.SYSTEM);

  await syncJourneyPhaseNotifications(match, now, userMessages, schedule);

  if (
    match.status === MatchStatus.ACTIVE
    && now >= schedule.decisionDeadline
    && !userMessages.length
    && match.phaseOneStarterUserId
    && !match.phaseOneStarterPenaltyAppliedAt
  ) {
    await applySystemPenalty({
      userId: match.phaseOneStarterUserId,
      reason: "PHASE_ONE_NOT_STARTED",
      contextKey: `phase-one-starter-missed:${match.id}:${match.phaseOneStarterUserId}`,
      note: "Keine erste Nachricht bis zum Ende von Phase 1.",
    });

    await prisma.match.update({
      where: { id: match.id },
      data: {
        phaseOneStarterPenaltyAppliedAt: now,
      },
    });
  }

  const phaseTwoResults = parseJsonList<JourneyPhaseTwoRoundResult>(match.phaseTwoResults);
  const phaseTwoReady = match.phaseTwoStage === PhaseTwoStage.RESULT && phaseTwoResults.length > 0;
  const phaseTwoCompatibility = phaseTwoReady
    ? Math.round(
        phaseTwoResults.reduce((sum, entry) => sum + entry.compatibility, 0) / phaseTwoResults.length,
      )
    : 0;
  const phaseThreeQualified = phaseTwoReady && phaseTwoCompatibility > PHASE_THREE_THRESHOLD;
  const phaseThreeAnyLeave =
    match.phaseThreeUserADecision === ParticipantDecision.DISCARD
    || match.phaseThreeUserBDecision === ParticipantDecision.DISCARD;
  const phaseThreeBothStay =
    match.phaseThreeUserADecision === ParticipantDecision.KEEP
    && match.phaseThreeUserBDecision === ParticipantDecision.KEEP;

  if (
    match.status === MatchStatus.ACTIVE
    && match.userADecision === ParticipantDecision.KEEP
    && match.userBDecision === ParticipantDecision.KEEP
    && !phaseTwoReady
    && now >= schedule.phaseThreeStart
    && !match.phaseTwoPenaltyAppliedAt
  ) {
    const currentResponderUserId =
      match.phaseTwoStage === PhaseTwoStage.PARTNER
        ? match.phaseTwoPartnerUserId
        : match.phaseTwoStarterUserId ?? chooseStableStarterUserId(match.userAId, match.userBId);

    if (currentResponderUserId) {
      await applySystemPenalty({
        userId: currentResponderUserId,
        reason: "PHASE_TWO_NOT_PLAYED",
        contextKey: `phase-two-missed:${match.id}:${currentResponderUserId}`,
        note: "Phase 2 wurde nicht rechtzeitig gespielt.",
      });

      await prisma.match.update({
        where: { id: match.id },
        data: {
          phaseTwoPenaltyAppliedAt: now,
        },
      });
    }
  }

  if (
    match.status === MatchStatus.ACTIVE
    && now >= schedule.decisionDeadline
    && !(match.userADecision === ParticipantDecision.KEEP && match.userBDecision === ParticipantDecision.KEEP)
  ) {
    await prisma.match.update({
      where: { id: match.id },
      data: {
        status:
          match.userADecision === ParticipantDecision.DISCARD || match.userBDecision === ParticipantDecision.DISCARD
            ? MatchStatus.DISCARDED
            : MatchStatus.EXPIRED,
        closedAt: now,
      },
    });
  }

  if (
    match.status === MatchStatus.ACTIVE
    && phaseTwoReady
    && !phaseThreeQualified
    && now >= schedule.phaseThreeStart
  ) {
    await prisma.match.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.DISCARDED,
        closedAt: now,
      },
    });
  }

  if (
    match.status === MatchStatus.ACTIVE
    && phaseThreeQualified
    && phaseThreeAnyLeave
    && now >= schedule.phaseFourStart
  ) {
    await prisma.match.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.DISCARDED,
        closedAt: now,
      },
    });
  }

  if (
    match.status === MatchStatus.ACTIVE
    && phaseThreeQualified
    && phaseThreeBothStay
    && now >= schedule.phaseFiveStart
  ) {
    await prisma.match.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.KEPT,
      },
    });
  }

  return getMatchById(match.id);
}

async function resolveJourneyMatchForUser(userId: string, now: Date) {
  let match = await findJourneyMatchForUser(userId, now);
  let passes = 0;

  while (match && passes < 12) {
    const lifecycleMatch = await applyJourneyLifecycle(match, now);

    if (!lifecycleMatch) {
      return null;
    }

    if (!lifecycleMatch.closedAt) {
      return lifecycleMatch;
    }

    match = await findJourneyMatchForUser(userId, now);
    passes += 1;
  }

  return match;
}

export async function runJourneyAutomationSweep(now = new Date()) {
  const eligibleUsers = await prisma.user.findMany({
    where: {
      profileCompleted: true,
      suspendedAt: null,
      bannedAt: null,
      profile: { isNot: null },
    },
    select: {
      id: true,
    },
  });

  let processedUsers = 0;
  let failedUsers = 0;

  for (const user of eligibleUsers) {
    try {
      await resolveJourneyMatchForUser(user.id, now);
      processedUsers += 1;
    } catch {
      failedUsers += 1;
    }
  }

  return {
    processedUsers,
    failedUsers,
  };
}

function mapProfileDealbreakers(dealbreaker: string | null) {
  if (!dealbreaker) {
    return {
      greenFlags: [] as string[],
      dealbreakers: [] as string[],
    };
  }

  const parsed = {
    greenFlags: [] as string[],
    dealbreakers: [] as string[],
  };

  for (const section of dealbreaker.split("|").map((entry) => entry.trim()).filter(Boolean)) {
    if (section.startsWith("Pro:")) {
      parsed.greenFlags = section
        .slice(4)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    if (section.startsWith("No-Gos:")) {
      parsed.dealbreakers = section
        .slice(7)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return parsed;
}

function mapPartnerProfile(match: MatchWithRelations, viewerUserId: string): JourneyPartnerProfile | null {
  const partner = match.userAId === viewerUserId ? match.userB : match.userA;

  if (!partner.profile) {
    return null;
  }

  const preferences = mapProfileDealbreakers(partner.profile.dealbreaker);

  return {
    userId: partner.id,
    phoneNumber: partner.phoneNumber,
    firstName: partner.profile.firstName,
    age: partner.profile.age,
    city: partner.profile.city,
    selfDescription: partner.profile.selfDescription,
    pronouns: partner.profile.pronouns,
    identity: partner.profile.identity,
    lookingFor: partner.profile.lookingFor,
    datingIntent: partner.profile.datingIntent,
    ageRangeMin: partner.profile.ageRangeMin,
    ageRangeMax: partner.profile.ageRangeMax,
    interests: partner.profile.interests,
    greenFlags: preferences.greenFlags,
    dealbreakers: preferences.dealbreakers,
    avatarUrl: partner.profile.avatarUrl ?? null,
    photoUrls: partner.profile.photoUrls,
    introVideoUrl: partner.profile.introVideoUrl ?? null,
    matchTime: partner.profile.matchTime,
    conversationStyle: partner.profile.conversationStyle,
  };
}

function mapPhaseOneDecision(value: ParticipantDecision): "continue" | "new-match" | undefined {
  if (value === ParticipantDecision.KEEP) {
    return "continue";
  }

  if (value === ParticipantDecision.DISCARD) {
    return "new-match";
  }

  return undefined;
}

function mapPhaseThreeDecision(value: ParticipantDecision): "stay" | "new-match" | undefined {
  if (value === ParticipantDecision.KEEP) {
    return "stay";
  }

  if (value === ParticipantDecision.DISCARD) {
    return "new-match";
  }

  return undefined;
}

function mapMessage(
  message: NonNullable<MatchWithRelations["chat"]>["messages"][number],
): JourneyMessage | null {
  if (message.kind === MessageKind.SYSTEM) {
    return {
      id: message.id,
      senderUserId: message.senderId,
      kind: "system",
      text: message.body,
      createdAt: message.createdAt.toISOString(),
    };
  }

  if (message.kind === MessageKind.IMAGE) {
    return {
      id: message.id,
      senderUserId: message.senderId,
      kind: "image",
      imageUri: message.body,
      createdAt: message.createdAt.toISOString(),
    };
  }

  return {
    id: message.id,
    senderUserId: message.senderId,
    kind: "text",
    text: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getCurrentJourneyForUser(userId: string): Promise<JourneyState> {
  const now = new Date();
  const match = await resolveJourneyMatchForUser(userId, now);

  if (!match) {
    return {
      ownerUserId: userId,
      matchId: null,
      releaseAt: getNextMatchReleaseAt(now).toISOString(),
      decisionDeadlineAt: null,
      phaseTwoStartAt: null,
      phaseThreeStartAt: null,
      phaseFourStartAt: null,
      phaseFiveStartAt: null,
      status: null,
      partner: null,
      sharedChatMessages: [],
      phaseOneStarterUserId: null,
      phaseOneStarterPenaltyAppliedAt: null,
      phaseTwoPenaltyAppliedAt: null,
      phaseOneDecisions: {},
      phaseThreeDecisions: {},
      phaseTwoRounds: [],
      phaseTwoRoundIndex: 0,
      phaseTwoStage: "starter",
      phaseTwoResults: [],
      phaseTwoStarterUserId: null,
      phaseTwoPartnerUserId: null,
      phaseTwoStarterName: "",
      phaseTwoPartnerName: "",
    };
  }

  const schedule = buildPhaseSchedule(match.scheduledFor);
  const isReleased = match.status !== MatchStatus.PENDING || now >= match.scheduledFor;
  const partner = isReleased ? mapPartnerProfile(match, userId) : null;
  const phaseOneDecisions: Record<string, "continue" | "new-match"> = {};
  const phaseThreeDecisions: Record<string, "stay" | "new-match"> = {};

  const mappedUserADecision = mapPhaseOneDecision(match.userADecision);
  const mappedUserBDecision = mapPhaseOneDecision(match.userBDecision);
  const mappedPhaseThreeUserADecision = mapPhaseThreeDecision(match.phaseThreeUserADecision);
  const mappedPhaseThreeUserBDecision = mapPhaseThreeDecision(match.phaseThreeUserBDecision);

  if (mappedUserADecision) {
    phaseOneDecisions[match.userAId] = mappedUserADecision;
  }

  if (mappedUserBDecision) {
    phaseOneDecisions[match.userBId] = mappedUserBDecision;
  }

  if (mappedPhaseThreeUserADecision) {
    phaseThreeDecisions[match.userAId] = mappedPhaseThreeUserADecision;
  }

  if (mappedPhaseThreeUserBDecision) {
    phaseThreeDecisions[match.userBId] = mappedPhaseThreeUserBDecision;
  }

  const phaseTwoRounds = parseJsonList<JourneyPhaseTwoRoundConfig>(match.phaseTwoRounds);
  const phaseTwoResults = parseJsonList<JourneyPhaseTwoRoundResult>(match.phaseTwoResults);
  const messages = (match.chat?.messages ?? [])
    .map(mapMessage)
    .filter((entry): entry is JourneyMessage => Boolean(entry));

  return {
    ownerUserId: userId,
    matchId: match.id,
    releaseAt: match.scheduledFor.toISOString(),
    decisionDeadlineAt: schedule.decisionDeadline.toISOString(),
    phaseTwoStartAt: schedule.phaseTwoStart.toISOString(),
    phaseThreeStartAt: schedule.phaseThreeStart.toISOString(),
    phaseFourStartAt: schedule.phaseFourStart.toISOString(),
    phaseFiveStartAt: schedule.phaseFiveStart.toISOString(),
    status: match.status,
    partner,
    sharedChatMessages: partner ? messages.filter((entry) => entry.kind !== "system") : [],
    phaseOneStarterUserId: match.phaseOneStarterUserId,
    phaseOneStarterPenaltyAppliedAt: match.phaseOneStarterPenaltyAppliedAt?.toISOString() ?? null,
    phaseTwoPenaltyAppliedAt: match.phaseTwoPenaltyAppliedAt?.toISOString() ?? null,
    phaseOneDecisions,
    phaseThreeDecisions,
    phaseTwoRounds,
    phaseTwoRoundIndex: match.phaseTwoRoundIndex,
    phaseTwoStage:
      match.phaseTwoStage === PhaseTwoStage.PARTNER
        ? "partner"
        : match.phaseTwoStage === PhaseTwoStage.RESULT
          ? "result"
          : "starter",
    phaseTwoResults,
    phaseTwoStarterUserId: match.phaseTwoStarterUserId,
    phaseTwoPartnerUserId: match.phaseTwoPartnerUserId,
    phaseTwoStarterName:
      match.phaseTwoStarterUserId === match.userAId
        ? match.userA.profile?.firstName ?? ""
        : match.phaseTwoStarterUserId === match.userBId
          ? match.userB.profile?.firstName ?? ""
          : "",
    phaseTwoPartnerName:
      match.phaseTwoPartnerUserId === match.userAId
        ? match.userA.profile?.firstName ?? ""
        : match.phaseTwoPartnerUserId === match.userBId
          ? match.userB.profile?.firstName ?? ""
          : "",
  };
}

async function requireCurrentReleasedMatch(userId: string) {
  const now = new Date();
  const match = await resolveJourneyMatchForUser(userId, now);

  if (!match) {
    return { ok: false as const, reason: "MATCH_NOT_FOUND" as const };
  }

  if (match.status === MatchStatus.PENDING && match.scheduledFor > now) {
    return { ok: false as const, reason: "MATCH_NOT_RELEASED" as const };
  }

  return {
    ok: true as const,
    match,
    now,
  };
}

export async function createJourneyMessage(input: {
  userId: string;
  kind: "text" | "image";
  text?: string;
  imageUri?: string;
}) {
  const resolved = await requireCurrentReleasedMatch(input.userId);

  if (!resolved.ok) {
    return resolved;
  }

  const { match, now } = resolved;
  const schedule = buildPhaseSchedule(match.scheduledFor);
  const userMessages = (match.chat?.messages ?? []).filter((message) => message.kind !== MessageKind.SYSTEM);
  const phaseOneChatStarted = userMessages.length > 0;
  const viewerStarts = match.phaseOneStarterUserId === input.userId;
  const phaseTwoResults = parseJsonList<JourneyPhaseTwoRoundResult>(match.phaseTwoResults);
  const phaseTwoReady = match.phaseTwoStage === PhaseTwoStage.RESULT && phaseTwoResults.length > 0;
  const phaseTwoCompatibility = phaseTwoReady
    ? Math.round(phaseTwoResults.reduce((sum, entry) => sum + entry.compatibility, 0) / phaseTwoResults.length)
    : 0;
  const phaseThreeQualified = phaseTwoReady && phaseTwoCompatibility > PHASE_THREE_THRESHOLD;
  const viewerPhaseThreeDecision =
    input.userId === match.userAId ? match.phaseThreeUserADecision : match.phaseThreeUserBDecision;
  const partnerPhaseThreeDecision =
    input.userId === match.userAId ? match.phaseThreeUserBDecision : match.phaseThreeUserADecision;
  const viewerSelectedNewMatch = viewerPhaseThreeDecision === ParticipantDecision.DISCARD;
  const phaseThreeViewerKeepsChat = phaseThreeQualified && viewerPhaseThreeDecision !== ParticipantDecision.DISCARD;
  const phaseTwoChatUnlocked =
    (
      phaseTwoReady
      && now >= schedule.phaseTwoStart
      && now < schedule.phaseThreeStart
      && viewerPhaseThreeDecision !== ParticipantDecision.DISCARD
    )
    || (phaseThreeQualified && phaseThreeViewerKeepsChat && now >= schedule.phaseThreeStart && now < schedule.phaseFourStart);
  const canWrite =
    !viewerSelectedNewMatch
    && (
      phaseTwoChatUnlocked
      || (now >= match.scheduledFor && now < schedule.decisionDeadline && (phaseOneChatStarted || viewerStarts))
    );

  if (!canWrite) {
    return { ok: false as const, reason: "CHAT_LOCKED" as const };
  }

  const chat = match.chat ?? await ensureChatForMatch(match);
  const body = input.kind === "image" ? input.imageUri?.trim() : input.text?.trim();

  if (!body) {
    return { ok: false as const, reason: "INVALID_MESSAGE" as const };
  }

  await prisma.message.create({
    data: {
      chatId: chat.id,
      senderId: input.userId,
      kind: input.kind === "image" ? MessageKind.IMAGE : MessageKind.TEXT,
      body,
    },
  });

  const partnerUserId = input.userId === match.userAId ? match.userBId : match.userAId;
  const senderName =
    input.userId === match.userAId
      ? match.userA.profile?.firstName ?? "Choice"
      : match.userB.profile?.firstName ?? "Choice";

  void sendPushNotificationToUser(partnerUserId, {
    title: senderName,
    body:
      input.kind === "image"
        ? `${senderName} hat dir ein Bild geschickt.`
        : body.length > 120
          ? `${body.slice(0, 117)}...`
          : body,
    channelId: "chat-messages",
    data: {
      type: "chat-message",
      matchId: match.id,
      senderUserId: input.userId,
    },
  });

  return {
    ok: true as const,
    journey: await getCurrentJourneyForUser(input.userId),
  };
}

export async function setPhaseOneDecision(input: {
  userId: string;
  decision: "continue" | "new-match";
}) {
  const resolved = await requireCurrentReleasedMatch(input.userId);

  if (!resolved.ok) {
    return resolved;
  }

  const { match, now } = resolved;
  const schedule = buildPhaseSchedule(match.scheduledFor);

  if (now >= schedule.decisionDeadline) {
    return { ok: false as const, reason: "DECISION_WINDOW_CLOSED" as const };
  }

  const field = input.userId === match.userAId ? "userADecision" : "userBDecision";

  await prisma.match.update({
    where: { id: match.id },
    data: {
      [field]: input.decision === "continue" ? ParticipantDecision.KEEP : ParticipantDecision.DISCARD,
    },
  });

  return {
    ok: true as const,
    journey: await getCurrentJourneyForUser(input.userId),
  };
}

export async function startPhaseTwoForUser(userId: string) {
  const resolved = await requireCurrentReleasedMatch(userId);

  if (!resolved.ok) {
    return resolved;
  }

  const { match, now } = resolved;
  const schedule = buildPhaseSchedule(match.scheduledFor);

  if (match.userADecision !== ParticipantDecision.KEEP || match.userBDecision !== ParticipantDecision.KEEP) {
    return { ok: false as const, reason: "PHASE_TWO_NOT_AVAILABLE" as const };
  }

  if (now < schedule.phaseTwoStart) {
    return { ok: false as const, reason: "PHASE_TWO_NOT_OPEN" as const };
  }

  if (match.phaseTwoStage) {
    return {
      ok: true as const,
      journey: await getCurrentJourneyForUser(userId),
    };
  }

  const starterUserId = chooseStableStarterUserId(match.userAId, match.userBId);
  const partnerUserId = starterUserId === match.userAId ? match.userBId : match.userAId;
  const starterName = starterUserId === match.userAId ? match.userA.profile?.firstName ?? "Choice" : match.userB.profile?.firstName ?? "Choice";
  const partnerName = partnerUserId === match.userAId ? match.userA.profile?.firstName ?? "Choice" : match.userB.profile?.firstName ?? "Choice";
  const rounds = buildPhaseTwoRounds(starterName, partnerName);

  await prisma.match.update({
    where: { id: match.id },
    data: {
      phaseTwoStarterUserId: starterUserId,
      phaseTwoPartnerUserId: partnerUserId,
      phaseTwoStage: PhaseTwoStage.STARTER,
      phaseTwoRoundIndex: 0,
      phaseTwoRounds: rounds as Prisma.InputJsonValue,
      phaseTwoResults: [] as Prisma.InputJsonValue,
    },
  });

  return {
    ok: true as const,
    journey: await getCurrentJourneyForUser(userId),
  };
}

export async function submitPhaseTwoAnswer(input: {
  userId: string;
  stage: "starter" | "partner";
  roundIndex: number;
  optionIndex: number;
}) {
  const resolved = await requireCurrentReleasedMatch(input.userId);

  if (!resolved.ok) {
    return resolved;
  }

  const { match } = resolved;
  const rounds = parseJsonList<JourneyPhaseTwoRoundConfig>(match.phaseTwoRounds);
  const results = parseJsonList<JourneyPhaseTwoRoundResult>(match.phaseTwoResults);

  if (!rounds.length || !match.phaseTwoStage) {
    return { ok: false as const, reason: "PHASE_TWO_NOT_STARTED" as const };
  }

  const expectedStage =
    match.phaseTwoStage === PhaseTwoStage.PARTNER
      ? "partner"
      : match.phaseTwoStage === PhaseTwoStage.RESULT
        ? "result"
        : "starter";

  if (expectedStage !== input.stage) {
    return { ok: false as const, reason: "INVALID_PHASE_TWO_STAGE" as const };
  }

  if (match.phaseTwoRoundIndex !== input.roundIndex || !rounds[input.roundIndex]) {
    return { ok: false as const, reason: "INVALID_PHASE_TWO_ROUND" as const };
  }

  const currentResponderUserId =
    input.stage === "starter" ? match.phaseTwoStarterUserId : match.phaseTwoPartnerUserId;

  if (!currentResponderUserId || currentResponderUserId !== input.userId) {
    return { ok: false as const, reason: "NOT_YOUR_TURN" as const };
  }

  const round = rounds[input.roundIndex];

  if (input.stage === "starter") {
    const branch = round.answerOptions[input.optionIndex];

    if (!branch) {
      return { ok: false as const, reason: "INVALID_PHASE_TWO_OPTION" as const };
    }

    const nextResults = [...results];
    nextResults[input.roundIndex] = {
      roundId: round.id,
      prompt: round.prompt,
      personALabel: branch.label,
      personAScore: branch.score,
      followUpPrompt: branch.followUpPrompt,
      followUpOptions: branch.followUpOptions,
      personBLabel: "",
      personBScore: 0,
      compatibility: 0,
    };

    const nextRoundIndex = input.roundIndex >= rounds.length - 1 ? 0 : input.roundIndex + 1;
    const nextStage = input.roundIndex >= rounds.length - 1 ? PhaseTwoStage.PARTNER : PhaseTwoStage.STARTER;

    await prisma.match.update({
      where: { id: match.id },
      data: {
        phaseTwoResults: nextResults as Prisma.InputJsonValue,
        phaseTwoRoundIndex: nextRoundIndex,
        phaseTwoStage: nextStage,
      },
    });
  } else {
    const currentResult = results[input.roundIndex];

    if (!currentResult) {
      return { ok: false as const, reason: "PHASE_TWO_STARTER_PENDING" as const };
    }

    const option = currentResult.followUpOptions[input.optionIndex];

    if (!option) {
      return { ok: false as const, reason: "INVALID_PHASE_TWO_OPTION" as const };
    }

    const nextResults = [...results];
    nextResults[input.roundIndex] = {
      ...currentResult,
      personBLabel: option.label,
      personBScore: option.score,
      compatibility: getCompatibilityPoints(currentResult.personAScore, option.score),
    };

    const nextRoundIndex = input.roundIndex >= rounds.length - 1 ? input.roundIndex : input.roundIndex + 1;
    const nextStage = input.roundIndex >= rounds.length - 1 ? PhaseTwoStage.RESULT : PhaseTwoStage.PARTNER;

    await prisma.match.update({
      where: { id: match.id },
      data: {
        phaseTwoResults: nextResults as Prisma.InputJsonValue,
        phaseTwoRoundIndex: nextRoundIndex,
        phaseTwoStage: nextStage,
      },
    });
  }

  return {
    ok: true as const,
    journey: await getCurrentJourneyForUser(input.userId),
  };
}

export async function setPhaseThreeDecision(input: {
  userId: string;
  decision: "stay" | "new-match";
}) {
  const resolved = await requireCurrentReleasedMatch(input.userId);

  if (!resolved.ok) {
    return resolved;
  }

  const { match, now } = resolved;
  const schedule = buildPhaseSchedule(match.scheduledFor);
  const phaseTwoResults = parseJsonList<JourneyPhaseTwoRoundResult>(match.phaseTwoResults);
  const phaseTwoReady = match.phaseTwoStage === PhaseTwoStage.RESULT && phaseTwoResults.length > 0;
  const phaseTwoCompatibility = phaseTwoReady
    ? Math.round(phaseTwoResults.reduce((sum, entry) => sum + entry.compatibility, 0) / phaseTwoResults.length)
    : 0;

  if (!phaseTwoReady || phaseTwoCompatibility <= PHASE_THREE_THRESHOLD || now < schedule.phaseThreeStart) {
    return { ok: false as const, reason: "PHASE_THREE_NOT_AVAILABLE" as const };
  }

  const field = input.userId === match.userAId ? "phaseThreeUserADecision" : "phaseThreeUserBDecision";

  await prisma.match.update({
    where: { id: match.id },
    data: {
      [field]: input.decision === "stay" ? ParticipantDecision.KEEP : ParticipantDecision.DISCARD,
    },
  });

  return {
    ok: true as const,
    journey: await getCurrentJourneyForUser(input.userId),
  };
}
