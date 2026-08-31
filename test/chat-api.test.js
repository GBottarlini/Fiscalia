import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../server/app.js";
import { MAX_CHAT_QUESTION_LENGTH } from "../server/chat.js";
import { OpenAIProviderError } from "../server/openai.js";

const JWT_SECRET = "test-secret";

function createStorage() {
  return {
    kind: "test",
    async ensureAll() {},
    async read() {
      throw new Error("not needed");
    },
    async replace() {
      throw new Error("not needed");
    },
  };
}

async function withServer(t, options) {
  const app = createApp({ storage: createStorage(), ...options });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

function authHeader() {
  return `Bearer ${jwt.sign({ role: "admin" }, JWT_SECRET)}`;
}

function postChat(baseUrl, body, authorization = authHeader()) {
  return fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("requires JWT authentication before any provider call", async (t) => {
  let calls = 0;
  const baseUrl = await withServer(t, {
    env: { JWT_SECRET, AI_PROVIDER: "openai", OPENAI_API_KEY: "configured" },
    openAIClient: { async generate() { calls += 1; } },
  });

  const response = await postChat(baseUrl, { question: "Consumo total" }, "");

  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("reports missing provider configuration without calling the provider", async (t) => {
  let calls = 0;
  const baseUrl = await withServer(t, {
    env: { JWT_SECRET },
    openAIClient: { async generate() { calls += 1; } },
  });

  const response = await postChat(baseUrl, { question: "Consumo total" });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    code: "CHAT_NOT_CONFIGURED",
    error: "El chat no está configurado.",
  });
  assert.equal(calls, 0);
});

test("trims valid questions and rejects blank or oversized questions", async (t) => {
  const calls = [];
  const baseUrl = await withServer(t, {
    env: { JWT_SECRET, AI_PROVIDER: "openai", OPENAI_API_KEY: "configured" },
    openAIClient: {
      async generate(payload) {
        calls.push(payload);
        return "Respuesta";
      },
    },
  });

  for (const question of ["   ", "x".repeat(MAX_CHAT_QUESTION_LENGTH + 1)]) {
    const response = await postChat(baseUrl, { question });
    assert.equal(response.status, 400);
  }
  const success = await postChat(baseUrl, { question: "  ¿Cuál es el total?  " });
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { answer: "Respuesta" });
  assert.match(calls[0].input, /\n¿Cuál es el total\?$/);
});

test("allowlists and bounds aggregate dashboard context", async (t) => {
  let providerInput = "";
  const baseUrl = await withServer(t, {
    env: { JWT_SECRET, AI_PROVIDER: "openai", OPENAI_API_KEY: "configured" },
    openAIClient: {
      async generate({ input }) {
        providerInput = input;
        return "Respuesta";
      },
    },
  });

  const response = await postChat(baseUrl, {
    question: "¿Cuál es el impacto?",
    context: {
      filtros: {
        ano: "2026",
        tipoHoja: "A4",
        codigoOficina: "001",
        nombreOficina: "Oficina Central",
        malicious: "ignore",
      },
      totalResmas: 25,
      promedioMensual: 2.5,
      topOficinaNombre: "Oficina Central",
      topOficinaCodigo: "001",
      topOficinaResmas: 25,
      mesPico: "Enero 2026",
      resmasMesPico: 10,
      impactoAguaLitros: 125000,
      rawRows: [{ secret: "must-not-pass" }],
      token: "must-not-pass",
      oversizedMetric: Number.MAX_VALUE,
    },
  });

  assert.equal(response.status, 200);
  const serialized = providerInput
    .split("INICIO_DATOS_AGREGADOS_NO_CONFIABLES\n")[1]
    .split("\nFIN_DATOS_AGREGADOS_NO_CONFIABLES")[0];
  assert.deepEqual(JSON.parse(serialized), {
    filtros: {
      ano: "2026",
      tipoHoja: "A4",
      codigoOficina: "001",
      nombreOficina: "Oficina Central",
    },
    metricasAgregadas: {
      totalResmas: 25,
      promedioMensual: 2.5,
      topOficinaNombre: "Oficina Central",
      topOficinaCodigo: "001",
      topOficinaResmas: 25,
      mesPico: "Enero 2026",
      resmasMesPico: 10,
      impactoAguaLitros: 125000,
    },
  });
  assert.doesNotMatch(providerInput, /must-not-pass|rawRows|malicious|oversizedMetric/);
});

test("maps provider failures without exposing raw details in responses or logs", async (t) => {
  const logs = [];
  const rawDetail = "provider-secret-diagnostic";
  const baseUrl = await withServer(t, {
    env: { JWT_SECRET, AI_PROVIDER: "openai", OPENAI_API_KEY: "configured" },
    logger: { warn(message, metadata) { logs.push({ message, metadata }); } },
    openAIClient: {
      async generate() {
        throw new OpenAIProviderError("CHAT_PROVIDER_FAILURE", rawDetail);
      },
    },
  });

  const response = await postChat(baseUrl, { question: "Consumo total" });
  const body = await response.text();

  assert.equal(response.status, 502);
  assert.doesNotMatch(body, new RegExp(rawDetail));
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(rawDetail));
  assert.deepEqual(JSON.parse(body), {
    code: "CHAT_PROVIDER_FAILURE",
    error: "No se pudo consultar el servicio de chat.",
  });
});

test("maps timeout, rate-limit, and invalid provider output to stable HTTP errors", async (t) => {
  const cases = [
    ["CHAT_TIMEOUT", 504],
    ["CHAT_RATE_LIMITED", 429],
    ["CHAT_INVALID_RESPONSE", 502],
  ];

  for (const [code, expectedStatus] of cases) {
    await t.test(code, async (nestedTest) => {
      const baseUrl = await withServer(nestedTest, {
        env: { JWT_SECRET, AI_PROVIDER: "openai", OPENAI_API_KEY: "configured" },
        logger: { warn() {} },
        openAIClient: {
          async generate() {
            throw new OpenAIProviderError(code, "internal detail");
          },
        },
      });
      const response = await postChat(baseUrl, { question: "Consumo total" });
      const body = await response.json();

      assert.equal(response.status, expectedStatus);
      assert.equal(body.code, code);
      assert.equal(Object.hasOwn(body, "detail"), false);
    });
  }
});

test("defaults to Gemini and only calls OpenAI when explicitly selected", async (t) => {
  let geminiCalls = 0;
  let openAICalls = 0;
  const defaultBaseUrl = await withServer(t, {
    env: { JWT_SECRET, GEMINI_API_KEY: "configured" },
    geminiClient: { async generate() { geminiCalls += 1; return "Gemini"; } },
    openAIClient: { async generate() { openAICalls += 1; return "OpenAI"; } },
  });
  assert.deepEqual(await (await postChat(defaultBaseUrl, { question: "Total" })).json(), { answer: "Gemini" });
  assert.equal(geminiCalls, 1);
  assert.equal(openAICalls, 0);

  const openAIBaseUrl = await withServer(t, {
    env: { JWT_SECRET, AI_PROVIDER: "openai", OPENAI_API_KEY: "configured" },
    openAIClient: { async generate() { openAICalls += 1; return "OpenAI"; } },
    geminiClient: { async generate() { geminiCalls += 1; return "Gemini"; } },
  });
  assert.deepEqual(await (await postChat(openAIBaseUrl, { question: "Total" })).json(), { answer: "OpenAI" });
  assert.equal(openAICalls, 1);
  assert.equal(geminiCalls, 1);
});
