export const VERIFICATION_START_WINDOW_MS = 60 * 60 * 1000;
export const MAX_VERIFICATION_STARTS_PER_WINDOW = 3;

export function getVerificationStartRetryAfterSeconds(
  startedAt: readonly Date[],
  now = new Date(),
) {
  const cutoff = now.getTime() - VERIFICATION_START_WINDOW_MS;
  const recentStarts = startedAt
    .map((date) => date.getTime())
    .filter((timestamp) => timestamp >= cutoff)
    .sort((left, right) => left - right);

  if (recentStarts.length < MAX_VERIFICATION_STARTS_PER_WINDOW) {
    return null;
  }

  const blockingStart = recentStarts[recentStarts.length - MAX_VERIFICATION_STARTS_PER_WINDOW];
  return Math.max(
    1,
    Math.ceil((blockingStart + VERIFICATION_START_WINDOW_MS - now.getTime()) / 1000),
  );
}
