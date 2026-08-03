export const SEED_DEMO_EMAIL_SUFFIX = ".demo@choice.local";

export function isSeedDemoAccountEmail(email: string | null | undefined) {
  return email?.endsWith(SEED_DEMO_EMAIL_SUFFIX) ?? false;
}
