import { buildSummary, calculateAgeFromProfile, createProfileId, type RegistrationProfile } from "./registration";

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

type HydratedProfileResult = {
  profile: RegistrationProfile;
  photoUrls: string[];
  videoUrl: string | null;
};

const mockCodes = new Map<string, { code: string; userId: string }>();
const mockUsersByPhone = new Map<string, string>();
const mockCompletedProfiles = new Set<string>();
const mockProfilesByUser = new Map<string, HydratedProfileResult>();

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

  if (!apiBaseUrl) {
    const code = "111111";
    const userId = mockUsersByPhone.get(normalizedPhone) ?? `local_${Date.now().toString(36)}`;
    mockUsersByPhone.set(normalizedPhone, userId);
    mockCodes.set(normalizedPhone, { code, userId });

    return {
      ok: true,
      userId,
      target: normalizedPhone,
      devCodePreview: code,
    };
  }

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

  if (!apiBaseUrl) {
    const pending = mockCodes.get(normalizedPhone);

    if (!pending || pending.code !== normalizedCode) {
      throw new Error("INVALID_CODE");
    }

    return {
      ok: true,
      userId: pending.userId,
      profileCompleted: mockCompletedProfiles.has(pending.userId),
    };
  }

  return postJson<VerifyPhoneVerificationResult>("/auth/phone/verify", {
    phoneNumber: normalizedPhone,
    code: normalizedCode,
  });
}

export async function uploadProfilePhotos(photoUris: string[]): Promise<string[]> {
  const normalizedPhotoUris = photoUris.map((entry) => entry.trim()).filter(Boolean);

  if (!normalizedPhotoUris.length || !apiBaseUrl) {
    return normalizedPhotoUris;
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

  if (!normalizedVideoUri || !apiBaseUrl) {
    return normalizedVideoUri ?? null;
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
  if (!apiBaseUrl) {
    mockCompletedProfiles.add(userId);
    mockProfilesByUser.set(userId, {
      profile: {
        ...profile,
        interests: [...profile.interests],
        greenFlags: [...profile.greenFlags],
        dealbreakers: [...profile.dealbreakers],
      },
      photoUrls: [...photoUrls],
      videoUrl: introVideoUrl ?? null,
    });

    return {
      ok: true,
      profileId: createProfileId(),
      summary: buildSummary(profile),
    };
  }

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
  if (!apiBaseUrl) {
    const mockProfile = mockProfilesByUser.get(userId);

    if (!mockProfile) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    return {
      profile: {
        ...mockProfile.profile,
        interests: [...mockProfile.profile.interests],
        greenFlags: [...mockProfile.profile.greenFlags],
        dealbreakers: [...mockProfile.profile.dealbreakers],
      },
      photoUrls: [...mockProfile.photoUrls],
      videoUrl: mockProfile.videoUrl ?? null,
    };
  }

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
  if (!apiBaseUrl) {
    mockCompletedProfiles.delete(userId);
    mockProfilesByUser.delete(userId);

    for (const [phone, mappedUserId] of mockUsersByPhone.entries()) {
      if (mappedUserId === userId) {
        mockUsersByPhone.delete(phone);
        mockCodes.delete(phone);
      }
    }

    return {
      ok: true,
    };
  }

  return deleteJson<DeleteAccountResult>(`/profiles/${encodeURIComponent(userId)}`);
}
