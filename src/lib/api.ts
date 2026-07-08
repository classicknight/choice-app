import { buildSummary, calculateAgeFromProfile, type RegistrationProfile } from "./registration";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

type StartPhoneVerificationResult = {
  ok: true;
  userId: string;
  target: string;
  devCodePreview?: string;
};

type VerifyPhoneVerificationResult = {
  ok: true;
  userId: string;
  profileCompleted: boolean;
};

type CreateProfileResult = {
  ok: true;
  profileId: string;
  summary: string;
};

type CloudinarySignatureResult = {
  ok: true;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

type RemoteProfilePayload = {
  id: string;
  userId: string;
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
  dealbreaker?: string | null;
  avatarUrl?: string | null;
  photoUrls: string[];
  introVideoUrl?: string | null;
  matchTime: string;
  conversationStyle: string;
};

type FetchRemoteProfileResult = {
  ok: true;
  profile: RemoteProfilePayload;
};

type DeleteAccountResult = {
  ok: true;
};

type RemoteAccountStateResult = {
  ok: true;
  account: {
    userId: string;
    isPremium: boolean;
    premiumActivatedAt: string | null;
    penaltyPoints: number;
    suspendedAt: string | null;
    penaltySuspendedAt: string | null;
    bannedAt: string | null;
    accountPaused: boolean;
    accountBanned: boolean;
    paidMatchCredits: number;
    frozenPaidMatchCredits: number;
    forfeitedPaidMatchCredits: number;
    lastPaidMatchPackageAt: string | null;
    hasPaidMatchAccess: boolean;
    penaltyRecoveryWindowDays: number;
    recentPenalties: Array<{
      id: string;
      createdAt: string;
      source: "system" | "report";
      reasonCode: string;
      reasonLabel: string;
      note: string | null;
      reportId: string | null;
    }>;
  };
};

type CreateReportResult = {
  ok: true;
  reportId: string;
};

type ApplySystemPenaltyResult = {
  ok: true;
  applied: boolean;
  account: RemoteAccountStateResult["account"];
};

export type RemoteJourneyPhaseTwoResponseOption = {
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
};

export type RemoteJourneyPhaseTwoAnswerBranch = {
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
  followUpPrompt: string;
  followUpOptions: RemoteJourneyPhaseTwoResponseOption[];
};

export type RemoteJourneyPhaseTwoRoundConfig = {
  id: string;
  prompt: string;
  answerOptions: RemoteJourneyPhaseTwoAnswerBranch[];
};

export type RemoteJourneyPhaseTwoRoundResult = {
  roundId: string;
  prompt: string;
  personALabel: string;
  personAScore: number;
  followUpPrompt: string;
  followUpOptions: RemoteJourneyPhaseTwoResponseOption[];
  personBLabel: string;
  personBScore: number;
  compatibility: number;
};

export type RemoteJourneyMessage = {
  id: string;
  senderUserId: string;
  kind: "text" | "image" | "system";
  text?: string;
  imageUri?: string;
  createdAt: string;
};

export type RemoteJourneyPartnerProfile = {
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

export type RemoteJourneyState = {
  ownerUserId: string;
  matchId: string | null;
  releaseAt: string | null;
  decisionDeadlineAt: string | null;
  phaseTwoStartAt: string | null;
  phaseThreeStartAt: string | null;
  phaseFourStartAt: string | null;
  phaseFiveStartAt: string | null;
  status: "PENDING" | "ACTIVE" | "DISCARDED" | "EXPIRED" | "KEPT" | null;
  partner: RemoteJourneyPartnerProfile | null;
  sharedChatMessages: RemoteJourneyMessage[];
  phaseOneStarterUserId: string | null;
  phaseOneStarterPenaltyAppliedAt: string | null;
  phaseTwoPenaltyAppliedAt: string | null;
  phaseOneDecisions: Record<string, "continue" | "new-match">;
  phaseThreeDecisions: Record<string, "stay" | "new-match">;
  phaseTwoRounds: RemoteJourneyPhaseTwoRoundConfig[];
  phaseTwoRoundIndex: number;
  phaseTwoStage: "starter" | "partner" | "result";
  phaseTwoResults: RemoteJourneyPhaseTwoRoundResult[];
  phaseTwoStarterUserId: string | null;
  phaseTwoPartnerUserId: string | null;
  phaseTwoStarterName: string;
  phaseTwoPartnerName: string;
};

type JourneyResponse = {
  ok: true;
  journey: RemoteJourneyState;
};

type HydratedProfileResult = {
  profile: RegistrationProfile;
  photoUrls: string[];
  videoUrl: string | null;
};

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as TResponse & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "REQUEST_FAILED");
  }

  return data;
}

async function fetchJson<TResponse>(path: string): Promise<TResponse> {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const response = await fetch(`${apiBaseUrl}${path}`);
  const data = (await response.json()) as TResponse & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "REQUEST_FAILED");
  }

  return data;
}

async function deleteJson<TResponse>(path: string): Promise<TResponse> {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
  });
  const data = (await response.json()) as TResponse & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "REQUEST_FAILED");
  }

  return data;
}

function createApproximateBirthdayFromAge(age: number) {
  const now = new Date();
  const birthDate = new Date(now.getFullYear() - age, now.getMonth(), now.getDate());

  return {
    birthDay: String(birthDate.getDate()).padStart(2, "0"),
    birthMonth: String(birthDate.getMonth() + 1).padStart(2, "0"),
    birthYear: String(birthDate.getFullYear()),
  };
}

function parsePreferenceNotes(value?: string | null) {
  const parsed = {
    greenFlags: [] as string[],
    dealbreakers: [] as string[],
  };

  if (!value?.trim()) {
    return parsed;
  }

  for (const section of value.split("|").map((entry) => entry.trim()).filter(Boolean)) {
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

function inferImageMimeType(uri: string) {
  const normalizedUri = uri.toLowerCase();

  if (normalizedUri.endsWith(".png")) {
    return "image/png";
  }

  if (normalizedUri.endsWith(".webp")) {
    return "image/webp";
  }

  if (normalizedUri.endsWith(".heic") || normalizedUri.endsWith(".heif")) {
    return "image/heic";
  }

  return "image/jpeg";
}

function inferVideoMimeType(uri: string) {
  const normalizedUri = uri.toLowerCase();

  if (normalizedUri.endsWith(".mov")) {
    return "video/quicktime";
  }

  if (normalizedUri.endsWith(".m4v")) {
    return "video/x-m4v";
  }

  if (normalizedUri.endsWith(".webm")) {
    return "video/webm";
  }

  return "video/mp4";
}

function buildFileName(uri: string, index: number) {
  const extensionMatch = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? "jpg";
  return `choice-profile-${Date.now()}-${index}.${extension}`;
}

export async function startPhoneVerification(phoneNumber: string): Promise<StartPhoneVerificationResult> {
  const normalizedPhone = phoneNumber.trim();

  return postJson<StartPhoneVerificationResult>("/auth/phone/start", {
    phoneNumber: normalizedPhone,
  });
}

export async function verifyPhoneVerification(
  phoneNumber: string,
  code: string,
): Promise<VerifyPhoneVerificationResult> {
  const normalizedPhone = phoneNumber.trim();
  const normalizedCode = code.trim();

  return postJson<VerifyPhoneVerificationResult>("/auth/phone/verify", {
    phoneNumber: normalizedPhone,
    code: normalizedCode,
  });
}

export async function uploadProfilePhotos(photoUris: string[]): Promise<string[]> {
  const normalizedPhotoUris = photoUris.map((entry) => entry.trim()).filter(Boolean);

  if (!normalizedPhotoUris.length) {
    return normalizedPhotoUris;
  }

  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const signedUpload = await postJson<CloudinarySignatureResult>("/uploads/cloudinary/sign", {
    folder: "choice/profiles",
  });

  const uploadedUrls: string[] = [];

  for (const [index, uri] of normalizedPhotoUris.entries()) {
    if (/^https?:\/\//i.test(uri)) {
      uploadedUrls.push(uri);
      continue;
    }

    const formData = new FormData();
    const file = {
      uri,
      name: buildFileName(uri, index),
      type: inferImageMimeType(uri),
    } as unknown as Blob;

    formData.append("file", file);
    formData.append("api_key", signedUpload.apiKey);
    formData.append("timestamp", String(signedUpload.timestamp));
    formData.append("signature", signedUpload.signature);
    formData.append("folder", signedUpload.folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as {
      secure_url?: string;
      error?: { message?: string };
    };

    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message ?? "UPLOAD_FAILED");
    }

    uploadedUrls.push(data.secure_url);
  }

  return uploadedUrls;
}

export async function uploadProfileVideo(videoUri: string | null): Promise<string | null> {
  const normalizedVideoUri = videoUri?.trim();

  if (!normalizedVideoUri) {
    return normalizedVideoUri ?? null;
  }

  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const signedUpload = await postJson<CloudinarySignatureResult>("/uploads/cloudinary/sign", {
    folder: "choice/profiles",
  });

  if (/^https?:\/\//i.test(normalizedVideoUri)) {
    return normalizedVideoUri;
  }

  const formData = new FormData();
  const file = {
    uri: normalizedVideoUri,
    name: buildFileName(normalizedVideoUri, 0),
    type: inferVideoMimeType(normalizedVideoUri),
  } as unknown as Blob;

  formData.append("file", file);
  formData.append("api_key", signedUpload.apiKey);
  formData.append("timestamp", String(signedUpload.timestamp));
  formData.append("signature", signedUpload.signature);
  formData.append("folder", signedUpload.folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/video/upload`, {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message ?? "UPLOAD_FAILED");
  }

  return data.secure_url;
}

export async function createRemoteProfile(
  userId: string,
  profile: RegistrationProfile,
  photoUrls: string[],
  introVideoUrl?: string | null,
): Promise<CreateProfileResult> {
  const preferenceNotes = [
    profile.greenFlags.length ? `Pro: ${profile.greenFlags.join(", ")}` : "",
    profile.dealbreakers.length ? `No-Gos: ${profile.dealbreakers.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  const age = calculateAgeFromProfile(profile);

  if (age === null) {
    throw new Error("INVALID_BIRTHDAY");
  }

  const response = await postJson<{ ok: true; profileId: string }>("/profiles", {
    userId,
    firstName: profile.firstName.trim(),
    age,
    city: profile.city.trim(),
    selfDescription: profile.selfDescription.trim(),
    pronouns: profile.pronouns.trim(),
    identity: profile.identity.trim(),
    lookingFor: profile.lookingFor,
    datingIntent: profile.datingIntent,
    ageRangeMin: Number(profile.ageRangeMin),
    ageRangeMax: Number(profile.ageRangeMax),
    interests: profile.interests,
    dealbreaker: preferenceNotes || undefined,
    avatarUrl: photoUrls[0],
    photoUrls,
    introVideoUrl: introVideoUrl || undefined,
    matchTime: profile.matchTime,
    conversationStyle: profile.conversationStyle,
  });

  return {
    ok: true,
    profileId: response.profileId,
    summary: buildSummary(profile),
  };
}

export async function fetchRemoteProfile(userId: string): Promise<HydratedProfileResult> {
  const response = await fetchJson<FetchRemoteProfileResult>(`/profiles/${encodeURIComponent(userId)}`);
  const remoteProfile = response.profile;
  const birthday = createApproximateBirthdayFromAge(remoteProfile.age);
  const preferences = parsePreferenceNotes(remoteProfile.dealbreaker);

  return {
    profile: {
      firstName: remoteProfile.firstName,
      ...birthday,
      city: remoteProfile.city,
      selfDescription: remoteProfile.selfDescription,
      pronouns: remoteProfile.pronouns,
      identity: remoteProfile.identity,
      lookingFor: remoteProfile.lookingFor,
      datingIntent: remoteProfile.datingIntent,
      ageRangeMin: String(remoteProfile.ageRangeMin),
      ageRangeMax: String(remoteProfile.ageRangeMax),
      interests: remoteProfile.interests,
      greenFlags: preferences.greenFlags,
      dealbreakers: preferences.dealbreakers,
      matchTime: remoteProfile.matchTime,
      conversationStyle: remoteProfile.conversationStyle,
      consent: true,
    },
    photoUrls: remoteProfile.photoUrls,
    videoUrl: remoteProfile.introVideoUrl ?? null,
  };
}

export async function deleteRemoteAccount(userId: string): Promise<DeleteAccountResult> {
  return deleteJson<DeleteAccountResult>(`/profiles/${encodeURIComponent(userId)}`);
}

export async function fetchRemoteAccountState(userId: string): Promise<RemoteAccountStateResult["account"]> {
  const response = await fetchJson<RemoteAccountStateResult>(`/profiles/${encodeURIComponent(userId)}/account`);
  return response.account;
}

export async function applyRemoteSystemPenalty(input: {
  userId: string;
  reason: string;
  contextKey: string;
  note?: string;
}): Promise<ApplySystemPenaltyResult["account"]> {
  const response = await postJson<ApplySystemPenaltyResult>("/moderation/system-penalty", {
    userId: input.userId,
    reason: input.reason,
    contextKey: input.contextKey,
    note: input.note?.trim() || undefined,
  });

  return response.account;
}

export async function createRemoteReport(input: {
  reporterUserId: string;
  reportedUserId: string;
  reporterName: string;
  reportedName: string;
  reason: string;
  details?: string;
  latestMessagePreview?: string | null;
}): Promise<CreateReportResult> {
  return postJson<CreateReportResult>("/reports", {
    reporterUserId: input.reporterUserId,
    reportedUserId: input.reportedUserId,
    reporterName: input.reporterName,
    reportedName: input.reportedName,
    reason: input.reason,
    details: input.details?.trim() || undefined,
    latestMessagePreview: input.latestMessagePreview?.trim() || undefined,
  });
}

export async function registerRemotePushToken(input: {
  userId: string;
  token: string;
  platform: "ios" | "android" | "web";
}) {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  return postJson<{ ok: true }>("/push/register", {
    userId: input.userId,
    token: input.token.trim(),
    platform: input.platform,
  });
}

export async function fetchRemoteJourney(userId: string): Promise<RemoteJourneyState> {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const response = await fetchJson<JourneyResponse>(`/journey/${encodeURIComponent(userId)}`);
  return response.journey;
}

export async function sendRemoteJourneyMessage(input: {
  userId: string;
  kind: "text" | "image";
  text?: string;
  imageUri?: string;
}): Promise<RemoteJourneyState> {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const response = await postJson<JourneyResponse>(`/journey/${encodeURIComponent(input.userId)}/messages`, {
    kind: input.kind,
    text: input.text?.trim() || undefined,
    imageUri: input.imageUri?.trim() || undefined,
  });

  return response.journey;
}

export async function setRemotePhaseOneDecision(input: {
  userId: string;
  decision: "continue" | "new-match";
}): Promise<RemoteJourneyState> {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const response = await postJson<JourneyResponse>(`/journey/${encodeURIComponent(input.userId)}/phase-one-decision`, {
    decision: input.decision,
  });

  return response.journey;
}

export async function startRemotePhaseTwo(userId: string): Promise<RemoteJourneyState> {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const response = await postJson<JourneyResponse>(`/journey/${encodeURIComponent(userId)}/phase-two/start`, {});
  return response.journey;
}

export async function submitRemotePhaseTwoAnswer(input: {
  userId: string;
  stage: "starter" | "partner";
  roundIndex: number;
  optionIndex: number;
}): Promise<RemoteJourneyState> {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const response = await postJson<JourneyResponse>(`/journey/${encodeURIComponent(input.userId)}/phase-two/answer`, {
    stage: input.stage,
    roundIndex: input.roundIndex,
    optionIndex: input.optionIndex,
  });

  return response.journey;
}

export async function setRemotePhaseThreeDecision(input: {
  userId: string;
  decision: "stay" | "new-match";
}): Promise<RemoteJourneyState> {
  if (!apiBaseUrl) {
    throw new Error("API_URL_MISSING");
  }

  const response = await postJson<JourneyResponse>(`/journey/${encodeURIComponent(input.userId)}/phase-three-decision`, {
    decision: input.decision,
  });

  return response.journey;
}
