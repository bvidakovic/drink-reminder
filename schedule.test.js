import test from "node:test";
import assert from "node:assert/strict";
import { buildSchedule, buildCalendar, CYCLE_MINUTES } from "./public/schedule.js";

test("two rounds follow the requested drink and break timing", () => {
  const start = new Date("2026-09-28T08:00:00Z");
  const steps = buildSchedule(start);
  assert.equal(steps.length, 18);
  assert.deepEqual(steps.map((step) => step.amountMl), [
    375, 375, 375, 375, 300, 300, 300, 300, 300,
    375, 375, 375, 375, 300, 300, 300, 300, 300,
  ]);
  assert.deepEqual(steps.slice(0, 9).map((step) => (step.dueAt - start) / 60_000),
    [0, 15, 30, 45, 90, 150, 210, 270, 330]);
  assert.deepEqual(steps.slice(9).map((step) => (step.dueAt - start) / 60_000),
    [0, 15, 30, 45, 90, 150, 210, 270, 330].map((minute) => minute + CYCLE_MINUTES));
  assert.equal(steps.reduce((sum, step) => sum + step.amountMl, 0), 6000);
});

test("invalid start times are rejected", () => {
  assert.throws(() => buildSchedule("not a date"), /valid start time/);
});

test("calendar export contains one alarm per drink", () => {
  const calendar = buildCalendar("2026-09-28T08:00:00Z");
  assert.equal((calendar.match(/BEGIN:VEVENT/g) ?? []).length, 18);
  assert.equal((calendar.match(/BEGIN:VALARM/g) ?? []).length, 18);
  assert.match(calendar, /DTSTART:20260928T080000Z/);
  assert.match(calendar, /DTSTART:20260928T153000Z/);
});
