import assert from "node:assert/strict";
import test from "node:test";
import { filterUnseenJourneyCandidates, getJourneyEncounterPhaseReached } from "./journey.js";

test("does not offer a previously matched person again", () => {
  const candidates = [
    { id: "new-person", name: "New" },
    { id: "previous-person", name: "Previous" },
  ];

  assert.deepEqual(
    filterUnseenJourneyCandidates(candidates, new Set(["previous-person"])),
    [{ id: "new-person", name: "New" }],
  );
});

test("returns no regular candidate when only a previous partner is available", () => {
  assert.deepEqual(
    filterUnseenJourneyCandidates([{ id: "previous-person" }], new Set(["previous-person"])),
    [],
  );
});

test("maps the lifetime of an encounter to the furthest reached phase", () => {
  const release = new Date("2026-08-11T07:00:00.000Z");

  assert.equal(getJourneyEncounterPhaseReached(release, new Date("2026-08-11T19:30:00.000Z")), 1);
  assert.equal(getJourneyEncounterPhaseReached(release, new Date("2026-08-12T08:00:00.000Z")), 2);
  assert.equal(getJourneyEncounterPhaseReached(release, new Date("2026-08-13T08:00:00.000Z")), 3);
  assert.equal(getJourneyEncounterPhaseReached(release, new Date("2026-08-14T08:00:00.000Z")), 4);
  assert.equal(getJourneyEncounterPhaseReached(release, new Date("2026-08-14T20:00:00.000Z")), 5);
});
