import assert from "node:assert/strict";
import test from "node:test";
import { getJourneyClosureNotificationBody } from "./journey.js";

test("explains a missed phase and the next match search", () => {
  const phaseOneBody = getJourneyClosureNotificationBody("phase-one-not-started");
  const phaseTwoBody = getJourneyClosureNotificationBody("phase-two-not-completed");

  assert.match(phaseOneBody, /Chat wurde bis 21:00 Uhr nicht eröffnet/);
  assert.match(phaseTwoBody, /Choice-Runde wurde bis 21:00 Uhr nicht abgeschlossen/);
  assert.match(phaseOneBody, /morgen ab 09:00 Uhr/);
  assert.match(phaseTwoBody, /morgen ab 09:00 Uhr/);
});

test("explains a deliberate new-match decision without assigning blame", () => {
  const body = getJourneyClosureNotificationBody("post-game-new-match");

  assert.match(body, /wurde ein neues Match gewählt/);
  assert.doesNotMatch(body, /du hast|deine Schuld/i);
  assert.match(body, /morgen ab 09:00 Uhr/);
});
