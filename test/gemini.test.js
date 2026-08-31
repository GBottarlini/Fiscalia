import assert from "node:assert/strict";
import test from "node:test";
import {
  createGeminiClient,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  GeminiProviderError,
  MAX_GEMINI_TIMEOUT_MS,
  parseGeminiTimeoutMs,
} from "../server/gemini.js";

function response(payload, status = 200) {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), { status });
}

function completed(parts = [{ text: " Respuesta Gemini. " }]) {
  return response({ candidates: [{ content: { parts }, finishReason: "STOP" }] });
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof GeminiProviderError);
    assert.equal(error.code, code);
    return true;
  });
}

test("sends Gemini REST shape with server-side header and extracts text", async () => {
  let request;
  const client = createGeminiClient({
    apiKey: "test-key",
    model: "configured-model",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return completed([{ text: "Primera parte." }, { text: " Segunda parte. " }, { inlineData: "ignored" }]);
    },
  });

  assert.equal(await client.generate({ instructions: "Rules", input: "Question" }), "Primera parte.\nSegunda parte.");
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/models/configured-model:generateContent");
  assert.equal(request.init.headers["x-goog-api-key"], "test-key");
  assert.doesNotMatch(request.url, /test-key/);
  const body = JSON.parse(request.init.body);
  assert.deepEqual(body, {
    systemInstruction: { parts: [{ text: "Rules" }] },
    contents: [{ role: "user", parts: [{ text: "Question" }] }],
    generationConfig: { maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS, temperature: 0.2 },
  });
  assert.doesNotMatch(request.init.body, /test-key/);
});

test("defaults the model and bounds timeout configuration", () => {
  assert.equal(DEFAULT_GEMINI_MODEL, "gemini-2.5-flash-lite");
  assert.equal(parseGeminiTimeoutMs("12000"), 12000);
  assert.equal(parseGeminiTimeoutMs("60000"), MAX_GEMINI_TIMEOUT_MS);
  assert.equal(parseGeminiTimeoutMs("invalid"), undefined);
});

test("rejects missing keys before calling Gemini", async () => {
  let calls = 0;
  const client = createGeminiClient({ apiKey: "", fetchImpl: async () => { calls += 1; } });
  await expectCode(client.generate({ instructions: "rules", input: "question" }), "CHAT_NOT_CONFIGURED");
  assert.equal(calls, 0);
});

test("retries 429 and 5xx once without leaking upstream bodies", async (t) => {
  for (const status of [429, 503]) {
    await t.test(String(status), async () => {
      let calls = 0;
      const secret = "upstream-secret-body";
      const client = createGeminiClient({
        apiKey: "test-key",
        retryDelayMs: 0,
        sleep: async () => {},
        fetchImpl: async () => { calls += 1; return response(secret, status); },
      });
      await expectCode(client.generate({ instructions: "rules", input: "question" }), status === 429 ? "CHAT_RATE_LIMITED" : "CHAT_PROVIDER_FAILURE");
      assert.equal(calls, 2);
    });
  }
});

test("maps provider authentication and quota rejection without retry or body leakage", async () => {
  let calls = 0;
  const secret = "private-provider-diagnostic";
  const client = createGeminiClient({
    apiKey: "test-key",
    fetchImpl: async () => { calls += 1; return response(secret, 403); },
  });
  await assert.rejects(client.generate({ instructions: "rules", input: "question" }), (error) => {
    assert.equal(error.code, "CHAT_PROVIDER_FAILURE");
    assert.doesNotMatch(error.message, new RegExp(secret));
    return true;
  });
  assert.equal(calls, 1);
});

test("bounds timeout including a non-resolving provider request and retry wait", async () => {
  const client = createGeminiClient({ apiKey: "test-key", timeoutMs: 15, fetchImpl: () => new Promise(() => {}) });
  await expectCode(client.generate({ instructions: "rules", input: "question" }), "CHAT_TIMEOUT");

  const retryClient = createGeminiClient({
    apiKey: "test-key",
    timeoutMs: 15,
    retryDelayMs: 0,
    sleep: () => new Promise(() => {}),
    fetchImpl: async () => response("temporary", 503),
  });
  await expectCode(retryClient.generate({ instructions: "rules", input: "question" }), "CHAT_TIMEOUT");
});

test("rejects malformed, empty, blocked, and truncated output", async (t) => {
  const cases = [
    ["malformed", response("not-json")],
    ["empty", completed([])],
    ["blocked", response({ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] })],
    ["truncated", response({ candidates: [{ content: { parts: [{ text: "partial" }] }, finishReason: "MAX_TOKENS" }] })],
  ];
  for (const [name, providerResponse] of cases) {
    await t.test(name, async () => {
      const client = createGeminiClient({ apiKey: "test-key", fetchImpl: async () => providerResponse });
      await expectCode(client.generate({ instructions: "rules", input: "question" }), "CHAT_INVALID_RESPONSE");
    });
  }
});
