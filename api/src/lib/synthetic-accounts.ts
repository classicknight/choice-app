export const SEED_DEMO_EMAIL_SUFFIX = ".demo@choice.local";
export const PRIVATE_QA_EMAIL_SUFFIX = ".qa@choice.local";

export function isSeedDemoAccountEmail(email: string | null | undefined) {
  return email?.endsWith(SEED_DEMO_EMAIL_SUFFIX) ?? false;
}

export function isPrivateQaAccountEmail(email: string | null | undefined) {
  return email?.endsWith(PRIVATE_QA_EMAIL_SUFFIX) ?? false;
}

export function isSyntheticMatchingAccountEmail(email: string | null | undefined) {
  return isSeedDemoAccountEmail(email) || isPrivateQaAccountEmail(email);
}
