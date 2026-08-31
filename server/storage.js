import crypto from "crypto";
import { constants } from "fs";
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";
import { getStore } from "@netlify/blobs";

export const DATA_FILES = ["oficinas.csv", "consumo_resmas.csv", "consumo_resmas_2026.csv"];

const STORE_NAME = "fiscalia-csv";
const CURRENT_KEYS = new Map(DATA_FILES.map((filename) => [filename, filename]));
const sourceDataDir = path.resolve(process.cwd(), "src", "data");

function assertKnownFilename(filename) {
  const key = CURRENT_KEYS.get(filename);
  if (!key) {
    throw new Error(`Unknown CSV storage file: ${filename}`);
  }
  return key;
}

function etagFor(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function readSeedBytes(filename) {
  assertKnownFilename(filename);
  return readFile(path.join(sourceDataDir, filename));
}

function asArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export function createLocalCsvStorage(options = {}) {
  const configuredDataDir = String(options.dataDir ?? process.env.DATA_DIR ?? "").trim();
  const dataDir = path.resolve(configuredDataDir || sourceDataDir);
  const queues = new Map();

  async function ensureFile(filename) {
    assertKnownFilename(filename);
    await mkdir(dataDir, { recursive: true });
    try {
      await copyFile(path.join(sourceDataDir, filename), path.join(dataDir, filename), constants.COPYFILE_EXCL);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }

  async function read(filename) {
    await ensureFile(filename);
    const data = await readFile(path.join(dataDir, filename), "utf8");
    return { data, etag: etagFor(data) };
  }

  async function replace(filename, value, { etag, previousData }) {
    assertKnownFilename(filename);
    const previous = queues.get(filename) || Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = await read(filename);
      if (current.etag !== etag) return { modified: false };

      const filePath = path.join(dataDir, filename);
      const backupPath = `${filePath}.${new Date().toISOString().replaceAll(":", "-")}.${crypto.randomUUID()}.bak`;
      const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
      await writeFile(backupPath, previousData, { encoding: "utf8", flag: "wx" });
      try {
        await writeFile(tempPath, value, "utf8");
        await rename(tempPath, filePath);
      } finally {
        await unlink(tempPath).catch((error) => {
          if (error?.code !== "ENOENT") throw error;
        });
      }
      return { modified: true, etag: etagFor(value), backupKey: backupPath };
    });
    queues.set(filename, operation);
    try {
      return await operation;
    } finally {
      if (queues.get(filename) === operation) queues.delete(filename);
    }
  }

  return {
    kind: "local-filesystem",
    location: dataDir,
    async ensureAll() {
      await Promise.all(DATA_FILES.map(ensureFile));
    },
    read,
    replace,
  };
}

export function createNetlifyBlobStorage(options = {}) {
  const store = options.store || getStore({ name: STORE_NAME, consistency: "strong" });
  const deployContext = options.deployContext ?? process.env.CONTEXT;
  const writesAllowed = deployContext === "production";

  async function readCurrent(filename) {
    const key = assertKnownFilename(filename);
    let current = await store.getWithMetadata(key, { consistency: "strong", type: "text" });
    if (current) return current;

    if (!writesAllowed) {
      throw new Error(`CSV Blob ${filename} is missing and cannot be initialized outside production.`);
    }

    const seedBytes = await readSeedBytes(filename);
    const initialized = await store.set(key, asArrayBuffer(seedBytes), {
      metadata: { source: "repository-seed", filename },
      onlyIfNew: true,
    });
    if (initialized.modified) {
      current = await store.getWithMetadata(key, { consistency: "strong", type: "text" });
      if (current) return current;
      throw new Error(`CSV Blob ${filename} was not available after initialization.`);
    }

    current = await store.getWithMetadata(key, { consistency: "strong", type: "text" });
    if (!current) throw new Error(`CSV Blob ${filename} was not available after initialization.`);
    return current;
  }

  return {
    kind: "netlify-blobs",
    writesAllowed,
    async ensureAll() {
      await Promise.all(DATA_FILES.map(readCurrent));
    },
    async read(filename) {
      const current = await readCurrent(filename);
      return { data: current.data, etag: current.etag };
    },
    async replace(filename, value, { etag, previousData }) {
      if (!writesAllowed) {
        return { modified: false, readOnly: true };
      }

      const key = assertKnownFilename(filename);
      const backupKey = `backups/${filename}/${new Date().toISOString()}-${crypto.randomUUID()}`;
      const backup = await store.set(backupKey, previousData, {
        metadata: { currentKey: key, previousEtag: etag, createdAt: new Date().toISOString() },
        onlyIfNew: true,
      });
      if (!backup.modified) {
        throw new Error(`Failed to create immutable backup for ${filename}.`);
      }

      const result = await store.set(key, value, {
        metadata: { filename, previousEtag: etag, updatedAt: new Date().toISOString() },
        onlyIfMatch: etag,
      });
      return { ...result, backupKey };
    },
  };
}
