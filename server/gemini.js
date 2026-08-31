const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
export const DEFAULT_MAX_OUTPUT_TOKENS = 300;
export const DEFAULT_GEMINI_TIMEOUT_MS = 25_000;
export const MAX_GEMINI_TIMEOUT_MS = 25_000;

export class GeminiProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GeminiProviderError";
    this.code = code;
  }
}

function isTransientStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function timeoutError() {
  return new GeminiProviderError("CHAT_TIMEOUT", "Gemini request timed out");
}

const BLOCKED_FINISH_REASONS = new Set([
  "BLOCKLIST",
  "LANGUAGE",
  "PROHIBITED_CONTENT",
  "RECITATION",
  "SAFETY",
  "SPII",
]);

function extractText(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.candidates)) {
    throw new GeminiProviderError("CHAT_INVALID_RESPONSE", "Malformed provider response");
  }
  const candidate = data.candidates[0];
  if (!candidate || !Array.isArray(candidate.content?.parts)) {
    throw new GeminiProviderError("CHAT_INVALID_RESPONSE", "Provider returned no answer");
  }
  if (BLOCKED_FINISH_REASONS.has(candidate.finishReason) || candidate.finishReason === "MAX_TOKENS") {
    throw new GeminiProviderError("CHAT_INVALID_RESPONSE", "Provider did not return a usable answer");
  }
  const answer = candidate.content.parts
    .filter((part) => typeof part?.text === "string")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!answer) throw new GeminiProviderError("CHAT_INVALID_RESPONSE", "Provider returned an empty answer");
  return answer;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseGeminiTimeoutMs(value) {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(Math.floor(parsed), MAX_GEMINI_TIMEOUT_MS);
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
    if (error instanceof GeminiProviderError) throw error;
    throw new GeminiProviderError("CHAT_PROVIDER_FAILURE", "Gemini retry wait failed");
  } finally {
    clearTimeout(timer);
  }
  if (deadline - Date.now() <= 0) throw timeoutError();
}

export function createGeminiClient({
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  retryDelayMs = 200,
  sleep = wait,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  const totalTimeoutMs = parseGeminiTimeoutMs(timeoutMs) ?? DEFAULT_GEMINI_TIMEOUT_MS;
  return {
    async generate({ instructions, input }) {
      if (!apiKey) throw new GeminiProviderError("CHAT_NOT_CONFIGURED", "Gemini is not configured");
      const deadline = Date.now() + totalTimeoutMs;
      const url = `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) throw timeoutError();
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
            fetchImpl(url, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: instructions }] },
                contents: [{ role: "user", parts: [{ text: input }] }],
                generationConfig: { maxOutputTokens, temperature: 0.2 },
              }),
              signal: controller.signal,
            }),
            timeout,
          ]);
          if (!response.ok) {
            await Promise.race([response.arrayBuffer().catch(() => {}), timeout]);
            if (attempt === 0 && isTransientStatus(response.status) && deadline - Date.now() > retryDelayMs) {
              clearTimeout(timer);
              await waitForRetry({ sleep, retryDelayMs, deadline });
              continue;
            }
            if (response.status === 429) {
              throw new GeminiProviderError("CHAT_RATE_LIMITED", "Gemini rate limit reached");
            }
            throw new GeminiProviderError("CHAT_PROVIDER_FAILURE", "Gemini request failed");
          }
          let data;
          try {
            data = await Promise.race([response.json(), timeout]);
          } catch (error) {
            if (error instanceof GeminiProviderError) throw error;
            throw new GeminiProviderError("CHAT_INVALID_RESPONSE", "Malformed provider response");
          }
          return extractText(data);
        } catch (error) {
          if (error instanceof GeminiProviderError) throw error;
          if (controller.signal.aborted || error?.name === "AbortError") throw timeoutError();
          if (attempt === 0 && deadline - Date.now() > retryDelayMs) {
            clearTimeout(timer);
            await waitForRetry({ sleep, retryDelayMs, deadline });
            continue;
          }
          throw new GeminiProviderError("CHAT_PROVIDER_FAILURE", "Gemini request failed");
        } finally {
          clearTimeout(timer);
        }
      }
      throw new GeminiProviderError("CHAT_PROVIDER_FAILURE", "Gemini request failed");
    },
  };
}
