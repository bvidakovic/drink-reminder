import test from "node:test";
import assert from "node:assert/strict";
import { applyOperation, normalizePlan } from "./lib/sync-state.js";

const startTime = "2026-09-28T08:00:00.000Z";

test("sync accepts only valid completion ids for the active schedule", () => {
  const plan = normalizePlan({ startTime, completed: ["1-glass-1", "1-glass-1", "bogus"] });
  assert.deepEqual(plan.completed, ["1-glass-1"]);
  assert.deepEqual(applyOperation(plan, { type: "check", startTime, id: "1-hourly-2", checked: true }).completed,
    ["1-glass-1", "1-hourly-2"]);
  assert.deepEqual(applyOperation(plan, { type: "check", startTime, id: "1-glass-1", checked: false }).completed, []);
});

test("a stale device cannot update a replacement schedule", () => {
  const current = { startTime, completed: ["1-glass-1"] };
  const replacement = applyOperation(current, { type: "start", startTime: "2026-09-29T08:00:00.000Z" });
  assert.deepEqual(replacement.completed, []);
  assert.deepEqual(applyOperation(replacement, { type: "check", startTime, id: "1-glass-2", checked: true }), replacement);
});
