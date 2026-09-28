import { buildSchedule } from "../public/schedule.js";

export const EMPTY_PLAN = { startTime: null, completed: [] };
export class SyncValidationError extends Error {}

export function normalizePlan(input) {
  if (!input || typeof input !== "object") return { ...EMPTY_PLAN, completed: [] };
  const startTime = input.startTime;
  if (typeof startTime !== "string" || Number.isNaN(new Date(startTime).getTime()) || new Date(startTime).toISOString() !== startTime) {
    return { ...EMPTY_PLAN, completed: [] };
  }
  const validIds = new Set(buildSchedule(startTime).map((step) => step.id));
  const completed = Array.isArray(input.completed)
    ? [...new Set(input.completed.filter((id) => typeof id === "string" && validIds.has(id)))]
    : [];
  return { startTime, completed };
}

export function applyOperation(current, operation) {
  const plan = normalizePlan(current);
  if (!operation || typeof operation !== "object") throw new SyncValidationError("Invalid sync action.");

  if (operation.type === "start") {
    const next = normalizePlan({ startTime: operation.startTime, completed: [] });
    if (!next.startTime) throw new SyncValidationError("Choose a valid start time.");
    if (next.startTime === plan.startTime) return plan;
    return next;
  }

  if (operation.type === "check") {
    if (operation.startTime !== plan.startTime || !plan.startTime) return plan;
    const validIds = new Set(buildSchedule(plan.startTime).map((step) => step.id));
    if (!validIds.has(operation.id) || typeof operation.checked !== "boolean") throw new SyncValidationError("Invalid drink completion.");
    const completed = new Set(plan.completed);
    if (operation.checked) completed.add(operation.id);
    else completed.delete(operation.id);
    return { ...plan, completed: [...completed] };
  }

  throw new SyncValidationError("Invalid sync action.");
}
