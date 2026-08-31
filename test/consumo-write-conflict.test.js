import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../server/app.js";

test("POST consumo exposes an optimistic concurrency conflict", async (t) => {
  const files = {
    "oficinas.csv": "codigo_oficina,oficina\n001,Oficina Uno\n",
    "consumo_resmas.csv": "fecha,mes,oficina,codigo_oficina,tipo_hoja,resmas\n",
    "consumo_resmas_2026.csv": "fecha,mes,oficina,codigo_oficina,tipo_hoja,resmas\n",
  };
  const storage = {
    kind: "netlify-blobs",
    async ensureAll() {},
    async read(filename) {
      return { data: files[filename], etag: "etag-stale" };
    },
    async replace() {
      return { modified: false };
    },
  };
  const env = { JWT_SECRET: "test-secret" };
  const app = createApp({ storage, env });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const token = jwt.sign({ role: "admin", email: "admin@example.test" }, env.JWT_SECRET);

  const response = await fetch(`http://127.0.0.1:${port}/api/data/consumo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fecha: "2026-08-15",
      codigo_oficina: "001",
      tipo_hoja: "A4",
      resmas: 3,
      mode: "create",
    }),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "The CSV changed while this request was being processed. Reload and try again.",
    code: "CSV_WRITE_CONFLICT",
  });
});
