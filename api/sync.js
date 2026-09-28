import { createHash, timingSafeEqual } from "node:crypto";
import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import { normalizePlan, SyncValidationError } from "../lib/sync-state.js";
import { mutatePlan, SyncBusyError } from "../lib/sync-write.js";

const PATH = "drink-reminder/plan.json";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (body, status = 200) => Response.json(body, { status, headers });

function authorized(request) {
  const expected = process.env.SYNC_KEY;
  if (!expected || expected.length < 32) return null;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function accessError(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.SYNC_KEY || process.env.SYNC_KEY.length < 32) return json({ error: "Sync is not configured on this deployment." }, 503);
  if (!authorized(request)) return json({ error: "The sync code is incorrect." }, 401);
  return null;
}

async function readPlan() {
  const result = await get(PATH, { access: "private", useCache: false });
  if (!result) return { state: null, etag: null };
  const state = normalizePlan(await new Response(result.stream).json());
  return { state, etag: result.blob.etag };
}

export async function GET(request) {
  const error = accessError(request);
  if (error) return error;
  try {
    const { state } = await readPlan();
    return json({ state });
  } catch (cause) {
    console.error("Sync read failed", cause);
    return json({ error: "Could not load synced progress." }, 503);
  }
}

export async function POST(request) {
  const error = accessError(request);
  if (error) return error;
  if (Number(request.headers.get("content-length")) > 8192) return json({ error: "Sync request is too large." }, 413);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "Sync request is too large." }, 413);
    body = JSON.parse(raw);
    if (body?.type !== "initialize" && body?.type !== "start" && body?.type !== "check") throw new Error("Invalid sync action.");
  } catch {
    return json({ error: "Invalid sync request." }, 400);
  }

  try {
    const state = await mutatePlan(body, {
      read: readPlan,
      write: async (next, etag) => {
        const options = { access: "private", contentType: "application/json" };
        if (etag) { options.allowOverwrite = true; options.ifMatch = etag; }
        await put(PATH, JSON.stringify(next), options);
      },
      isConflict: (cause) => cause instanceof BlobPreconditionFailedError,
    });
    return json({ state });
  } catch (cause) {
    if (cause instanceof SyncValidationError) return json({ error: cause.message }, 400);
    if (cause instanceof SyncBusyError) return json({ error: cause.message }, 409);
    console.error("Sync write failed", cause);
    return json({ error: "Could not save synced progress." }, 503);
  }
}
