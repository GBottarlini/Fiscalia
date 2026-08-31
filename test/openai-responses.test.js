import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenAIClient,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_OPENAI_TIMEOUT_MS,
  MAX_OPENAI_TIMEOUT_MS,
  OpenAIProviderError,
  parseOpenAITimeoutMs,
} from "../server/openai.js";

function completedResponse(content) {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [{ type: "message", content }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function expectProviderCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof OpenAIProviderError);
    assert.equal(error.code, code);
    return true;
  });
}

test("sends the documented Responses API shape and extracts every output_text item", async () => {
  let request;
  const client = createOpenAIClient({
    apiKey: "test-key",
    model: "configured-model",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return completedResponse([
        { type: "output_text", text: " Primera parte. " },
        { type: "other", text: "ignored" },
        { type: "output_text", text: "Segunda parte." },
      ]);
    },
  });

  const answer = await client.generate({ instructions: "System rules", input: "User input" });

  assert.equal(answer, "Primera parte.\nSegunda parte.");
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(request.init.body), {
    model: "configured-model",
    instructions: "System rules",
    input: "User input",
    store: false,
    max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
  });
});

test("defaults the Responses API model to gpt-4o-mini", async () => {
  let requestBody;
  const client = createOpenAIClient({
    apiKey: "test-key",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return completedResponse([{ type: "output_text", text: "Respuesta" }]);
    },
  });

  await client.generate({ instructions: "rules", input: "question" });
  assert.equal(requestBody.model, "gpt-4o-mini");
});

test("uses a bounded 25-second default and safely parses configured timeouts", () => {
  assert.equal(DEFAULT_OPENAI_TIMEOUT_MS, 25_000);
  assert.equal(parseOpenAITimeoutMs("12000"), 12_000);
  assert.equal(parseOpenAITimeoutMs("not-a-number"), undefined);
  assert.equal(parseOpenAITimeoutMs("0"), undefined);
  assert.equal(parseOpenAITimeoutMs("60000"), MAX_OPENAI_TIMEOUT_MS);
});

test("aborts a provider request at the configured timeout", async () => {
  const client = createOpenAIClient({
    apiKey: "test-key",
    timeoutMs: 15,
    fetchImpl: () => new Promise(() => {}),
  });

  await expectProviderCode(
    client.generate({ instructions: "rules", input: "question" }),
    "CHAT_TIMEOUT"
  );
});

test("retries a 429 once and returns a stable rate-limit error without leaking its body", async () => {
  let calls = 0;
  const rawError = "provider-secret-diagnostic";
  const client = createOpenAIClient({
    apiKey: "test-key",
    retryDelayMs: 0,
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1;
      return new Response(rawError, { status: 429 });
    },
  });

  await assert.rejects(client.generate({ instructions: "rules", input: "question" }), (error) => {
    assert.equal(error.code, "CHAT_RATE_LIMITED");
    assert.doesNotMatch(error.message, new RegExp(rawError));
    return true;
  });
  assert.equal(calls, 2);
});

test("retries provider 5xx once and returns a stable failure", async () => {
  let calls = 0;
  const client = createOpenAIClient({
    apiKey: "test-key",
    retryDelayMs: 0,
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1;
      return new Response("upstream internals", { status: 503 });
    },
  });

  await expectProviderCode(
    client.generate({ instructions: "rules", input: "question" }),
    "CHAT_PROVIDER_FAILURE"
  );
  assert.equal(calls, 2);
});

test("bounds a non-resolving retry wait by the total timeout", async () => {
  let calls = 0;
  const timeoutMs = 20;
  const client = createOpenAIClient({
    apiKey: "test-key",
    timeoutMs,
    retryDelayMs: 0,
    sleep: () => new Promise(() => {}),
    fetchImpl: async () => {
      calls += 1;
      return new Response("transient failure", { status: 503 });
    },
  });
  const startedAt = performance.now();

  await Promise.race([
    expectProviderCode(
      client.generate({ instructions: "rules", input: "question" }),
      "CHAT_TIMEOUT"
    ),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("retry wait exceeded the total timeout")), timeoutMs * 10)
    ),
  ]);

  assert.ok(performance.now() - startedAt < timeoutMs * 10);
  assert.ok(calls <= 2);
});

test("does not retry arbitrary provider 4xx responses", async () => {
  let calls = 0;
  const client = createOpenAIClient({
    apiKey: "test-key",
    retryDelayMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return new Response("invalid request details", { status: 400 });
    },
  });

  await expectProviderCode(
    client.generate({ instructions: "rules", input: "question" }),
    "CHAT_PROVIDER_FAILURE"
  );
  assert.equal(calls, 1);
});

test("rejects malformed, empty, incomplete, and refusal outputs", async (t) => {
  const cases = [
    { name: "malformed JSON", response: new Response("not-json", { status: 200 }) },
    { name: "empty output", response: completedResponse([]) },
    {
      name: "refusal",
      response: completedResponse([{ type: "refusal", refusal: "not available" }]),
    },
    {
      name: "incomplete",
      response: new Response(JSON.stringify({ status: "incomplete", output: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async () => {
      const client = createOpenAIClient({
        apiKey: "test-key",
        fetchImpl: async () => fixture.response,
      });
      await expectProviderCode(
        client.generate({ instructions: "rules", input: "question" }),
        "CHAT_INVALID_RESPONSE"
      );
    });
  }
});
