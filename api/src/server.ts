import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { runJourneyAutomationSweep } from "./lib/journey.js";

const app = buildApp();
const journeyAutomationIntervalMs = 60_000;

let journeyAutomationRunning = false;

async function runJourneyAutomation(reason: "startup" | "interval") {
  if (journeyAutomationRunning) {
    app.log.debug({ reason }, "Skipping journey automation sweep because one is already running.");
    return;
  }

  journeyAutomationRunning = true;

  try {
    const result = await runJourneyAutomationSweep();
    app.log.info(
      {
        reason,
        processedUsers: result.processedUsers,
        failedUsers: result.failedUsers,
      },
      "Journey automation sweep finished.",
    );
  } catch (error) {
    app.log.error({ error, reason }, "Journey automation sweep failed.");
  } finally {
    journeyAutomationRunning = false;
  }
}

const start = async () => {
  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    if (env.JOURNEY_AUTOMATION_ENABLED) {
      void runJourneyAutomation("startup");
      setInterval(() => {
        void runJourneyAutomation("interval");
      }, journeyAutomationIntervalMs);
    } else {
      app.log.info("Journey automation is disabled for this API instance.");
    }
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
