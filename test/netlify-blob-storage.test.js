import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createNetlifyBlobStorage, DATA_FILES } from "../server/storage.js";

class FakeBlobStore {
  constructor() {
    this.entries = new Map();
    this.setCalls = [];
    this.nextEtag = 1;
  }

  async getWithMetadata(key) {
    const entry = this.entries.get(key);
    return entry ? { data: entry.data, etag: entry.etag, metadata: entry.metadata } : null;
  }

  async set(key, value, options = {}) {
    this.setCalls.push({ key, options });
    const current = this.entries.get(key);
    if (options.onlyIfNew && current) return { modified: false };
    if (options.onlyIfMatch && current?.etag !== options.onlyIfMatch) return { modified: false };
    const data = value instanceof ArrayBuffer ? Buffer.from(value).toString("utf8") : String(value);
    const etag = `etag-${this.nextEtag++}`;
    this.entries.set(key, { data, etag, metadata: options.metadata || {} });
    return { modified: true, etag };
  }
}

test("initializes missing production Blobs from exact repository seed bytes", async () => {
  const store = new FakeBlobStore();
  const storage = createNetlifyBlobStorage({ store, deployContext: "production" });

  await storage.ensureAll();

  for (const filename of DATA_FILES) {
    const expected = await readFile(path.resolve("src", "data", filename), "utf8");
    assert.equal(store.entries.get(filename).data, expected);
    const seedCall = store.setCalls.find((call) => call.key === filename);
    assert.equal(seedCall.options.onlyIfNew, true);
  }
});

test("returns a bounded conflict when the current Blob ETag changed", async () => {
  const store = new FakeBlobStore();
  store.entries.set("consumo_resmas_2026.csv", {
    data: "old csv\n",
    etag: "etag-original",
    metadata: {},
  });
  const storage = createNetlifyBlobStorage({ store, deployContext: "production" });
  const current = await storage.read("consumo_resmas_2026.csv");
  store.entries.set("consumo_resmas_2026.csv", {
    data: "concurrent csv\n",
    etag: "etag-concurrent",
    metadata: {},
  });

  const result = await storage.replace("consumo_resmas_2026.csv", "request csv\n", {
    etag: current.etag,
    previousData: current.data,
  });

  assert.equal(result.modified, false);
  assert.equal(store.entries.get("consumo_resmas_2026.csv").data, "concurrent csv\n");
  assert.equal(store.entries.get(result.backupKey).data, "old csv\n");
  assert.equal(store.setCalls.length, 2);
});

test("blocks Blob writes outside the production deploy context", async () => {
  const store = new FakeBlobStore();
  const storage = createNetlifyBlobStorage({ store, deployContext: "deploy-preview" });

  const result = await storage.replace("consumo_resmas.csv", "new csv\n", {
    etag: "etag-1",
    previousData: "old csv\n",
  });

  assert.deepEqual(result, { modified: false, readOnly: true });
  assert.equal(store.setCalls.length, 0);
});
