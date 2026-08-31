import { withLambda } from "@netlify/aws-lambda-compat";
import serverless from "serverless-http";
import { createApp } from "../../server/app.js";
import { createNetlifyBlobStorage } from "../../server/storage.js";

const handlers = new Map();

function handlerFor(deployContext) {
  if (!handlers.has(deployContext)) {
    const storage = createNetlifyBlobStorage({ deployContext });
    const lambdaHandler = serverless(createApp({ storage }));
    handlers.set(deployContext, withLambda((event, context) => lambdaHandler(event, context)));
  }
  return handlers.get(deployContext);
}

export default (request, context) => handlerFor(context.deploy.context)(request, context);
