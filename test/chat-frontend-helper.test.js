import assert from "node:assert/strict";
import test from "node:test";
import { ChatRequestError, readChatResponse } from "../src/lib/chat.js";

test("reads a successful chat answer", async () => {
  const answer = await readChatResponse(
    new Response(JSON.stringify({ answer: "  Respuesta útil.  " }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  assert.equal(answer, "Respuesta útil.");
});

test("maps stable server codes to useful messages", async () => {
  await assert.rejects(
    readChatResponse(
      new Response(JSON.stringify({ code: "CHAT_RATE_LIMITED", error: "server message" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    ),
    (error) => {
      assert.ok(error instanceof ChatRequestError);
      assert.equal(error.code, "CHAT_RATE_LIMITED");
      assert.match(error.message, /temporalmente ocupado/);
      return true;
    }
  );
});

test("does not trust malformed or empty success bodies", async () => {
  for (const response of [
    new Response("not-json", { status: 502 }),
    new Response(JSON.stringify({ answer: " " }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ]) {
    await assert.rejects(readChatResponse(response), { code: "CHAT_INVALID_RESPONSE" });
  }
});
