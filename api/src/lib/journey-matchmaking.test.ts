import assert from "node:assert/strict";
import test from "node:test";
import { filterUnseenJourneyCandidates } from "./journey.js";

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
