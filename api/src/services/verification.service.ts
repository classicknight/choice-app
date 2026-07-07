import { createHash, randomInt } from "node:crypto";

export function generateOtpCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(randomInt(min, max));
}

export function hashOtpCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string) {
  const compact = phone.trim().replace(/[^\d+]/g, "");

  if (!compact) {
    return compact;
  }

  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/[^\d]/g, "")}`;
  }

  if (compact.startsWith("00")) {
    return `+${compact.slice(2).replace(/[^\d]/g, "")}`;
  }

  if (compact.startsWith("49")) {
    return `+${compact}`;
  }

  if (compact.startsWith("0")) {
    return `+49${compact.slice(1)}`;
  }

  return compact;
}
