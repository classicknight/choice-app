import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default("auth@choice-dating.app"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  REVENUECAT_WEBHOOK_AUTH: z.string().optional(),
  ADMIN_PHONE_NUMBERS: z.string().default(""),
  ADMIN_ACCESS_KEY: z.string().optional(),
  MODERATION_ALERT_EMAILS: z.string().default(""),
  ADMIN_DASHBOARD_URL: z.string().url().default("https://choice-dating.app/admin"),
  JOURNEY_AUTOMATION_ENABLED: z.stringbool().default(false),
  JOURNEY_TEST_RELEASE_AT: z.string().optional(),
  JOURNEY_TEST_DATE: z.string().optional(),
  JOURNEY_TEST_PHASE_TWO_AT: z.string().optional(),
  JOURNEY_TEST_PHASE_STEP_MINUTES: z.coerce.number().int().positive().default(15),
});

export const env = envSchema.parse(process.env);
