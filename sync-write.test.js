import test from "node:test";
import assert from "node:assert/strict";
import { mutatePlan } from "./lib/sync-write.js";

const startTime = "2026-09-28T08:00:00.000Z";

test("a concurrent checkbox update is retried without losing either completion", async () => {
  let current = { startTime, completed: [] };
  let revision = 1;
  let injected = false;
  const store = {
    read: async () => ({ state: structuredClone(current), etag: String(revision) }),
    write: async (next, etag) => {
      if (!injected) {
        injected = true;
        current = { startTime, completed: ["1-glass-2"] };
        revision += 1;
      }
      if (etag !== String(revision)) throw new Error("conflict");
      current = next;
      revision += 1;
    },
    isConflict: (error) => error.message === "conflict",
  };

  const result = await mutatePlan({ type: "check", startTime, id: "1-glass-1", checked: true }, store);
  assert.deepEqual(result.completed, ["1-glass-2", "1-glass-1"]);
});
