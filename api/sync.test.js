import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "./sync.js";

const key = "test-sync-key-with-at-least-32-characters";

test("sync API requires configuration and the private code", async () => {
  const previousKey = process.env.SYNC_KEY;
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  const previousStoreId = process.env.BLOB_STORE_ID;
  const previousOidcToken = process.env.VERCEL_OIDC_TOKEN;
  try {
    delete process.env.SYNC_KEY;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.VERCEL_OIDC_TOKEN;
    const unavailable = await GET(new Request("https://example.com/api/sync"));
    assert.equal(unavailable.status, 503);

    process.env.SYNC_KEY = key;
    process.env.BLOB_STORE_ID = "store_test";
    process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
    const unauthorized = await GET(new Request("https://example.com/api/sync", {
      headers: { Authorization: "Bearer incorrect" },
    }));
    assert.equal(unauthorized.status, 401);

    const invalid = await POST(new Request("https://example.com/api/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: "not-json",
    }));
    assert.equal(invalid.status, 400);
  } finally {
    if (previousKey === undefined) delete process.env.SYNC_KEY;
    else process.env.SYNC_KEY = previousKey;
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken;
    if (previousStoreId === undefined) delete process.env.BLOB_STORE_ID;
    else process.env.BLOB_STORE_ID = previousStoreId;
    if (previousOidcToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = previousOidcToken;
  }
});
