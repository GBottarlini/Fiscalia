import assert from "node:assert/strict";
import test from "node:test";
import { withLambda } from "@netlify/aws-lambda-compat";
import serverless from "serverless-http";
import { createApp } from "../server/app.js";

test("serves existing API paths through the modern Netlify Lambda compatibility wrapper", async () => {
  const storage = {
    kind: "netlify-blobs",
    async ensureAll() {},
    async read() {
      throw new Error("not needed");
    },
    async replace() {
      throw new Error("not needed");
    },
  };
  const lambdaHandler = serverless(createApp({ storage, env: {} }));
  const handler = withLambda((event, context) => lambdaHandler(event, context));

  const response = await handler(new Request("https://example.test/api/health"), {
    deploy: { context: "deploy-preview" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "local",
    commit: null,
    storage: "netlify-blobs",
  });
});
