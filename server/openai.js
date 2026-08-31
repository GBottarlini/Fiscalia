const RESPONSES_URL = "https://api.openai.com/v1/responses";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_MAX_OUTPUT_TOKENS = 300;
export const DEFAULT_OPENAI_TIMEOUT_MS = 25_000;
export const MAX_OPENAI_TIMEOUT_MS = 25_000;

export class OpenAIProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OpenAIProviderError";
    this.code = code;
  }
}

function isTransientStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function extractOutputText(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.output)) {
    throw new OpenAIProviderError("CHAT_INVALID_RESPONSE", "Malformed provider response");
  }

  const textParts = [];
  let refused = false;

  for (const outputItem of data.output) {
    if (!outputItem || outputItem.type !== "message" || !Array.isArray(outputItem.content)) continue;
    for (const contentItem of outputItem.content) {
      if (contentItem?.type === "refusal") refused = true;
      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        const text = contentItem.text.trim();
        if (text) textParts.push(text);
      }
    }
  }

  if (refused || data.status === "incomplete") {
    throw new OpenAIProviderError("CHAT_INVALID_RESPONSE", "Provider did not return a completed answer");
  }

  const answer = textParts.join("\n").trim();
  if (!answer) {
    throw new OpenAIProviderError("CHAT_INVALID_RESPONSE", "Provider returned an empty answer");
  }
  return answer;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutError() {
  return new OpenAIProviderError("CHAT_TIMEOUT", "OpenAI request timed out");
}

export function parseOpenAITimeoutMs(value) {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(Math.floor(parsed), MAX_OPENAI_TIMEOUT_MS);
}

async function waitForRetry({ sleep, retryDelayMs, deadline }) {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw timeoutError();

  let timer;
  const deadlineReached = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError()), remainingMs);
  });

  try {
    await Promise.race([Promise.resolve().then(() => sleep(retryDelayMs)), deadlineReached]);
  } catch (error) {
    if (error instanceof OpenAIProviderError) throw error;
    throw new OpenAIProviderError("CHAT_PROVIDER_FAILURE", "OpenAI retry wait failed");
  } finally {
    clearTimeout(timer);
  }

  if (deadline - Date.now() <= 0) throw timeoutError();
}

export function createOpenAIClient({
  apiKey,
  model = DEFAULT_OPENAI_MODEL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_OPENAI_TIMEOUT_MS,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  retryDelayMs = 200,
  sleep = wait,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  const totalTimeoutMs = parseOpenAITimeoutMs(timeoutMs) ?? DEFAULT_OPENAI_TIMEOUT_MS;

  return {
    async generate({ instructions, input }) {
      if (!apiKey) {
        throw new OpenAIProviderError("CHAT_NOT_CONFIGURED", "OpenAI is not configured");
      }

      const deadline = Date.now() + totalTimeoutMs;
      let lastStatus = 0;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          throw timeoutError();
        }

        const controller = new AbortController();
        let timer;
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(timeoutError());
          }, remainingMs);
        });

        try {
          const response = await Promise.race([
            fetchImpl(RESPONSES_URL, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                instructions,
                input,
                store: false,
                max_output_tokens: maxOutputTokens,
              }),
              signal: controller.signal,
            }),
            timeout,
          ]);

          lastStatus = response.status;
          if (!response.ok) {
            await Promise.race([response.arrayBuffer().catch(() => {}), timeout]);
            const canRetry =
              attempt === 0 &&
              isTransientStatus(response.status) &&
              deadline - Date.now() > retryDelayMs;
            if (canRetry) {
              clearTimeout(timer);
              await waitForRetry({ sleep, retryDelayMs, deadline });
              continue;
            }
            if (response.status === 429) {
              throw new OpenAIProviderError("CHAT_RATE_LIMITED", "OpenAI rate limit reached");
            }
            throw new OpenAIProviderError("CHAT_PROVIDER_FAILURE", "OpenAI request failed");
          }

          let data;
          try {
            data = await Promise.race([response.json(), timeout]);
          } catch (error) {
            if (error instanceof OpenAIProviderError) throw error;
            throw new OpenAIProviderError("CHAT_INVALID_RESPONSE", "Malformed provider response");
          }
          return extractOutputText(data);
        } catch (error) {
          if (error instanceof OpenAIProviderError) throw error;
          if (controller.signal.aborted || error?.name === "AbortError") {
            throw timeoutError();
          }

          const canRetry = attempt === 0 && deadline - Date.now() > retryDelayMs;
          if (canRetry) {
            clearTimeout(timer);
            await waitForRetry({ sleep, retryDelayMs, deadline });
            continue;
          }
          throw new OpenAIProviderError("CHAT_PROVIDER_FAILURE", "OpenAI request failed");
        } finally {
          clearTimeout(timer);
        }
      }

      if (lastStatus === 429) {
        throw new OpenAIProviderError("CHAT_RATE_LIMITED", "OpenAI rate limit reached");
      }
      throw new OpenAIProviderError("CHAT_PROVIDER_FAILURE", "OpenAI request failed");
    },
  };
}
