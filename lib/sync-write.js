import { applyOperation, normalizePlan } from "./sync-state.js";

export class SyncBusyError extends Error {}

export async function mutatePlan(operation, { read, write, isConflict }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { state, etag } = await read();
    const next = operation.type === "initialize"
      ? state ?? normalizePlan(operation.state)
      : applyOperation(state, operation);
    if (state && JSON.stringify(next) === JSON.stringify(state)) return state;
    try {
      await write(next, etag);
      return next;
    } catch (error) {
      if (isConflict(error)) continue;
      // Creating the first blob can race with another device's first write.
      if (!etag && attempt === 0 && (await read().catch(() => null))?.state) continue;
      throw error;
    }
  }
  throw new SyncBusyError("Sync was busy. Please try again.");
}
